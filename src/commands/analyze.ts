import { Command } from "commander";
import { loadTrades } from "../services/trade-service.js";
import { loadCommitteeData } from "../services/committee-service.js";
import { analyzeTrades, formatTradeReport } from "../services/analysis-service.js";
import { createFMPClient } from "../services/fmp-client.js";
import type { AnalysisConfig } from "../types/index.js";

export const analyzeCommand = new Command("analyze")
  .description("Analyze trades and identify unique opportunities")
  .option(
    "--min-score <number>",
    "Minimum uniqueness score to include",
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
  .option(
    "--json",
    "Output raw JSON instead of formatted text"
  )
  .action(async (options) => {
    try {
      // Load cached data
      const [tradeData, committeeData] = await Promise.all([
        loadTrades(),
        loadCommitteeData(),
      ]);

      if (!tradeData) {
        console.error(
          "❌ No trade data found. Run 'fetch:trades' first."
        );
        process.exit(1);
      }

      if (!committeeData) {
        console.warn(
          "⚠️  No committee data found. Analysis will proceed without committee context."
        );
        console.warn("   Run 'fetch:committees' to enable committee relevance analysis.\n");
      }

      // Build config from options
      const config: AnalysisConfig = {
        marketCapThreshold: parseFloat(options.marketCap) * 1_000_000_000,
        volumeThresholdMultiplier: 0.1,
        convictionThresholdMultiplier: 2,
        minUniquenessScore: parseInt(options.minScore, 10),
      };

      console.log("Running analysis...\n");
      console.log(`Configuration:`);
      console.log(`  - Min Score: ${config.minUniquenessScore}`);
      console.log(`  - Market Cap Threshold: $${options.marketCap}B`);
      console.log("");

      const fmpClient = createFMPClient();
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
      console.log("UNIQUE TRADES ANALYSIS REPORT");
      console.log("=".repeat(60));
      console.log(`Generated: ${report.generatedAt}`);
      console.log(`Total Trades Analyzed: ${report.totalTradesAnalyzed}`);
      console.log(`Unique Trades Found: ${report.uniqueTrades.length}`);
      console.log("");

      const topN = parseInt(options.top, 10);
      console.log(`\n📈 TOP ${topN} UNIQUE TRADES:\n`);

      for (const tradeReport of report.summary.topByScore.slice(0, topN)) {
        console.log(formatTradeReport(tradeReport));
        console.log("");
      }

      // Summary by member
      const memberEntries = Object.entries(report.summary.byMember);
      if (memberEntries.length > 0) {
        console.log("\n👤 TRADES BY MEMBER:\n");
        const sortedMembers = memberEntries
          .map(([name, trades]) => ({
            name,
            count: trades.length,
            avgScore:
              trades.reduce((sum, t) => sum + t.score.overall, 0) / trades.length,
          }))
          .sort((a, b) => b.avgScore - a.avgScore)
          .slice(0, 10);

        for (const member of sortedMembers) {
          console.log(
            `   ${member.name}: ${member.count} unique trades (avg score: ${member.avgScore.toFixed(1)})`
          );
        }
      }

      // Summary by sector
      const sectorEntries = Object.entries(report.summary.bySector);
      if (sectorEntries.length > 0) {
        console.log("\n🏭 TRADES BY SECTOR:\n");
        const sortedSectors = sectorEntries
          .map(([sector, trades]) => ({
            sector,
            count: trades.length,
          }))
          .sort((a, b) => b.count - a.count);

        for (const { sector, count } of sortedSectors) {
          console.log(`   ${sector}: ${count} trades`);
        }
      }

      console.log("\n" + "=".repeat(60));
    } catch (error) {
      console.error("❌ Analysis failed:", error);
      process.exit(1);
    }
  });
