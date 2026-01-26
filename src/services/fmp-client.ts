import {
  FMPTradesResponseSchema,
  FMPQuoteSchema,
  type FMPTrade,
  type FMPQuote,
} from "../types/index.js";

const FMP_BASE_URL = "https://financialmodelingprep.com";

// Delay between API requests (ms) - free tier is limited
const REQUEST_DELAY_MS = 500;

// Track symbols that aren't available on free tier
const unavailableSymbols = new Set<string>();

export class FMPClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("FMP API key is required");
    }
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, schema: { parse: (data: unknown) => T }): Promise<T> {
    const url = new URL(endpoint, FMP_BASE_URL);
    url.searchParams.set("apikey", this.apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `FMP API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // FMP returns error messages as objects with "Error Message" key
    if (data && typeof data === "object" && "Error Message" in data) {
      throw new Error(`FMP API error: ${data["Error Message"]}`);
    }

    return schema.parse(data);
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch latest Senate trades
   */
  async getSenateTrades(): Promise<FMPTrade[]> {
    return this.fetch("/stable/senate-latest", FMPTradesResponseSchema);
  }

  /**
   * Fetch latest House trades
   */
  async getHouseTrades(): Promise<FMPTrade[]> {
    return this.fetch("/stable/house-latest", FMPTradesResponseSchema);
  }

  /**
   * Get stock quote for market cap and volume data
   * Returns null if quote unavailable (handles 402, 429, etc.)
   */
  async getQuote(symbol: string, retryCount = 0): Promise<FMPQuote | null> {
    // Skip symbols we know aren't available
    if (unavailableSymbols.has(symbol)) {
      return null;
    }

    try {
      const url = new URL("/stable/quote", FMP_BASE_URL);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", this.apiKey);

      const response = await fetch(url.toString());

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (retryCount < 3) {
          const backoffMs = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
          console.warn(`  Rate limited on ${symbol}, waiting ${backoffMs}ms and retrying...`);
          await this.sleep(backoffMs);
          return this.getQuote(symbol, retryCount + 1);
        } else {
          console.warn(`  Rate limited on ${symbol}, max retries exceeded`);
          return null;
        }
      }

      // Handle 402 - symbol not available on free tier
      if (response.status === 402) {
        unavailableSymbols.add(symbol);
        console.warn(`  Symbol not available on free tier: ${symbol}`);
        return null;
      }

      if (!response.ok) {
        console.warn(`  Failed to get quote for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      // FMP returns an array with one quote
      const quote = Array.isArray(data) ? data[0] : data;
      return FMPQuoteSchema.parse(quote);
    } catch (error) {
      console.warn(`  Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get quotes for multiple symbols sequentially with rate limiting
   */
  async getQuotes(symbols: string[]): Promise<Map<string, FMPQuote>> {
    const results = new Map<string, FMPQuote>();

    if (symbols.length === 0) return results;

    // Filter out symbols we already know are unavailable
    const availableSymbols = symbols.filter(s => !unavailableSymbols.has(s));

    if (availableSymbols.length < symbols.length) {
      console.log(`  Skipping ${symbols.length - availableSymbols.length} symbols known to be unavailable`);
    }

    console.log(`  Fetching quotes for ${availableSymbols.length} symbols (${REQUEST_DELAY_MS}ms delay between requests)...`);

    let fetched = 0;
    let successful = 0;

    for (const symbol of availableSymbols) {
      // Wait before each request to avoid rate limiting
      if (fetched > 0) {
        await this.sleep(REQUEST_DELAY_MS);
      }

      const quote = await this.getQuote(symbol);
      if (quote) {
        results.set(symbol, quote);
        successful++;
      }
      fetched++;

      // Progress indicator every 20 symbols
      if (fetched % 20 === 0) {
        console.log(`  Progress: ${fetched}/${availableSymbols.length} fetched, ${successful} successful`);
      }
    }

    console.log(`  Completed: ${successful}/${availableSymbols.length} quotes retrieved`);

    if (unavailableSymbols.size > 0) {
      console.log(`  Note: ${unavailableSymbols.size} symbols not available on free tier`);
    }

    return results;
  }
}

/**
 * Create FMP client from environment
 */
export function createFMPClient(): FMPClient {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error("FMP_API_KEY environment variable is not set");
  }
  return new FMPClient(apiKey);
}

/**
 * Get list of symbols that aren't available on the free tier
 */
export function getUnavailableSymbols(): string[] {
  return [...unavailableSymbols];
}
