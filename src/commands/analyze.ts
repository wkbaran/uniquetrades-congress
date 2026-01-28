import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
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
    "--type <type>",
    "Filter by trade type: purchase (includes exchange), sale, or all",
    "purchase"
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

      // Filter by trade type if specified
      const tradeType = (options.type || "purchase").toLowerCase();
      const filterByType = (trades: typeof tradeData.senateTrades) => {
        if (tradeType === "all") return trades;
        return trades.filter((t) => {
          const type = (t.type || "").toLowerCase();
          if (tradeType === "purchase") {
            // Include purchases and exchanges (exchanges are similar to purchases)
            return type.includes("purchase") || type.includes("exchange");
          }
          if (tradeType === "sale") return type.includes("sale");
          return true;
        });
      };

      const senateTrades = filterByType(tradeData.senateTrades);
      const houseTrades = filterByType(tradeData.houseTrades);

      const typeLabel = tradeType === "all" ? "" : ` (${tradeType}s only)`;
      console.log(`Running analysis${typeLabel}...\n`);

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
        senateTrades,
        houseTrades,
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

      // Build formatted output
      const lines: string[] = [];
      lines.push("");
      lines.push("=".repeat(60));
      const reportTitle = tradeType === "all"
        ? "UNIQUE TRADES ANALYSIS REPORT"
        : `UNIQUE ${tradeType.toUpperCase()}S ANALYSIS REPORT`;
      lines.push(reportTitle);
      lines.push("=".repeat(60));
      lines.push(`Generated: ${report.generatedAt}`);
      lines.push(`Total Trades Analyzed: ${report.totalTradesAnalyzed}`);
      lines.push(`Trades Scoring >= ${minScore}: ${filteredTrades.length}`);
      lines.push(`Symbol Stats: ${report.summary.symbolStats.uniqueSymbols} unique, ${report.summary.symbolStats.rareSymbols} rare`);
      lines.push("");

      const tradesToShow = topN > 0 ? filteredTrades.slice(0, topN) : filteredTrades;
      const countLabel = topN > 0 ? `TOP ${tradesToShow.length}` : `ALL ${tradesToShow.length}`;
      lines.push(`\n📈 ${countLabel} TRADES (score >= ${minScore}):\n`);

      for (const analyzed of tradesToShow) {
        lines.push(formatTradeReport(analyzed));
        lines.push("");
      }

      // Rare stocks section
      if (report.summary.byRarity.length > 0) {
        lines.push("\n🔍 RARE STOCK TRADES (few congress trades):\n");
        for (const analyzed of report.summary.byRarity.slice(0, 5)) {
          const rarity = analyzed.score.explanation.rarity;
          lines.push(
            `   ${analyzed.trade.symbol}: ${analyzed.trade.firstName} ${analyzed.trade.lastName} - ${rarity?.category} (${rarity?.totalCongressTrades} total trades)`
          );
        }
      }

      // Committee relevance section
      if (report.summary.byCommitteeRelevance.length > 0) {
        lines.push("\n⚠️  COMMITTEE-RELEVANT TRADES:\n");
        for (const analyzed of report.summary.byCommitteeRelevance.slice(0, 5)) {
          const rel = analyzed.score.explanation.committeeRelevance;
          lines.push(
            `   ${analyzed.trade.symbol}: ${analyzed.trade.firstName} ${analyzed.trade.lastName}`
          );
          if (rel) {
            const sectorInfo = [rel.stockSector, rel.stockIndustry].filter(Boolean).join(" / ");
            lines.push(`      Sector: ${sectorInfo || "N/A"}`);
            lines.push(`      Committees: ${rel.overlappingCommittees.join(", ")}`);
          }
        }
      }

      lines.push("\n" + "=".repeat(60));

      // Output to console
      const output = lines.join("\n");
      console.log(output);

      // Save to formatted-reports directory
      const reportsDir = path.join(process.cwd(), "formatted-reports");
      await fs.mkdir(reportsDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const typeSuffix = tradeType === "all" ? "" : `-${tradeType}s`;
      const filename = `analyze${typeSuffix}-${timestamp}.txt`;
      await fs.writeFile(path.join(reportsDir, filename), output);
      console.log(`\n📁 Saved to formatted-reports/${filename}`);
    } catch (error) {
      console.error("❌ Analysis failed:", error);
      process.exit(1);
    }
  });
