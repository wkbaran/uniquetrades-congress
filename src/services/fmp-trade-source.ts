/**
 * FMP Trade Source Provider
 *
 * Wraps FMPClient to implement the TradeSourceProvider interface.
 * Kept during the parallel-validation phase; removed at Phase 4 cutover.
 */

import type { FMPTrade } from "../types/index.js";
import type { TradeSourceProvider } from "../data/trade-source.js";
import { FMPClient } from "./fmp-client.js";

const MAX_PAGES = 50;

export class FMPTradeSource implements TradeSourceProvider {
  constructor(private client: FMPClient) {}

  getName(): string {
    return "FMP (Financial Modeling Prep)";
  }

  async fetchSenateTrades(sinceDate: Date): Promise<FMPTrade[]> {
    return this.paginate(sinceDate, (page, limit) =>
      this.client.getSenateTrades(page, limit)
    );
  }

  async fetchHouseTrades(sinceDate: Date): Promise<FMPTrade[]> {
    return this.paginate(sinceDate, (page, limit) =>
      this.client.getHouseTrades(page, limit)
    );
  }

  private async paginate(
    sinceDate: Date,
    fetcher: (page: number, limit: number) => Promise<FMPTrade[]>
  ): Promise<FMPTrade[]> {
    const limit = 100;
    const all: FMPTrade[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetcher(page, limit);
      if (batch.length === 0) break;

      all.push(...batch);

      const hasOld = batch.some((t) => {
        if (!t.transactionDate) return false;
        return new Date(t.transactionDate) < sinceDate;
      });
      if (batch.length < limit || hasOld) break;
    }

    return all.filter((t) => {
      if (!t.transactionDate) return true;
      return new Date(t.transactionDate) >= sinceDate;
    });
  }
}
