import type { FMPTrade } from "../types/index.js";

export interface TradeSourceProvider {
  fetchSenateTrades(sinceDate: Date): Promise<FMPTrade[]>;
  fetchHouseTrades(sinceDate: Date): Promise<FMPTrade[]>;
  getName(): string;
}
