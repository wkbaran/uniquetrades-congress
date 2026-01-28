import type { FMPTrade, TradeData } from "../types/index.js";
import { FMPClient } from "./fmp-client.js";
import { saveData, loadData } from "../utils/storage.js";

const TRADES_FILE = "trades.json";

/**
 * Get the default target date (3 months + 1 day ago)
 */
export function getDefaultTargetDate(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  date.setDate(date.getDate() - 1);
  return date;
}

/**
 * Check if any trade in the array is older than the target date
 */
function hasTradesOlderThan(trades: FMPTrade[], targetDate: Date): boolean {
  return trades.some((trade) => {
    if (!trade.transactionDate) return false;
    return new Date(trade.transactionDate) < targetDate;
  });
}

/**
 * Fetch trades from FMP, paginating until reaching the target date
 */
export async function fetchTrades(
  fmpClient: FMPClient,
  targetDate: Date,
  limit = 100
): Promise<TradeData> {
  const targetDateStr = targetDate.toISOString().split("T")[0];
  console.log(`Fetching trades from FMP until ${targetDateStr} (limit=${limit} per page)...`);

  const allSenateTrades: FMPTrade[] = [];
  const allHouseTrades: FMPTrade[] = [];

  let senateDone = false;
  let houseDone = false;
  let page = 0;
  const maxPages = 50; // Safety limit

  while ((!senateDone || !houseDone) && page < maxPages) {
    console.log(`  Fetching page ${page}...`);

    const fetches: Promise<FMPTrade[]>[] = [];

    if (!senateDone) {
      fetches.push(fmpClient.getSenateTrades(page, limit));
    } else {
      fetches.push(Promise.resolve([]));
    }

    if (!houseDone) {
      fetches.push(fmpClient.getHouseTrades(page, limit));
    } else {
      fetches.push(Promise.resolve([]));
    }

    const [senateTrades, houseTrades] = await Promise.all(fetches);

    // Add trades to accumulator
    if (senateTrades.length > 0) {
      allSenateTrades.push(...senateTrades);
      console.log(`    Senate: +${senateTrades.length} trades (total: ${allSenateTrades.length})`);

      // Check if we've reached the target date or no more data
      if (senateTrades.length < limit || hasTradesOlderThan(senateTrades, targetDate)) {
        senateDone = true;
        console.log(`    Senate: reached target date or end of data`);
      }
    } else {
      senateDone = true;
      console.log(`    Senate: no more data`);
    }

    if (houseTrades.length > 0) {
      allHouseTrades.push(...houseTrades);
      console.log(`    House: +${houseTrades.length} trades (total: ${allHouseTrades.length})`);

      // Check if we've reached the target date or no more data
      if (houseTrades.length < limit || hasTradesOlderThan(houseTrades, targetDate)) {
        houseDone = true;
        console.log(`    House: reached target date or end of data`);
      }
    } else {
      houseDone = true;
      console.log(`    House: no more data`);
    }

    page++;
  }

  if (page >= maxPages) {
    console.warn(`  Warning: reached max pages limit (${maxPages})`);
  }

  // Filter out trades older than target date
  const filteredSenateTrades = allSenateTrades.filter((trade) => {
    if (!trade.transactionDate) return true;
    return new Date(trade.transactionDate) >= targetDate;
  });

  const filteredHouseTrades = allHouseTrades.filter((trade) => {
    if (!trade.transactionDate) return true;
    return new Date(trade.transactionDate) >= targetDate;
  });

  console.log(`\nFetched ${page} page(s):`);
  console.log(`  Senate: ${filteredSenateTrades.length} trades (filtered from ${allSenateTrades.length})`);
  console.log(`  House: ${filteredHouseTrades.length} trades (filtered from ${allHouseTrades.length})`);

  const tradeData: TradeData = {
    senateTrades: filteredSenateTrades,
    houseTrades: filteredHouseTrades,
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
