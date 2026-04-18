import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
import { loadTrades, fetchTrades, getDefaultTargetDate } from "../services/trade-service.js";
import { loadCommitteeData, buildPartyMap, findMemberByName, getMemberParty } from "../services/committee-service.js";
import { analyzeTrades } from "../services/analysis-service.js";
import { createFMPProvider } from "../data/fmp-provider.js";
import { createFMPClient } from "../services/fmp-client.js";
import { buildHtmlReport } from "../output/html.js";
import { buildIndexPage, loadManifest, upsertManifest } from "../output/index-page.js";
import { publishOutput } from "../publish.js";
import type { FMPTrade } from "../types/index.js";

const DEFAULT_WEB_DIR = "output/web";

function weekLabel(date: Date): string {
  // Find the Monday of the current week
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const reportHtmlCommand = new Command("report:html")
  .description("Generate a weekly HTML report and optionally publish to AWS S3")
  .option(
    "--no-fetch-trades",
    "Use cached trade data instead of fetching fresh"
  )
  .option(
    "--no-market-data",
    "Skip market data fetching (faster, no market cap scores)"
  )
  .option(
    "--out <dir>",
    `Output directory for HTML files (default: ${DEFAULT_WEB_DIR})`,
    DEFAULT_WEB_DIR
  )
  .option(
    "--publish",
    "Sync output/web to S3 and invalidate CloudFront after generating"
  )
  .option(
    "--bucket <name>",
    "S3 bucket name (or set S3_BUCKET env var)"
  )
  .option(
    "--region <region>",
    "AWS region (default: us-east-1 or AWS_REGION env var)"
  )
  .option(
    "--prefix <prefix>",
    "S3 key prefix (optional)"
  )
  .action(async (options) => {
    try {
      const webDir = path.resolve(process.cwd(), options.out as string);
      await fs.mkdir(webDir, { recursive: true });

      // ── 1. Fetch or load trades ──────────────────────────────────────────
      let tradeData;
      if (options.fetchTrades) {
        console.log("📥 Fetching fresh trade data...");
        const fmpClient = createFMPClient();
        const targetDate = getDefaultTargetDate();
        tradeData = await fetchTrades(fmpClient, targetDate);
        console.log("");
      } else {
        console.log("Using cached trade data (omit --no-fetch-trades to refresh)");
        tradeData = await loadTrades();
      }

      if (!tradeData) {
        console.error("❌ No trade data found. Run without --no-fetch-trades to fetch.");
        process.exit(1);
      }

      // ── 2. Load committee data ───────────────────────────────────────────
      const committeeData = await loadCommitteeData();
      if (!committeeData) {
        console.warn("⚠️  No committee data — run fetch:committees for committee analysis.");
      }

      // ── 3. Build party map for sales section ────────────────────────────
      const partyMap = committeeData?.legislators
        ? buildPartyMap(committeeData.legislators)
        : null;

      function resolveParty(trade: FMPTrade): string | undefined {
        if (!partyMap || !committeeData || !trade.firstName || !trade.lastName) return undefined;
        const id = findMemberByName(
          trade.firstName,
          trade.lastName,
          committeeData.membership,
          committeeData.legislators
        );
        return id ? getMemberParty(id, partyMap) ?? undefined : undefined;
      }

      // ── 4. Run analysis on all purchases ────────────────────────────────
      const marketDataProvider = options.marketData ? createFMPProvider() : null;
      if (!marketDataProvider) {
        console.log("Market data disabled (omit --no-market-data to enable)");
      }

      console.log("\nRunning analysis...");
      const report = await analyzeTrades(
        tradeData.senateTrades,
        tradeData.houseTrades,
        committeeData,
        marketDataProvider
      );

      // ── 5. Build sales list ──────────────────────────────────────────────
      const allTrades = [
        ...tradeData.senateTrades,
        ...tradeData.houseTrades,
      ];

      const salesTrades = allTrades
        .filter((t) => (t.type || "").toLowerCase().includes("sale"))
        .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""))
        .map((trade) => ({ trade, party: resolveParty(trade) }));

      // ── 6. Generate report HTML ──────────────────────────────────────────
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0]; // e.g. "2026-04-18"
      const label = `Week of ${weekLabel(now)}`;
      const reportFile = `report-${dateStr}.html`;

      console.log(`\n📄 Building HTML report: ${reportFile}`);

      const topSymbols = report.summary.topByScore
        .slice(0, 8)
        .map((t) => t.trade.symbol)
        .filter((s): s is string => !!s);

      const html = buildHtmlReport({
        report,
        salesTrades,
        dateLabel: label,
        indexUrl: "index.html",
      });

      await fs.writeFile(path.join(webDir, reportFile), html, "utf-8");
      console.log(`   Saved → ${path.join(webDir, reportFile)}`);

      // ── 7. Update manifest + rebuild index ──────────────────────────────
      await upsertManifest(webDir, {
        date: dateStr,
        dateLabel: label,
        file: reportFile,
        totalTrades: report.totalTradesAnalyzed,
        topSymbols,
      });

      const manifest = await loadManifest(webDir);
      const indexHtml = buildIndexPage(manifest);
      await fs.writeFile(path.join(webDir, "index.html"), indexHtml, "utf-8");
      console.log(`   Index → ${path.join(webDir, "index.html")} (${manifest.length} report${manifest.length !== 1 ? "s" : ""})`);

      // ── 8. Publish to S3 ────────────────────────────────────────────────
      if (options.publish) {
        console.log("\n🚀 Publishing to S3...");
        await publishOutput({
          localDir: webDir,
          bucket: options.bucket as string | undefined,
          region: options.region as string | undefined,
          prefix: options.prefix as string | undefined,
        });
      } else {
        console.log(
          "\nTip: add --publish to sync to S3, or run:\n" +
          "  congress-trades report:html --publish --bucket <your-bucket>"
        );
      }

      console.log("\n✅ Done.");
    } catch (error) {
      console.error("❌ report:html failed:", error);
      process.exit(1);
    }
  });
