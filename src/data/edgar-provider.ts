/**
 * SEC EDGAR Market Data Provider
 *
 * Fetches company metadata and stale market cap from SEC EDGAR public APIs.
 * All data is public domain — no API key, no licensing restrictions.
 *
 * Endpoints used:
 *   https://www.sec.gov/files/company_tickers.json          (ticker→CIK map)
 *   https://data.sec.gov/submissions/CIK{pad}.json          (SIC, exchange)
 *   https://data.sec.gov/api/xbrl/companyfacts/CIK{pad}.json (EntityPublicFloat)
 *
 * SEC rate limit: 10 req/sec. We stay well under with per-request delays.
 * SEC requires a User-Agent identifying the requester; read from SEC_USER_AGENT env var.
 */

import type { MarketData } from "../scoring/types.js";
import type { MarketDataProvider, CacheConfig } from "./types.js";
import { DEFAULT_CACHE_CONFIG } from "./types.js";
import { loadData, saveData } from "../utils/storage.js";
import { sicToSector } from "./sic-to-sector.js";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";

// 7-day TTL for the ticker→CIK map (new companies are rare)
const TICKER_MAP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TICKER_MAP_FILE = "edgar-ticker-cik.json";
const MARKET_CACHE_FILE = "market-data-cache.json";

// 100 ms between SEC API requests → well under 10 req/sec
const REQUEST_DELAY_MS = 150;

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface CachedMarketData {
  [symbol: string]: {
    data: MarketData;
    fetchedAt: string;
  };
}

export class EdgarMarketDataProvider implements MarketDataProvider {
  private userAgent: string;
  private cacheConfig: CacheConfig;
  private cacheOnly: boolean;
  private tickerMap: Map<string, number> = new Map(); // ticker → CIK
  private marketCache: CachedMarketData = {};

  constructor(cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG, cacheOnly = false) {
    const ua = process.env.SEC_USER_AGENT;
    if (!ua) {
      throw new Error(
        "SEC_USER_AGENT environment variable is required for EDGAR API access.\n" +
        "Set it to identify yourself, e.g.: SEC_USER_AGENT=\"Your Name your@email.com\""
      );
    }
    this.userAgent = ua;
    this.cacheConfig = cacheConfig;
    this.cacheOnly = cacheOnly;
  }

  getName(): string {
    return "SEC EDGAR (public domain)";
  }

  private async secFetch(url: string): Promise<unknown> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`EDGAR API error: ${response.status} ${response.statusText} (${url})`);
    }
    return response.json();
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private padCik(cik: number): string {
    return String(cik).padStart(10, "0");
  }

  /** Load or refresh the ticker → CIK map */
  private async ensureTickerMap(): Promise<void> {
    if (this.tickerMap.size > 0) return;

    // Try disk cache first
    const stored = await loadData<Record<string, number>>(TICKER_MAP_FILE);
    if (stored?.data && stored.fetchedAt) {
      const age = Date.now() - new Date(stored.fetchedAt).getTime();
      if (age < TICKER_MAP_TTL_MS) {
        for (const [ticker, cik] of Object.entries(stored.data)) {
          this.tickerMap.set(ticker.toUpperCase(), cik);
        }
        console.log(`  [EDGAR] Loaded ${this.tickerMap.size} ticker→CIK mappings from cache`);
        return;
      }
    }

    // Fetch fresh
    console.log("  [EDGAR] Fetching ticker→CIK map from SEC...");
    const raw = await this.secFetch(TICKERS_URL) as Record<string, TickerEntry>;
    const plain: Record<string, number> = {};
    for (const entry of Object.values(raw)) {
      const ticker = entry.ticker.toUpperCase();
      this.tickerMap.set(ticker, entry.cik_str);
      plain[ticker] = entry.cik_str;
    }
    await saveData(TICKER_MAP_FILE, plain);
    console.log(`  [EDGAR] Cached ${this.tickerMap.size} ticker→CIK mappings`);
  }

  /** Load market data cache from disk */
  async loadCache(): Promise<void> {
    const stored = await loadData<CachedMarketData>(MARKET_CACHE_FILE);
    if (stored?.data) {
      this.marketCache = stored.data;
      console.log(`  [EDGAR] Loaded ${Object.keys(this.marketCache).length} cached market data entries`);
    }
  }

  async saveCache(): Promise<void> {
    await saveData(MARKET_CACHE_FILE, this.marketCache);
  }

  private isCacheValid(symbol: string): boolean {
    const entry = this.marketCache[symbol];
    if (!entry) return false;
    return Date.now() - new Date(entry.fetchedAt).getTime() < this.cacheConfig.ttlMs;
  }

  async getMarketData(symbol: string): Promise<MarketData | null> {
    if (this.isCacheValid(symbol)) return this.marketCache[symbol].data;
    await this.ensureTickerMap();
    return this.fetchFromEDGAR(symbol);
  }

  async getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();

    await this.loadCache();
    await this.ensureTickerMap();

    const uncached = symbols.filter((s) => !this.isCacheValid(s));
    for (const s of symbols) {
      if (this.isCacheValid(s)) results.set(s, this.marketCache[s].data);
    }

    console.log(`  [EDGAR] Cache: ${results.size} hits, ${uncached.length} to fetch`);
    if (uncached.length === 0 || this.cacheOnly) {
      if (this.cacheOnly && uncached.length > 0) {
        console.log(`  [EDGAR] Cache-only mode: skipping ${uncached.length} uncached symbol(s)`);
      }
      return results;
    }

    console.log(`  [EDGAR] Fetching ${uncached.length} symbols from SEC EDGAR...`);
    let fetched = 0;
    let successful = 0;

    for (const symbol of uncached) {
      if (fetched > 0) await this.sleep(REQUEST_DELAY_MS);

      const data = await this.fetchFromEDGAR(symbol);
      if (data) {
        results.set(symbol, data);
        this.marketCache[symbol] = { data, fetchedAt: new Date().toISOString() };
        successful++;
      }
      fetched++;

      if (fetched % 20 === 0) {
        console.log(`  [EDGAR] Progress: ${fetched}/${uncached.length} (${successful} successful)`);
      }
    }

    console.log(`  [EDGAR] Completed: ${successful}/${uncached.length} fetched`);
    await this.saveCache();
    return results;
  }

  private async fetchFromEDGAR(symbol: string): Promise<MarketData | null> {
    const cik = this.tickerMap.get(symbol.toUpperCase());
    if (!cik) {
      console.warn(`  [EDGAR] No CIK found for ${symbol}`);
      return null;
    }

    const padded = this.padCik(cik);

    try {
      // Step 1: submissions → SIC, sicDescription, exchange
      const submissions = await this.secFetch(
        `${SUBMISSIONS_URL}/CIK${padded}.json`
      ) as {
        sic?: string;
        sicDescription?: string;
        exchanges?: string[];
      };

      await this.sleep(REQUEST_DELAY_MS);

      const sic = submissions.sic ? parseInt(submissions.sic, 10) : null;
      const sicDescription = submissions.sicDescription ?? null;
      const exchange = submissions.exchanges?.[0] ?? null;
      const sector = sic ? (sicToSector(sic) ?? null) : null;

      // Step 2: company facts → EntityPublicFloat (stale market cap proxy)
      let marketCap: number | null = null;
      try {
        const facts = await this.secFetch(
          `${FACTS_URL}/CIK${padded}.json`
        ) as {
          facts?: {
            dei?: {
              EntityPublicFloat?: {
                units?: { USD?: Array<{ val: number; end: string; form: string }> };
              };
            };
          };
        };

        const floatEntries =
          facts?.facts?.dei?.EntityPublicFloat?.units?.USD ?? [];

        // Use the most recent 10-K filing value (annual report)
        const annual = floatEntries
          .filter((e) => e.form === "10-K" || e.form === "10-K/A")
          .sort((a, b) => b.end.localeCompare(a.end));

        if (annual.length > 0) {
          marketCap = annual[0].val;
        }
      } catch {
        // Facts endpoint may fail for non-reporting companies; that's fine
      }

      return {
        marketCap,
        sector,
        industry: sicDescription,
        averageVolume: null,
        exchange: normalizeExchange(exchange),
      };
    } catch (err) {
      console.warn(`  [EDGAR] Error fetching ${symbol} (CIK ${cik}):`, (err as Error).message);
      return null;
    }
  }
}

/** Map EDGAR exchange names to the short codes html.ts uses for TradingView links */
function normalizeExchange(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u.includes("NASDAQ")) return "NASDAQ";
  if (u.includes("NYSE")) return "NYSE";
  if (u.includes("AMEX") || u.includes("NYSE AMERICAN")) return "AMEX";
  if (u.includes("OTC") || u.includes("OTCBB")) return "OTC";
  return raw;
}

export function createEdgarProvider(cacheOnly = false): EdgarMarketDataProvider {
  return new EdgarMarketDataProvider(DEFAULT_CACHE_CONFIG, cacheOnly);
}
