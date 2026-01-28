/**
 * Data Provider Types
 *
 * Defines interfaces for fetching market data and trading patterns.
 * Implementations can use different sources (FMP, Yahoo, cache, etc.)
 */

import type { MarketData, CongressionalTradingPattern } from "../scoring/types.js";

/**
 * Interface for fetching market data
 */
export interface MarketDataProvider {
  /**
   * Get market data for a single symbol
   */
  getMarketData(symbol: string): Promise<MarketData | null>;

  /**
   * Get market data for multiple symbols
   * Returns a map of symbol -> data
   */
  getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketData>>;

  /**
   * Get provider name for logging
   */
  getName(): string;
}

/**
 * Interface for analyzing congressional trading patterns
 */
export interface TradingPatternAnalyzer {
  /**
   * Analyze how often congress trades a particular symbol
   */
  getPattern(symbol: string): CongressionalTradingPattern;

  /**
   * Get patterns for multiple symbols
   */
  getPatternsBatch(symbols: string[]): Map<string, CongressionalTradingPattern>;
}

/**
 * Cache entry with expiration
 */
export interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  expiresAt: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttlMs: number;

  /** Maximum entries to cache */
  maxEntries: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxEntries: 1000,
};
