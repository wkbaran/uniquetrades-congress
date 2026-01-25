import { Command } from "commander";
import { fetchAllCommitteeData, loadCommitteeData } from "../services/committee-service.js";
import { fetchTrades, loadTrades, getTradeStats } from "../services/trade-service.js";
import { analyzeTrades, formatTradeReport } from "../services/analysis-service.js";
import { createFMPClient } from "../services/fmp-client.js";
import { getDataAge, formatDuration } from "../utils/storage.js";
import type { AnalysisConfig } from "../types/index.js";

export const runCommand = new Command("run")
  .description("Run the full pipeline: fetch data and analyze trades")
  .option(
    "--skip-committees",
    "Skip fetching committee data (use cached)"
  )
  .option(
    "--skip-trades",
    "Skip fetching trade data (use cached)"
  )
  .option(
    "--min-score <number>",
    "Minimum uniqueness score",
    "50"
  )
  .option(
    "--market-cap <number>",
    "Market cap threshold in billions",
    "2"
  )
  .option(
    "--top <number>",
    "Show top N results",
    "10"
  )
  .option("--json", "Output raw JSON")
  .action(async (options) => {
    try {
      const fmpClient = createFMPClient();

      // Step 1: Fetch/load committee data
      console.log("📋 Step 1: Committee Data\n");
      let committeeData = await loadCommitteeData();

      if (!options.skipCommittees) {
        const age = await getDataAge("committee-data.json");
        const shouldFetch =
          !age.exists || (age.ageMs || 0) > 24 * 60 * 60 * 1000; // 24 hours

        if (shouldFetch) {
          committeeData = await fetchAllCommitteeData();
          console.log("   ✅ Committee data fetched\n");
        } else {
          console.log(
            `   ✅ Using cached data (${formatDuration(age.ageMs || 0)} old)\n`
          );
        }
      } else {
        if (committeeData) {
          console.log("   ✅ Using cached committee data\n");
        } else {
          console.log("   ⚠️  No cached committee data available\n");
        }
      }

      // Step 2: Fetch/load trade data
      console.log("📈 Step 2: Trade Data\n");
      let tradeData = await loadTrades();

      if (!options.skipTrades) {
        tradeData = await fetchTrades(fmpClient);

        const senateStats = getTradeStats(tradeData.senateTrades);
        const houseStats = getTradeStats(tradeData.houseTrades);

        console.log(`   Senate: ${senateStats.total} trades`);
        console.log(`   House: ${houseStats.total} trades`);
        console.log("   ✅ Trade data fetched\n");
      } else {
        if (tradeData) {
          console.log("   ✅ Using cached trade data\n");
        } else {
          console.error("   ❌ No cached trade data available");
          process.exit(1);
        }
      }

      // Step 3: Analyze
      console.log("🔍 Step 3: Analysis\n");

      const config: AnalysisConfig = {
        marketCapThreshold: parseFloat(options.marketCap) * 1_000_000_000,
        volumeThresholdMultiplier: 0.1,
        convictionThresholdMultiplier: 2,
        minUniquenessScore: parseInt(options.minScore, 10),
      };

      const report = await analyzeTrades(
        tradeData.senateTrades,
        tradeData.houseTrades,
        committeeData,
        fmpClient,
        config
      );

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      // Display results
      console.log("\n" + "=".repeat(60));
      console.log("🎯 UNIQUE TRADES REPORT");
      console.log("=".repeat(60));
      console.log(`Generated: ${report.generatedAt}`);
      console.log(`Total Trades Analyzed: ${report.totalTradesAnalyzed}`);
      console.log(`Unique Trades Found: ${report.uniqueTrades.length}`);

      const topN = parseInt(options.top, 10);
      if (report.uniqueTrades.length > 0) {
        console.log(`\n📈 TOP ${Math.min(topN, report.uniqueTrades.length)} UNIQUE TRADES:\n`);

        for (const tradeReport of report.summary.topByScore.slice(0, topN)) {
          console.log(formatTradeReport(tradeReport));
          console.log("");
        }
      } else {
        console.log(
          "\n   No trades met the uniqueness criteria."
        );
        console.log("   Try lowering --min-score or increasing --market-cap");
      }

      console.log("=".repeat(60));
      console.log("✅ Pipeline complete\n");
    } catch (error) {
      console.error("❌ Pipeline failed:", error);
      process.exit(1);
    }
  });
