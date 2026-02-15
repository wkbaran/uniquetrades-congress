import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
import { loadTrades, fetchTrades, getDefaultTargetDate } from "../services/trade-service.js";
import { loadCommitteeData } from "../services/committee-service.js";
import { analyzeTrades, formatTradeReport, getCommitteeNames } from "../services/analysis-service.js";
import { FMPMarketDataProvider } from "../data/fmp-provider.js";
import { createFMPClient } from "../services/fmp-client.js";
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
    "--no-fetch-trades",
    "Skip fetching fresh trade data (use cached)"
  )
  .option(
    "-r, --refresh",
    "Force full refresh of trade data instead of incremental update (only when fetching)"
  )
  .option(
    "--no-market-data",
    "Skip fetching market data (faster, but no market cap scoring)"
  )
  .option(
    "--market-data-ttl <days>",
    "Market data cache TTL in days (default: 30)",
    "30"
  )
  .option(
    "--json",
    "Output raw JSON instead of formatted text"
  )
  .option(
    "--since <date>",
    "Only analyze trades from this date onwards (YYYY-MM-DD)"
  )
  .action(async (options) => {
    try {
      // Fetch or load trade data
      let tradeData;
      if (options.fetchTrades) {
        console.log("📥 Fetching trade data...\n");
        const fmpClient = createFMPClient();
        const targetDate = getDefaultTargetDate();
        const refresh = options.refresh || false;
        tradeData = await fetchTrades(fmpClient, targetDate, 100, refresh);
        console.log("");
      } else {
        console.log("Using cached trade data (use without --no-fetch-trades to refresh)\n");
        tradeData = await loadTrades();
      }

      if (!tradeData) {
        console.error(
          "❌ No trade data found. Run without --no-fetch-trades to fetch."
        );
        process.exit(1);
      }

      // Load committee data
      const committeeData = await loadCommitteeData();

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
      console.log(`Running analysis${typeLabel} on full dataset for context...\n`);

      // Create market data provider if enabled
      let marketDataProvider = null;
      if (options.marketData) {
        const apiKey = process.env.FMP_API_KEY;
        if (!apiKey) {
          console.error("❌ FMP_API_KEY environment variable is not set");
          process.exit(1);
        }
        const ttlDays = parseInt(options.marketDataTtl, 10);
        const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
        marketDataProvider = new FMPMarketDataProvider(apiKey, {
          ttlMs,
          maxEntries: 1000,
        });
        console.log(`Market data cache TTL: ${ttlDays} days\n`);
      } else {
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

      // Filter results by date if --since is provided (after analysis for proper context)
      let scoredTrades = report.scoredTrades;
      if (options.since) {
        const sinceDate = new Date(options.since);
        if (isNaN(sinceDate.getTime())) {
          console.error(`❌ Invalid date format: ${options.since}. Use YYYY-MM-DD.`);
          process.exit(1);
        }

        const sinceDateStr = sinceDate.toISOString().split('T')[0];
        const beforeCount = scoredTrades.length;

        scoredTrades = scoredTrades.filter((st) => {
          const tradeDate = st.trade.transactionDate;
          if (!tradeDate) return false;
          return tradeDate >= sinceDateStr;
        });

        const afterCount = scoredTrades.length;
        console.log(`\nFiltering results to trades since ${sinceDateStr}...`);
        console.log(`  ${beforeCount} analyzed → ${afterCount} matching date filter\n`);
      }

      if (options.json) {
        const filteredReport = {
          ...report,
          scoredTrades,
          totalTradesAnalyzed: scoredTrades.length,
        };
        console.log(JSON.stringify(filteredReport, null, 2));
        return;
      }

      // Display results
      const minScore = parseInt(options.minScore, 10);
      const topN = parseInt(options.top, 10);

      const filteredTrades = scoredTrades.filter(
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

      if (options.since) {
        lines.push(`Filtered to trades since: ${options.since}`);
      }

      // Calculate date range from filtered trades
      const allDates = scoredTrades
        .map((t) => t.trade.transactionDate)
        .filter((d): d is string => !!d)
        .sort();
      if (allDates.length > 0) {
        lines.push(`Date Range: ${allDates[0]} to ${allDates[allDates.length - 1]}`);
      }

      lines.push(`Total Trades in Results: ${scoredTrades.length}`);
      lines.push(`Trades Scoring >= ${minScore}: ${filteredTrades.length}`);
      lines.push("");

      const tradesToShow = topN > 0 ? filteredTrades.slice(0, topN) : filteredTrades;
      const countLabel = topN > 0 ? `TOP ${tradesToShow.length}` : `ALL ${tradesToShow.length}`;
      lines.push(`\n📈 ${countLabel} TRADES (score >= ${minScore}):\n`);

      for (const analyzed of tradesToShow) {
        lines.push(formatTradeReport(analyzed, committeeData));
        lines.push("");
      }

      // Filter summary sections by date too
      const filterSummaryByDate = (trades: typeof scoredTrades) => {
        if (!options.since) return trades;
        const sinceDateStr = new Date(options.since).toISOString().split('T')[0];
        return trades.filter((st) => {
          const tradeDate = st.trade.transactionDate;
          if (!tradeDate) return false;
          return tradeDate >= sinceDateStr;
        });
      };

      // Rare stocks section
      const rareTrades = filterSummaryByDate(report.summary.byRarity);
      if (rareTrades.length > 0) {
        lines.push("\n🔍 RARE STOCK TRADES (few congress trades):\n");
        for (const analyzed of rareTrades.slice(0, 5)) {
          const rarity = analyzed.score.explanation.rarity;
          lines.push(
            `   ${analyzed.trade.symbol}: ${analyzed.trade.firstName} ${analyzed.trade.lastName} - ${rarity?.category} (${rarity?.totalCongressTrades} total trades)`
          );
        }
      }

      // Committee relevance section
      const committeeTrades = filterSummaryByDate(report.summary.byCommitteeRelevance);
      if (committeeTrades.length > 0) {
        lines.push("\n⚠️  COMMITTEE-RELEVANT TRADES:\n");
        for (const analyzed of committeeTrades.slice(0, 5)) {
          const rel = analyzed.score.explanation.committeeRelevance;
          lines.push(
            `   ${analyzed.trade.symbol}: ${analyzed.trade.firstName} ${analyzed.trade.lastName}`
          );
          if (rel) {
            const sectorInfo = [rel.stockSector, rel.stockIndustry].filter(Boolean).join(" / ");
            lines.push(`      Stock: ${sectorInfo || "N/A"}`);

            // Show committee names
            const committeeNames = getCommitteeNames(rel.overlappingCommittees, committeeData);
            if (committeeNames.length > 0) {
              lines.push(`      Relevant Committees: ${committeeNames.join(", ")}`);
            } else {
              lines.push(`      Relevant Committees: ${rel.overlappingCommittees.join(", ")}`);
            }
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
