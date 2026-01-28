import type { FMPTrade, TradeData } from "../types/index.js";
import { FMPClient } from "./fmp-client.js";
import { saveData, loadData } from "../utils/storage.js";

const TRADES_FILE = "trades.json";

/**
 * Get the default target date (1 year ago for refresh mode)
 */
export function getDefaultTargetDate(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date;
}

/**
 * Generate a unique key for a trade to detect duplicates
 */
function getTradeKey(trade: FMPTrade): string {
  return [
    trade.firstName || "",
    trade.lastName || "",
    trade.transactionDate || "",
    trade.symbol || "",
    trade.type || "",
    trade.amount || "",
    trade.owner || "",
  ].join("|");
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
 * Get the most recent trade date from an array of trades
 */
function getMostRecentTradeDate(trades: FMPTrade[]): Date | null {
  if (trades.length === 0) return null;

  const dates = trades
    .map((t) => t.transactionDate)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()));

  if (dates.length === 0) return null;

  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Merge new trades with existing trades, removing duplicates
 */
function mergeTrades(existing: FMPTrade[], newTrades: FMPTrade[]): FMPTrade[] {
  const existingKeys = new Set(existing.map(getTradeKey));
  const uniqueNewTrades = newTrades.filter((trade) => {
    const key = getTradeKey(trade);
    return !existingKeys.has(key);
  });

  return [...existing, ...uniqueNewTrades];
}

/**
 * Fetch trades from FMP, with support for incremental updates
 *
 * @param fmpClient - FMP client for API calls
 * @param targetDate - Date to fetch back to (for refresh mode)
 * @param limit - Number of trades per page
 * @param refresh - If true, clears existing data and fetches from targetDate. If false (default), fetches only new trades since most recent existing trade
 * @returns Trade data
 */
export async function fetchTrades(
  fmpClient: FMPClient,
  targetDate: Date,
  limit = 100,
  refresh = false
): Promise<TradeData> {
  let existingData: TradeData | null = null;
  let startDate: Date;

  if (refresh) {
    // Refresh mode: fetch from target date, ignore existing data
    startDate = targetDate;
    console.log(`🔄 Refresh mode: Fetching all trades since ${startDate.toISOString().split("T")[0]}`);
  } else {
    // Incremental mode: load existing data and fetch only new trades
    existingData = await loadTrades();

    if (!existingData) {
      // No existing data, fetch from target date
      startDate = targetDate;
      console.log(`📥 No existing data found. Fetching trades since ${startDate.toISOString().split("T")[0]}`);
    } else {
      // Find most recent trade date across both chambers
      const senateMostRecent = getMostRecentTradeDate(existingData.senateTrades);
      const houseMostRecent = getMostRecentTradeDate(existingData.houseTrades);

      const mostRecentDate = [senateMostRecent, houseMostRecent]
        .filter((d): d is Date => d !== null)
        .reduce((latest, current) => (current > latest ? current : latest), new Date(0));

      if (mostRecentDate.getTime() === 0) {
        // No valid dates in existing data, use target date
        startDate = targetDate;
        console.log(`⚠️  No valid dates in existing data. Fetching since ${startDate.toISOString().split("T")[0]}`);
      } else {
        // Fetch from one day before most recent to ensure we don't miss anything
        startDate = new Date(mostRecentDate);
        startDate.setDate(startDate.getDate() - 1);
        console.log(
          `📈 Incremental update: Most recent trade is ${mostRecentDate.toISOString().split("T")[0]}, ` +
          `fetching since ${startDate.toISOString().split("T")[0]}`
        );
      }
    }
  }

  const targetDateStr = startDate.toISOString().split("T")[0];
  console.log(`\nFetching new trades from FMP (limit=${limit} per page)...`);

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
      if (senateTrades.length < limit || hasTradesOlderThan(senateTrades, startDate)) {
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
      if (houseTrades.length < limit || hasTradesOlderThan(houseTrades, startDate)) {
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

  // Filter out trades older than start date
  const newSenateTrades = allSenateTrades.filter((trade) => {
    if (!trade.transactionDate) return true;
    return new Date(trade.transactionDate) >= startDate;
  });

  const newHouseTrades = allHouseTrades.filter((trade) => {
    if (!trade.transactionDate) return true;
    return new Date(trade.transactionDate) >= startDate;
  });

  console.log(`\nFetched ${page} page(s) from API:`);
  console.log(`  Senate: ${newSenateTrades.length} trades (filtered from ${allSenateTrades.length})`);
  console.log(`  House: ${newHouseTrades.length} trades (filtered from ${allHouseTrades.length})`);

  // Merge with existing data if in incremental mode
  let finalSenateTrades: FMPTrade[];
  let finalHouseTrades: FMPTrade[];

  if (!refresh && existingData) {
    console.log(`\n🔗 Merging with existing data...`);
    console.log(`  Existing: ${existingData.senateTrades.length} Senate, ${existingData.houseTrades.length} House`);

    finalSenateTrades = mergeTrades(existingData.senateTrades, newSenateTrades);
    finalHouseTrades = mergeTrades(existingData.houseTrades, newHouseTrades);

    const senateAdded = finalSenateTrades.length - existingData.senateTrades.length;
    const houseAdded = finalHouseTrades.length - existingData.houseTrades.length;

    console.log(`  Added: ${senateAdded} new Senate trades, ${houseAdded} new House trades`);
    console.log(`  Final: ${finalSenateTrades.length} Senate, ${finalHouseTrades.length} House`);
  } else {
    finalSenateTrades = newSenateTrades;
    finalHouseTrades = newHouseTrades;
  }

  const tradeData: TradeData = {
    senateTrades: finalSenateTrades,
    houseTrades: finalHouseTrades,
  };

  await saveData(TRADES_FILE, tradeData);
  console.log(`\n💾 Trades saved to ${TRADES_FILE}`);

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
