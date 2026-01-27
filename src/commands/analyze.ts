import { Command } from "commander";
import { loadTrades } from "../services/trade-service.js";
import { loadCommitteeData } from "../services/committee-service.js";
import { analyzeTrades, formatTradeReport } from "../services/analysis-service.js";
import { createFMPProvider } from "../data/fmp-provider.js";
import type { ScoringConfig } from "../scoring/types.js";
import { DEFAULT_SCORING_CONFIG } from "../scoring/types.js";

export const analyzeCommand = new Command("analyze")
  .description("Analyze trades and identify unique opportunities")
  .option(
    "--min-score <number>",
    "Minimum uniqueness score to show",
    "40"
  )
  .option(
    "--top <number>",
    "Limit to top N results (0 = all)",
    "0"
  )
  .option(
    "--no-market-data",
    "Skip fetching market data (faster, but no market cap scoring)"
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

      console.log("Running analysis...\n");

      // Create market data provider if enabled
      const marketDataProvider = options.marketData
        ? createFMPProvider()
        : null;

      if (!marketDataProvider) {
        console.log("Market data fetching disabled (use without --no-market-data to enable)\n");
      }

      const config: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
      };

      const report = await analyzeTrades(
        tradeData.senateTrades,
        tradeData.houseTrades,
        committeeData,
        marketDataProvider,
        config
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
      console.log("UNIQUE TRADES ANALYSIS REPORT");
      console.log("=".repeat(60));
      console.log(`Generated: ${report.generatedAt}`);
      console.log(`Total Trades Analyzed: ${report.totalTradesAnalyzed}`);
      console.log(`Trades Scoring >= ${minScore}: ${filteredTrades.length}`);
      console.log(`Symbol Stats: ${report.summary.symbolStats.uniqueSymbols} unique, ${report.summary.symbolStats.rareSymbols} rare`);
      console.log("");

      const tradesToShow = topN > 0 ? filteredTrades.slice(0, topN) : filteredTrades;
      const countLabel = topN > 0 ? `TOP ${tradesToShow.length}` : `ALL ${tradesToShow.length}`;
      console.log(`\n📈 ${countLabel} TRADES (score >= ${minScore}):\n`);

      for (const analyzed of tradesToShow) {
        console.log(formatTradeReport(analyzed));
        console.log("");
      }

      // Rare stocks section
      if (report.summary.byRarity.length > 0) {
        console.log("\n🔍 RARE STOCK TRADES (few congress trades):\n");
        for (const analyzed of report.summary.byRarity.slice(0, 5)) {
          const rarity = analyzed.score.explanation.rarity;
          console.log(
            `   ${analyzed.trade.symbol}: ${analyzed.trade.firstName} ${analyzed.trade.lastName} - ${rarity?.category} (${rarity?.totalCongressTrades} total trades)`
          );
        }
      }

      // Committee relevance section
      if (report.summary.byCommitteeRelevance.length > 0) {
        console.log("\n⚠️  COMMITTEE-RELEVANT TRADES:\n");
        for (const analyzed of report.summary.byCommitteeRelevance.slice(0, 5)) {
          const rel = analyzed.score.explanation.committeeRelevance;
          console.log(
            `   ${analyzed.trade.symbol}: ${analyzed.trade.firstName} ${analyzed.trade.lastName}`
          );
          if (rel) {
            const sectorInfo = [rel.stockSector, rel.stockIndustry].filter(Boolean).join(" / ");
            console.log(`      Sector: ${sectorInfo || "N/A"}`);
            console.log(`      Committees: ${rel.overlappingCommittees.join(", ")}`);
          }
        }
      }

      console.log("\n" + "=".repeat(60));
    } catch (error) {
      console.error("❌ Analysis failed:", error);
      process.exit(1);
    }
  });
