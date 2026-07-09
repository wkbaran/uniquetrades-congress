/**
 * diff-providers.mjs
 *
 * Compares scored analysis output between the FMP and open-data (EDGAR/StockWatcher)
 * providers to validate parity before Phase 4 cutover.
 *
 * Usage:
 *   node scripts/diff-providers.mjs
 *
 * Reads the two most recent report files from data/reports/:
 *   unique-trades-fmp-*.json   (generated with DATA_SOURCE=fmp)
 *   unique-trades-open-*.json  (generated with DATA_SOURCE=open)
 *
 * Alternatively, pass paths directly:
 *   node scripts/diff-providers.mjs path/to/fmp.json path/to/open.json
 */

import * as fs from "fs";
import * as path from "path";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

function findLatest(prefix) {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? path.join(REPORTS_DIR, files[0]) : null;
}

function loadReport(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  // Stored reports are wrapped in { fetchedAt, data }
  return raw.data ?? raw;
}

function tradeKey(trade) {
  return [
    (trade.firstName || "").toLowerCase(),
    (trade.lastName || "").toLowerCase(),
    trade.transactionDate || "",
    (trade.symbol || "").toUpperCase(),
    (trade.type || "").toLowerCase(),
  ].join("|");
}

function run(fmpPath, openPath) {
  console.log(`\nFMP  report: ${fmpPath}`);
  console.log(`Open report: ${openPath}\n`);

  const fmpReport = loadReport(fmpPath);
  const openReport = loadReport(openPath);

  const fmpTrades = fmpReport.scoredTrades ?? [];
  const openTrades = openReport.scoredTrades ?? [];

  // Build score maps keyed by trade identity
  const fmpMap = new Map(fmpTrades.map((st) => [tradeKey(st.trade), st]));
  const openMap = new Map(openTrades.map((st) => [tradeKey(st.trade), st]));

  const allKeys = new Set([...fmpMap.keys(), ...openMap.keys()]);
  const onlyInFmp = [];
  const onlyInOpen = [];
  const inBoth = [];

  for (const key of allKeys) {
    if (fmpMap.has(key) && openMap.has(key)) {
      inBoth.push(key);
    } else if (fmpMap.has(key)) {
      onlyInFmp.push(key);
    } else {
      onlyInOpen.push(key);
    }
  }

  const pct = (n, d) => d === 0 ? "N/A" : `${((n / d) * 100).toFixed(1)}%`;

  console.log("── Trade coverage ───────────────────────────────────────");
  console.log(`  FMP total:       ${fmpTrades.length}`);
  console.log(`  Open total:      ${openTrades.length}`);
  console.log(`  In both:         ${inBoth.length} (${pct(inBoth.length, fmpTrades.length)} of FMP)`);
  console.log(`  Only in FMP:     ${onlyInFmp.length}`);
  console.log(`  Only in open:    ${onlyInOpen.length}`);

  // Score divergence on shared trades
  let totalDiff = 0;
  const bigDiffs = [];

  for (const key of inBoth) {
    const fmpScore = fmpMap.get(key).score.overallScore;
    const openScore = openMap.get(key).score.overallScore;
    const diff = Math.abs(fmpScore - openScore);
    totalDiff += diff;
    if (diff > 5) {
      const t = fmpMap.get(key).trade;
      bigDiffs.push({ key, fmpScore, openScore, diff, symbol: t.symbol, name: `${t.firstName} ${t.lastName}` });
    }
  }

  const meanDiff = inBoth.length > 0 ? (totalDiff / inBoth.length).toFixed(2) : "N/A";

  console.log("\n── Score divergence (shared trades) ─────────────────────");
  console.log(`  Mean |Δscore|:   ${meanDiff} points`);
  console.log(`  Trades with |Δ| > 5:  ${bigDiffs.length}`);

  if (bigDiffs.length > 0) {
    console.log("\n  Large divergences:");
    bigDiffs.sort((a, b) => b.diff - a.diff).slice(0, 10).forEach(({ symbol, name, fmpScore, openScore, diff }) => {
      console.log(`    ${symbol} (${name}): FMP=${fmpScore} Open=${openScore} Δ=${diff}`);
    });
  }

  // Committee overlap divergence
  const fmpWithCommittee = fmpTrades.filter(
    (st) => st.score.flags?.hasCommitteeRelevance
  ).length;
  const openWithCommittee = openTrades.filter(
    (st) => st.score.flags?.hasCommitteeRelevance
  ).length;

  console.log("\n── Committee overlap (sector matching) ──────────────────");
  console.log(`  FMP trades with committee flag:  ${fmpWithCommittee}`);
  console.log(`  Open trades with committee flag: ${openWithCommittee}`);

  // Pass/fail summary
  const coverageOk = inBoth.length / Math.max(fmpTrades.length, 1) >= 0.95;
  const scoreOk = parseFloat(meanDiff) <= 5 || meanDiff === "N/A";

  console.log("\n── Verdict ──────────────────────────────────────────────");
  console.log(`  Coverage ≥ 95%:  ${coverageOk ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Mean Δ ≤ 5pts:   ${scoreOk ? "✅ PASS" : "❌ FAIL"}`);
  console.log(
    `\n  ${coverageOk && scoreOk ? "✅ Ready to proceed to Phase 4 cutover." : "⚠️  Review differences before cutting over."}`
  );
}

// ── Entry point ──────────────────────────────────────────────────────────────

let [fmpPath, openPath] = process.argv.slice(2);

if (!fmpPath) fmpPath = findLatest("unique-trades-fmp-");
if (!openPath) openPath = findLatest("unique-trades-open-");

if (!fmpPath || !openPath || !fs.existsSync(fmpPath) || !fs.existsSync(openPath)) {
  console.error("❌ Could not find report files.");
  console.error("   Run the pipeline twice with DATA_SOURCE=fmp and DATA_SOURCE=open,");
  console.error("   then re-run this script.");
  process.exit(1);
}

run(fmpPath, openPath);
