import { Command } from "commander";
import { fetchTrades, getTradeStats, getDefaultTargetDate } from "../services/trade-service.js";
import { createFMPClient } from "../services/fmp-client.js";
import { getDataAge, formatDuration } from "../utils/storage.js";

export const fetchTradesCommand = new Command("fetch:trades")
  .description("Fetch congressional trades from FMP (incremental by default)")
  .option("-r, --refresh", "Force full refresh from target date instead of incremental update")
  .option("--since <date>", "Target date for refresh mode (YYYY-MM-DD). Default: 1 year ago")
  .option("--limit <number>", "Number of trades per page", "100")
  .action(async (options) => {
    try {
      // Parse target date
      let targetDate: Date;
      if (options.since) {
        targetDate = new Date(options.since);
        if (isNaN(targetDate.getTime())) {
          console.error(`❌ Invalid date format: ${options.since}. Use YYYY-MM-DD.`);
          process.exit(1);
        }
      } else {
        targetDate = getDefaultTargetDate();
      }

      const limit = parseInt(options.limit, 10);
      const refresh = options.refresh || false;

      const fmpClient = createFMPClient();
      const data = await fetchTrades(fmpClient, targetDate, limit, refresh);

      const senateStats = getTradeStats(data.senateTrades);
      const houseStats = getTradeStats(data.houseTrades);

      console.log("\n✅ Trade data fetched successfully:");
      console.log("\n   Senate:");
      console.log(`     - ${senateStats.total} trades`);
      console.log(`     - ${senateStats.uniqueTraders} unique traders`);
      console.log(`     - ${senateStats.uniqueSymbols} unique symbols`);
      console.log(`     - ${senateStats.purchases} purchases, ${senateStats.sales} sales`);

      console.log("\n   House:");
      console.log(`     - ${houseStats.total} trades`);
      console.log(`     - ${houseStats.uniqueTraders} unique traders`);
      console.log(`     - ${houseStats.uniqueSymbols} unique symbols`);
      console.log(`     - ${houseStats.purchases} purchases, ${houseStats.sales} sales`);

      // Show date range
      const allTrades = [...data.senateTrades, ...data.houseTrades];
      const dates = allTrades
        .map((t) => t.transactionDate)
        .filter((d): d is string => !!d)
        .sort();

      if (dates.length > 0) {
        console.log(`\n   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }
    } catch (error) {
      console.error("❌ Failed to fetch trades:", error);
      process.exit(1);
    }
  });
