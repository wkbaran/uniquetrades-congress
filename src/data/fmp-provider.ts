/**
 * FMP Market Data Provider
 *
 * Fetches market data from Financial Modeling Prep API.
 * Includes rate limiting and caching.
 */

import type { MarketData } from "../scoring/types.js";
import type { MarketDataProvider, CacheConfig } from "./types.js";
import { DEFAULT_CACHE_CONFIG } from "./types.js";
import { loadData, saveData } from "../utils/storage.js";

const FMP_BASE_URL = "https://financialmodelingprep.com";
const CACHE_FILE = "market-data-cache.json";

// Rate limiting
const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 3;

interface CachedMarketData {
  [symbol: string]: {
    data: MarketData;
    fetchedAt: string;
  };
}

export class FMPMarketDataProvider implements MarketDataProvider {
  private apiKey: string;
  private cache: CachedMarketData = {};
  private cacheConfig: CacheConfig;
  private unavailableSymbols = new Set<string>();

  constructor(apiKey: string, cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG) {
    if (!apiKey) {
      throw new Error("FMP API key is required");
    }
    this.apiKey = apiKey;
    this.cacheConfig = cacheConfig;
  }

  getName(): string {
    return "FMP (Financial Modeling Prep)";
  }

  /**
   * Load cache from disk
   */
  async loadCache(): Promise<void> {
    const stored = await loadData<CachedMarketData>(CACHE_FILE);
    if (stored?.data) {
      this.cache = stored.data;
      console.log(`  Loaded ${Object.keys(this.cache).length} cached market data entries`);
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    await saveData(CACHE_FILE, this.cache);
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(symbol: string): boolean {
    const entry = this.cache[symbol];
    if (!entry) return false;

    const fetchedAt = new Date(entry.fetchedAt).getTime();
    const now = Date.now();
    return now - fetchedAt < this.cacheConfig.ttlMs;
  }

  /**
   * Get market data for a single symbol
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    // Check cache first
    if (this.isCacheValid(symbol)) {
      return this.cache[symbol].data;
    }

    // Skip symbols we know aren't available
    if (this.unavailableSymbols.has(symbol)) {
      return null;
    }

    // Fetch from API
    const data = await this.fetchFromAPI(symbol);

    if (data) {
      // Update cache
      this.cache[symbol] = {
        data,
        fetchedAt: new Date().toISOString(),
      };
    }

    return data;
  }

  /**
   * Get market data for multiple symbols
   */
  async getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();

    // Load cache from disk
    await this.loadCache();

    // Separate cached vs uncached
    const uncached: string[] = [];

    for (const symbol of symbols) {
      if (this.isCacheValid(symbol)) {
        results.set(symbol, this.cache[symbol].data);
      } else if (!this.unavailableSymbols.has(symbol)) {
        uncached.push(symbol);
      }
    }

    console.log(`  Cache: ${results.size} hits, ${uncached.length} to fetch`);

    if (uncached.length === 0) {
      return results;
    }

    // Fetch uncached symbols
    console.log(`  Fetching ${uncached.length} symbols from ${this.getName()}...`);

    let fetched = 0;
    let successful = 0;

    for (const symbol of uncached) {
      // Rate limiting
      if (fetched > 0) {
        await this.sleep(REQUEST_DELAY_MS);
      }

      const data = await this.fetchFromAPI(symbol);

      if (data) {
        results.set(symbol, data);
        this.cache[symbol] = {
          data,
          fetchedAt: new Date().toISOString(),
        };
        successful++;
      }

      fetched++;

      // Progress every 20
      if (fetched % 20 === 0) {
        console.log(`  Progress: ${fetched}/${uncached.length} (${successful} successful)`);
      }
    }

    console.log(`  Completed: ${successful}/${uncached.length} fetched`);

    // Save updated cache
    await this.saveCache();

    if (this.unavailableSymbols.size > 0) {
      console.log(`  Note: ${this.unavailableSymbols.size} symbols not available on free tier`);
    }

    return results;
  }

  /**
   * Fetch from FMP API with retry logic
   */
  private async fetchFromAPI(
    symbol: string,
    retryCount = 0
  ): Promise<MarketData | null> {
    try {
      const url = new URL("/stable/quote", FMP_BASE_URL);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", this.apiKey);

      const response = await fetch(url.toString());

      // Handle rate limiting
      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const backoffMs = Math.pow(2, retryCount + 1) * 1000;
          console.warn(`  Rate limited, waiting ${backoffMs}ms...`);
          await this.sleep(backoffMs);
          return this.fetchFromAPI(symbol, retryCount + 1);
        }
        console.warn(`  Rate limit exceeded for ${symbol}`);
        return null;
      }

      // Handle unavailable symbols
      if (response.status === 402) {
        this.unavailableSymbols.add(symbol);
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      const quote = Array.isArray(data) ? data[0] : data;

      return {
        marketCap: quote.marketCap ?? null,
      };
    } catch (error) {
      console.warn(`  Error fetching ${symbol}:`, error);
      return null;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get list of unavailable symbols
   */
  getUnavailableSymbols(): string[] {
    return [...this.unavailableSymbols];
  }
}

/**
 * Create FMP provider from environment
 */
export function createFMPProvider(): FMPMarketDataProvider {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error("FMP_API_KEY environment variable is not set");
  }
  return new FMPMarketDataProvider(apiKey);
}
