/**
 * Congressional Trading Pattern Analyzer
 *
 * Analyzes trading patterns from congressional trade data.
 * No external API calls - works entirely from cached trade data.
 */

import type { CongressionalTradingPattern } from "../scoring/types.js";
import type { TradingPatternAnalyzer } from "./types.js";
import type { FMPTrade } from "../types/index.js";

export class CongressionalPatternAnalyzer implements TradingPatternAnalyzer {
  private patterns = new Map<string, CongressionalTradingPattern>();

  /**
   * Build patterns from trade data
   */
  constructor(allTrades: FMPTrade[]) {
    this.buildPatterns(allTrades);
  }

  private buildPatterns(trades: FMPTrade[]): void {
    // Group trades by symbol
    const symbolTrades = new Map<string, FMPTrade[]>();

    for (const trade of trades) {
      if (!trade.symbol) continue;

      const symbol = trade.symbol.toUpperCase();
      if (!symbolTrades.has(symbol)) {
        symbolTrades.set(symbol, []);
      }
      symbolTrades.get(symbol)!.push(trade);
    }

    // Calculate patterns
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const [symbol, symbolTradeList] of symbolTrades) {
      // Count unique traders
      const traders = new Set<string>();
      let recentTrades = 0;

      for (const trade of symbolTradeList) {
        const traderId = `${trade.firstName}-${trade.lastName}`.toLowerCase();
        traders.add(traderId);

        // Count recent trades
        if (trade.transactionDate) {
          const tradeDate = new Date(trade.transactionDate);
          if (tradeDate >= ninetyDaysAgo) {
            recentTrades++;
          }
        }
      }

      this.patterns.set(symbol, {
        symbol,
        totalTrades: symbolTradeList.length,
        uniqueTraders: traders.size,
        recentTrades,
      });
    }
  }

  /**
   * Get pattern for a single symbol
   */
  getPattern(symbol: string): CongressionalTradingPattern {
    const upper = symbol.toUpperCase();
    return (
      this.patterns.get(upper) || {
        symbol: upper,
        totalTrades: 0,
        uniqueTraders: 0,
        recentTrades: 0,
      }
    );
  }

  /**
   * Get patterns for multiple symbols
   */
  getPatternsBatch(symbols: string[]): Map<string, CongressionalTradingPattern> {
    const results = new Map<string, CongressionalTradingPattern>();
    for (const symbol of symbols) {
      results.set(symbol, this.getPattern(symbol));
    }
    return results;
  }

  /**
   * Get statistics about the patterns
   */
  getStats(): {
    totalSymbols: number;
    uniqueSymbols: number;
    rareSymbols: number;
    commonSymbols: number;
  } {
    let unique = 0;
    let rare = 0;
    let common = 0;

    for (const pattern of this.patterns.values()) {
      if (pattern.totalTrades === 1) {
        unique++;
      } else if (pattern.totalTrades <= 3) {
        rare++;
      } else {
        common++;
      }
    }

    return {
      totalSymbols: this.patterns.size,
      uniqueSymbols: unique,
      rareSymbols: rare,
      commonSymbols: common,
    };
  }

  /**
   * Get the rarest symbols (traded least frequently)
   */
  getRarestSymbols(limit = 20): CongressionalTradingPattern[] {
    return [...this.patterns.values()]
      .sort((a, b) => a.totalTrades - b.totalTrades)
      .slice(0, limit);
  }
}
