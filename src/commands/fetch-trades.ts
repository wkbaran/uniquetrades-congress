import { Command } from "commander";
import { fetchTrades, getTradeStats } from "../services/trade-service.js";
import { createFMPClient } from "../services/fmp-client.js";
import { getDataAge, formatDuration } from "../utils/storage.js";

export const fetchTradesCommand = new Command("fetch:trades")
  .description("Fetch latest congressional trades from FMP")
  .option("-f, --force", "Force fetch even if data is recent")
  .option("--page <number>", "Page number (starts at 0)", "0")
  .option("--limit <number>", "Number of trades per page", "100")
  .action(async (options) => {
    try {
      // Check if we have recent data
      const age = await getDataAge("trades.json");

      if (age.exists && !options.force) {
        const hoursSinceUpdate = (age.ageMs || 0) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 1) {
          console.log(
            `Trade data was fetched ${formatDuration(age.ageMs || 0)} ago.`
          );
          console.log("Use --force to fetch anyway.");
          return;
        }
      }

      const page = parseInt(options.page, 10);
      const limit = parseInt(options.limit, 10);

      console.log(`Fetching trades from FMP (page=${page}, limit=${limit})...\n`);

      const fmpClient = createFMPClient();
      const data = await fetchTrades(fmpClient, page, limit);

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
    } catch (error) {
      console.error("❌ Failed to fetch trades:", error);
      process.exit(1);
    }
  });
