import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
import { loadTrades, fetchTrades, getDefaultTargetDate } from "../services/trade-service.js";
import { loadCommitteeData, buildPartyMap, findMemberByName, getMemberParty } from "../services/committee-service.js";
import { analyzeTrades } from "../services/analysis-service.js";
import type { AnalysisReport } from "../services/analysis-service.js";
import { createFMPProvider } from "../data/fmp-provider.js";
import { createFMPClient } from "../services/fmp-client.js";
import { buildHtmlReport, buildPartyPage, buildMemberPage } from "../output/html.js";
import { buildIndexPage, loadManifest, upsertManifest, rebuildManifest } from "../output/index-page.js";
import { publishOutput } from "../publish.js";
import { loadData, getLatestReport } from "../utils/storage.js";
import type { FMPTrade } from "../types/index.js";

const DEFAULT_WEB_DIR = "output/web";

function weekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Load exchange info from the market data cache (populated by --market-data runs). */
async function loadExchangeMap(): Promise<Map<string, string>> {
  const exchangeMap = new Map<string, string>();
  try {
    type CacheEntry = { data: { exchange?: string | null }; fetchedAt: string };
    const cached = await loadData<Record<string, CacheEntry>>("market-data-cache.json");
    if (cached?.data) {
      for (const [sym, entry] of Object.entries(cached.data)) {
        if (entry.data.exchange) exchangeMap.set(sym, entry.data.exchange);
      }
    }
  } catch { /* cache not available */ }
  return exchangeMap;
}

export const reportHtmlCommand = new Command("report:html")
  .description("Generate a weekly HTML report and optionally publish to AWS S3")
  .option("--no-fetch-trades", "Use cached trade data instead of fetching fresh")
  .option("--no-market-data", "Skip market data fetching (faster, no market cap scores)")
  .option(
    "--out <dir>",
    `Output directory for HTML files (default: ${DEFAULT_WEB_DIR})`,
    DEFAULT_WEB_DIR
  )
  .option("--render-only", "Re-render HTML from the last saved analysis without re-fetching or re-analyzing")
  .option("--rebuild-index", "Rebuild index.html from the manifest (prunes deleted reports) without generating a new report")
  .option("--publish", "Sync output/web to S3 and invalidate CloudFront after generating")
  .option("--bucket <name>", "S3 bucket name (or set S3_BUCKET env var)")
  .option("--region <region>", "AWS region (default: us-east-1 or AWS_REGION env var)")
  .option("--prefix <prefix>", "S3 key prefix (optional)")
  .action(async (options) => {
    try {
      const webDir = path.resolve(process.cwd(), options.out as string);
      await fs.mkdir(webDir, { recursive: true });

      // ── Rebuild-index-only shortcut ──────────────────────────────────────
      if (options.rebuildIndex) {
        console.log("Rebuilding index from manifest...");
        const manifest = await rebuildManifest(webDir);
        const indexHtml = buildIndexPage(manifest);
        await fs.writeFile(path.join(webDir, "index.html"), indexHtml, "utf-8");
        console.log(`✅ index.html rebuilt (${manifest.length} report${manifest.length !== 1 ? "s" : ""})`);
        if (options.publish) {
          await publishOutput({ localDir: webDir, bucket: options.bucket, region: options.region, prefix: options.prefix });
        }
        return;
      }

      // ── Load committee data (needed in both paths) ───────────────────────
      const committeeData = await loadCommitteeData();
      if (!committeeData) {
        console.warn("⚠️  No committee data — run fetch:committees for committee analysis.");
      }

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

      let report: AnalysisReport;

      // ── Render-only path ─────────────────────────────────────────────────
      if (options.renderOnly) {
        console.log("Render-only mode: loading last saved analysis...");
        const filename = await getLatestReport("unique-trades");
        if (!filename) {
          console.error("❌ No saved analysis found. Run report:html (without --render-only) first.");
          process.exit(1);
        }
        const stored = await loadData<AnalysisReport>(filename, "reports");
        if (!stored?.data) {
          console.error(`❌ Could not load analysis from ${filename}.`);
          process.exit(1);
        }
        report = stored.data;
        console.log(`   Loaded ${filename} (${new Date(stored.fetchedAt).toLocaleString()})`);
      } else {
        // ── Full analysis path ─────────────────────────────────────────────
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

        const marketDataProvider = options.marketData ? createFMPProvider() : null;
        if (!marketDataProvider) {
          console.log("Market data disabled (omit --no-market-data to enable)");
        }

        console.log("\nRunning analysis...");
        report = await analyzeTrades(
          tradeData.senateTrades,
          tradeData.houseTrades,
          committeeData,
          marketDataProvider
        );
      }

      // ── Load trade data for sales section ───────────────────────────────
      const tradeData = await loadTrades();
      const allTrades = tradeData
        ? [...tradeData.senateTrades, ...tradeData.houseTrades]
        : [];

      const salesTrades = allTrades
        .filter((t) => (t.type || "").toLowerCase().includes("sale"))
        .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""))
        .map((trade) => ({ trade, party: resolveParty(trade) }));

      const purchaseTrades = allTrades
        .filter((t) => {
          const type = (t.type || "").toLowerCase();
          return type.includes("purchase") || type.includes("exchange");
        })
        .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""))
        .map((trade) => ({ trade, party: resolveParty(trade) }));

      // ── Build exchange map for TradingView links ─────────────────────────
      const exchangeMap = await loadExchangeMap();

      // ── Generate report HTML ─────────────────────────────────────────────
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const label = `Week of ${weekLabel(now)}`;

      // All per-run files go into a dated subdirectory
      const dateDir = path.join(webDir, dateStr);
      await fs.mkdir(dateDir, { recursive: true });

      const reportFile = "report.html";
      const reportRelPath = `${dateStr}/report.html`; // relative to webDir, used in manifest

      console.log(`\n📄 Building HTML report: ${dateStr}/report.html`);

      const topSymbols = report.summary.topByScore
        .slice(0, 8)
        .map((t) => t.trade.symbol)
        .filter((s): s is string => !!s);

      const html = buildHtmlReport({
        report,
        salesTrades,
        purchaseTrades,
        dateLabel: label,
        indexUrl: "../index.html",
        exchangeMap,
      });

      await fs.writeFile(path.join(dateDir, reportFile), html, "utf-8");
      console.log(`   Saved → ${path.join(dateDir, reportFile)}`);

      // ── Party pages ──────────────────────────────────────────────────────
      const allPartyTrades = [...purchaseTrades, ...salesTrades]
        .sort((a, b) => (b.trade.transactionDate ?? "").localeCompare(a.trade.transactionDate ?? ""));

      const partyGroups: Array<{ key: string; label: string; file: string }> = [
        { key: "r", label: "Republican", file: "party-republican.html" },
        { key: "d", label: "Democrat", file: "party-democrat.html" },
        { key: "i", label: "Independent", file: "party-independent.html" },
      ];

      for (const pg of partyGroups) {
        const filtered = allPartyTrades.filter(({ party }) => {
          const p = (party ?? "").toLowerCase();
          if (pg.key === "r") return p.startsWith("r");
          if (pg.key === "d") return p.startsWith("d");
          return p && !p.startsWith("r") && !p.startsWith("d");
        });
        if (!filtered.length) continue;
        const partyHtml = buildPartyPage({
          partyLabel: pg.label,
          trades: filtered,
          dateLabel: label,
          reportUrl: reportFile,
          indexUrl: "../index.html",
          exchangeMap,
        });
        await fs.writeFile(path.join(dateDir, pg.file), partyHtml, "utf-8");
        console.log(`   ${pg.label} → ${pg.file} (${filtered.length} trades)`);
      }

      // ── Member pages ──────────────────────────────────────────────────────
      type MemberKey = string;
      const memberMap = new Map<MemberKey, {
        name: string; chamber: string; party: string | undefined;
        trades: Array<{ trade: FMPTrade; party: string | undefined }>;
      }>();

      for (const item of allPartyTrades) {
        const { trade } = item;
        if (!trade.firstName && !trade.lastName) continue;
        const name = `${trade.firstName ?? ""} ${trade.lastName ?? ""}`.trim();
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (!memberMap.has(key)) {
          const chamber = report.scoredTrades.find(
            (t) => `${t.trade.firstName ?? ""} ${t.trade.lastName ?? ""}`.trim() === name
          )?.chamber === "senate" ? "Sen." : "Rep.";
          memberMap.set(key, { name, chamber, party: item.party, trades: [] });
        }
        memberMap.get(key)!.trades.push(item);
      }

      let memberCount = 0;
      for (const [key, member] of memberMap) {
        const memberFile = `member-${key}.html`;
        const memberHtml = buildMemberPage({
          memberName: member.name,
          chamber: member.chamber,
          party: member.party,
          trades: member.trades.sort((a, b) =>
            (b.trade.transactionDate ?? "").localeCompare(a.trade.transactionDate ?? "")
          ),
          dateLabel: label,
          reportUrl: reportFile,
          indexUrl: "../index.html",
          exchangeMap,
        });
        await fs.writeFile(path.join(dateDir, memberFile), memberHtml, "utf-8");
        memberCount++;
      }
      console.log(`   Members → ${memberCount} pages generated`);

      // ── Update manifest + rebuild index ──────────────────────────────────
      const manifest = await upsertManifest(webDir, {
        date: dateStr,
        dateLabel: label,
        file: reportRelPath,
        totalTrades: report.totalTradesAnalyzed,
        topSymbols,
      });

      const indexHtml = buildIndexPage(manifest);
      await fs.writeFile(path.join(webDir, "index.html"), indexHtml, "utf-8");
      console.log(`   Index → ${path.join(webDir, "index.html")} (${manifest.length} report${manifest.length !== 1 ? "s" : ""})`);

      // ── Publish to S3 ────────────────────────────────────────────────────
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
