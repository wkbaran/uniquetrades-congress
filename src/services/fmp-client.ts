import {
  FMPTradesResponseSchema,
  FMPQuoteSchema,
  type FMPTrade,
  type FMPQuote,
} from "../types/index.js";

const FMP_BASE_URL = "https://financialmodelingprep.com";

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
   */
  async getQuote(symbol: string): Promise<FMPQuote | null> {
    try {
      const url = new URL(`/stable/quote`, FMP_BASE_URL);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", this.apiKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.warn(`Failed to get quote for ${symbol}: ${response.status}`);
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
      console.warn(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Batch get quotes for multiple symbols
   * Falls back to individual requests if batch endpoint returns 402 (paid feature)
   */
  async getQuotes(symbols: string[]): Promise<Map<string, FMPQuote>> {
    const results = new Map<string, FMPQuote>();

    if (symbols.length === 0) return results;

    // Try batch request first
    const firstBatchUrl = new URL(`/stable/quote`, FMP_BASE_URL);
    firstBatchUrl.searchParams.set("symbol", symbols.slice(0, 5).join(","));
    firstBatchUrl.searchParams.set("apikey", this.apiKey);

    const testResponse = await fetch(firstBatchUrl.toString());

    // If batch returns 402, fall back to individual requests
    if (testResponse.status === 402) {
      console.log(`Batch quotes require paid tier, fetching ${symbols.length} quotes individually...`);
      return this.getQuotesIndividually(symbols);
    }

    // Batch is available, process in chunks
    const chunkSize = 50;
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const symbolsParam = chunk.join(",");

      try {
        const url = new URL(`/stable/quote`, FMP_BASE_URL);
        url.searchParams.set("symbol", symbolsParam);
        url.searchParams.set("apikey", this.apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
          console.warn(`Failed to get batch quotes: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          for (const item of data) {
            try {
              const quote = FMPQuoteSchema.parse(item);
              results.set(quote.symbol, quote);
            } catch {
              // Skip invalid quotes
            }
          }
        }
      } catch (error) {
        console.warn(`Error fetching batch quotes:`, error);
      }

      // Small delay between batches to avoid rate limiting
      if (i + chunkSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Fetch quotes individually (fallback for free tier)
   */
  private async getQuotesIndividually(symbols: string[]): Promise<Map<string, FMPQuote>> {
    const results = new Map<string, FMPQuote>();
    let fetched = 0;

    for (const symbol of symbols) {
      const quote = await this.getQuote(symbol);
      if (quote) {
        results.set(symbol, quote);
      }
      fetched++;

      // Progress indicator every 10 symbols
      if (fetched % 10 === 0) {
        console.log(`  Fetched ${fetched}/${symbols.length} quotes...`);
      }

      // Small delay to avoid rate limiting (free tier is usually 5 req/sec)
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.log(`  Fetched ${results.size}/${symbols.length} quotes successfully`);
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
