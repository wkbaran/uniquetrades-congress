import type { FMPTrade, TradeData } from "../types/index.js";
import { FMPClient } from "./fmp-client.js";
import { saveData, loadData } from "../utils/storage.js";

const TRADES_FILE = "trades.json";

/**
 * Fetch latest trades from FMP
 */
export async function fetchTrades(fmpClient: FMPClient): Promise<TradeData> {
  console.log("Fetching latest trades from FMP...");

  const [senateTrades, houseTrades] = await Promise.all([
    fmpClient.getSenateTrades(),
    fmpClient.getHouseTrades(),
  ]);

  console.log(
    `Fetched ${senateTrades.length} Senate trades and ${houseTrades.length} House trades`
  );

  const tradeData: TradeData = {
    senateTrades,
    houseTrades,
  };

  await saveData(TRADES_FILE, tradeData);
  console.log(`Trades saved to ${TRADES_FILE}`);

  return tradeData;
}

/**
 * Load cached trade data
 */
export async function loadTrades(): Promise<TradeData | null> {
  const stored = await loadData<TradeData>(TRADES_FILE);
  return stored?.data || null;
}

/**
 * Get unique traders from trade data
 */
export function getUniqueTraders(
  trades: FMPTrade[]
): { name: string; count: number }[] {
  const traderCounts = new Map<string, number>();

  for (const trade of trades) {
    const name = `${trade.firstName || ""} ${trade.lastName || ""}`.trim();
    if (name) {
      traderCounts.set(name, (traderCounts.get(name) || 0) + 1);
    }
  }

  return [...traderCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get trade statistics
 */
export function getTradeStats(trades: FMPTrade[]): {
  total: number;
  purchases: number;
  sales: number;
  byType: Record<string, number>;
  uniqueSymbols: number;
  uniqueTraders: number;
} {
  const byType: Record<string, number> = {};
  const symbols = new Set<string>();
  const traders = new Set<string>();

  let purchases = 0;
  let sales = 0;

  for (const trade of trades) {
    const type = (trade.type || "unknown").toLowerCase();
    byType[type] = (byType[type] || 0) + 1;

    if (type.includes("purchase")) purchases++;
    if (type.includes("sale")) sales++;

    if (trade.symbol) symbols.add(trade.symbol);

    const name = `${trade.firstName || ""} ${trade.lastName || ""}`.trim();
    if (name) traders.add(name);
  }

  return {
    total: trades.length,
    purchases,
    sales,
    byType,
    uniqueSymbols: symbols.size,
    uniqueTraders: traders.size,
  };
}

/**
 * Filter trades by date range
 */
export function filterTradesByDate(
  trades: FMPTrade[],
  startDate?: Date,
  endDate?: Date
): FMPTrade[] {
  return trades.filter((trade) => {
    if (!trade.transactionDate) return false;

    const tradeDate = new Date(trade.transactionDate);

    if (startDate && tradeDate < startDate) return false;
    if (endDate && tradeDate > endDate) return false;

    return true;
  });
}

/**
 * Filter trades by symbol
 */
export function filterTradesBySymbol(
  trades: FMPTrade[],
  symbols: string[]
): FMPTrade[] {
  const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));
  return trades.filter(
    (trade) => trade.symbol && symbolSet.has(trade.symbol.toUpperCase())
  );
}

/**
 * Filter trades by trader name
 */
export function filterTradesByTrader(
  trades: FMPTrade[],
  firstName?: string,
  lastName?: string
): FMPTrade[] {
  return trades.filter((trade) => {
    if (firstName && trade.firstName?.toLowerCase() !== firstName.toLowerCase()) {
      return false;
    }
    if (lastName && trade.lastName?.toLowerCase() !== lastName.toLowerCase()) {
      return false;
    }
    return true;
  });
}
