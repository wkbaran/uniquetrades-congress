import { Command } from "commander";
import { fetchAllCommitteeData, loadCommitteeData } from "../services/committee-service.js";
import { fetchTrades, loadTrades, getTradeStats, getDefaultTargetDate } from "../services/trade-service.js";
import { analyzeTrades, formatTradeReport } from "../services/analysis-service.js";
import { createFMPClient } from "../services/fmp-client.js";
import { createFMPProvider } from "../data/fmp-provider.js";
import { getDataAge, formatDuration } from "../utils/storage.js";
import { DEFAULT_SCORING_CONFIG } from "../scoring/types.js";

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
    "Minimum uniqueness score to show",
    "40"
  )
  .option(
    "--top <number>",
    "Show top N results",
    "10"
  )
  .option(
    "--no-market-data",
    "Skip fetching market data (faster)"
  )
  .option("--json", "Output raw JSON")
  .action(async (options) => {
    try {
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
        const fmpClient = createFMPClient();
        const targetDate = getDefaultTargetDate();
        tradeData = await fetchTrades(fmpClient, targetDate);

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

      // Create market data provider if enabled
      const marketDataProvider = options.marketData
        ? createFMPProvider()
        : null;

      if (!marketDataProvider) {
        console.log("   Market data fetching disabled\n");
      }

      const report = await analyzeTrades(
        tradeData.senateTrades,
        tradeData.houseTrades,
        committeeData,
        marketDataProvider,
        DEFAULT_SCORING_CONFIG
      );

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      // Display results
      const minScore = parseInt(options.minScore, 10);
      const topN = parseInt(options.top, 10);

      const filteredTrades = report.scoredTrades.filter(
        (t) => t.score.overallScore >= minScore
      );

      console.log("\n" + "=".repeat(60));
      console.log("🎯 UNIQUE TRADES REPORT");
      console.log("=".repeat(60));
      console.log(`Generated: ${report.generatedAt}`);
      console.log(`Total Trades Analyzed: ${report.totalTradesAnalyzed}`);
      console.log(`Trades Scoring >= ${minScore}: ${filteredTrades.length}`);
      console.log(`Symbol Stats: ${report.summary.symbolStats.uniqueSymbols} unique, ${report.summary.symbolStats.rareSymbols} rare`);

      if (filteredTrades.length > 0) {
        console.log(`\n📈 TOP ${Math.min(topN, filteredTrades.length)} TRADES:\n`);

        for (const analyzed of filteredTrades.slice(0, topN)) {
          console.log(formatTradeReport(analyzed));
          console.log("");
        }
      } else {
        console.log(
          "\n   No trades met the score threshold."
        );
        console.log("   Try lowering --min-score");
      }

      console.log("=".repeat(60));
      console.log("✅ Pipeline complete\n");
    } catch (error) {
      console.error("❌ Pipeline failed:", error);
      process.exit(1);
    }
  });
