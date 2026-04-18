import type { AnalysisReport, AnalyzedTrade } from "../services/analysis-service.js";
import type { FMPTrade } from "../types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreClass(score: number): string {
  if (score >= 70) return "score-high";
  if (score >= 50) return "score-med";
  return "score-low";
}

function partyClass(party: string | undefined): string {
  if (!party) return "";
  const p = party.toLowerCase();
  if (p.startsWith("r")) return "party-r";
  if (p.startsWith("d")) return "party-d";
  return "";
}

function partyLabel(party: string | undefined): string {
  if (!party) return "";
  if (party.toLowerCase().startsWith("r")) return "R";
  if (party.toLowerCase().startsWith("d")) return "D";
  return party.charAt(0);
}

function formatAmount(amount: string | undefined): string {
  if (!amount) return "N/A";
  return amount.replace(/\$(\d+),(\d+)/g, (_, a, b) => `$${a},${b}`);
}

function typeLabel(type: string | undefined): string {
  if (!type) return "N/A";
  const t = type.toLowerCase();
  if (t.includes("purchase")) return "Buy";
  if (t.includes("sale")) return "Sell";
  if (t.includes("exchange")) return "Exchange";
  return type;
}

function typeClass(type: string | undefined): string {
  if (!type) return "";
  const t = type.toLowerCase();
  if (t.includes("purchase") || t.includes("exchange")) return "type-buy";
  if (t.includes("sale")) return "type-sell";
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Card rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderTradeCard(analyzed: AnalyzedTrade): string {
  const { trade, trader, score } = analyzed;
  const sym = esc(trade.symbol || "N/A");
  const desc = esc(trade.assetDescription || "");
  const name = esc(`${trade.firstName ?? ""} ${trade.lastName ?? ""}`.trim());
  const chamber = esc(analyzed.chamber === "senate" ? "Sen." : "Rep.");
  const party = partyLabel(trader.party);
  const pClass = partyClass(trader.party);
  const tLabel = typeLabel(trade.type);
  const tClass = typeClass(trade.type);
  const date = esc(trade.transactionDate || "");
  const amount = esc(formatAmount(trade.amount));
  const sClass = scoreClass(score.overallScore);
  const overall = score.overallScore;

  // Factor badges
  const badges: string[] = [];
  if (score.flags.isRareStock) badges.push('<span class="badge badge-rare">Rare</span>');
  if (score.flags.isHighConviction) badges.push('<span class="badge badge-conviction">High Conviction</span>');
  if (score.flags.hasCommitteeRelevance) badges.push('<span class="badge badge-committee">Committee</span>');
  if (score.flags.isDerivative) badges.push('<span class="badge badge-derivative">Derivative</span>');
  if (score.flags.isSmallCap) badges.push('<span class="badge badge-smallcap">Small Cap</span>');
  if (score.flags.isIndirectOwnership) badges.push('<span class="badge badge-indirect">Indirect</span>');

  // Score explanation lines
  const details: string[] = [];
  if (score.explanation.marketCap) {
    const cap = score.explanation.marketCap;
    const capM = (cap.value / 1_000_000).toFixed(0);
    details.push(`<li>Market cap: $${capM}M <em>(${esc(cap.category)})</em></li>`);
  }
  if (score.explanation.conviction && score.flags.isHighConviction) {
    const m = score.explanation.conviction.multiplier.toFixed(1);
    details.push(`<li>Conviction: ${m}× typical trade</li>`);
  }
  if (score.explanation.rarity) {
    const r = score.explanation.rarity;
    details.push(`<li>Rarity: ${esc(r.category)} (${r.totalCongressTrades} congress trade${r.totalCongressTrades !== 1 ? "s" : ""})</li>`);
  }
  if (score.flags.hasCommitteeRelevance && score.explanation.committeeRelevance) {
    const rel = score.explanation.committeeRelevance;
    const sector = [rel.stockSector, rel.stockIndustry].filter(Boolean).join(" / ");
    details.push(`<li class="detail-warning">Committee oversight: ${esc(sector)}</li>`);
    if (rel.overlappingCommittees.length) {
      details.push(`<li class="detail-warning">Committees: ${esc(rel.overlappingCommittees.join(", "))}</li>`);
    }
  }
  if (score.flags.isDerivative && score.explanation.derivative) {
    details.push(`<li>Asset type: ${esc(score.explanation.derivative.assetType)}</li>`);
  }
  if (score.flags.isIndirectOwnership && score.explanation.ownership) {
    details.push(`<li>Ownership: ${esc(score.explanation.ownership.owner)}</li>`);
  }

  const detailsHtml = details.length
    ? `<ul class="trade-details">${details.join("")}</ul>`
    : "";

  const badgesHtml = badges.length
    ? `<div class="badge-row">${badges.join("")}</div>`
    : "";

  return `
<article class="trade-card">
  <div class="card-top">
    <div class="symbol-block">
      <span class="symbol">${sym}</span>
      <span class="trade-type ${tClass}">${tLabel}</span>
    </div>
    <span class="score-badge ${sClass}">${overall}</span>
  </div>
  ${desc ? `<p class="asset-desc">${desc}</p>` : ""}
  <div class="trader-row">
    <span class="trader-name">${chamber} ${name}</span>
    ${party ? `<span class="party-tag ${pClass}">${party}</span>` : ""}
  </div>
  <div class="meta-row">
    <span class="amount">${amount}</span>
    <span class="date">${date}</span>
  </div>
  ${badgesHtml}
  ${detailsHtml}
</article>`;
}

function renderSaleRow(trade: FMPTrade, party: string | undefined): string {
  const sym = esc(trade.symbol || "N/A");
  const name = esc(`${trade.firstName ?? ""} ${trade.lastName ?? ""}`.trim());
  const chamber = trade.firstName ? "" : "";
  const pLabel = partyLabel(party);
  const pClass = partyClass(party);
  const amount = esc(formatAmount(trade.amount));
  const date = esc(trade.transactionDate || "");
  const desc = esc(trade.assetDescription || "");
  const owner = trade.owner && trade.owner.toLowerCase() !== "self" ? esc(trade.owner) : "";

  return `
<tr>
  <td class="sale-date">${date}</td>
  <td class="sale-sym">${sym}</td>
  <td class="sale-amount">${amount}</td>
  <td class="sale-trader">${name}${pLabel ? ` <span class="party-tag ${pClass}">${pLabel}</span>` : ""}${owner ? ` <span class="owner-tag">${owner}</span>` : ""}</td>
  <td class="sale-desc">${desc}</td>
</tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --bg: #1e1e2e;
    --surface: #313244;
    --surface2: #45475a;
    --border: #585b70;
    --text: #cdd6f4;
    --subtext: #a6adc8;
    --muted: #6c7086;
    --accent: #89b4fa;
    --green: #a6e3a1;
    --red: #f38ba8;
    --yellow: #f9e2af;
    --peach: #fab387;
    --mauve: #cba6f7;
    --teal: #94e2d5;
    --score-high: #a6e3a1;
    --score-med: #f9e2af;
    --score-low: #6c7086;
    --party-r: #f38ba8;
    --party-d: #89b4fa;
    --radius: 10px;
    --shadow: 0 2px 12px rgba(0,0,0,0.4);
  }
  [data-theme="light"] {
    --bg: #eff1f5;
    --surface: #e6e9ef;
    --surface2: #dce0e8;
    --border: #bcc0cc;
    --text: #4c4f69;
    --subtext: #5c5f77;
    --muted: #9ca0b0;
    --accent: #1e66f5;
    --green: #40a02b;
    --red: #d20f39;
    --yellow: #df8e1d;
    --peach: #fe640b;
    --mauve: #8839ef;
    --teal: #179299;
    --score-high: #40a02b;
    --score-med: #df8e1d;
    --score-low: #9ca0b0;
    --party-r: #d20f39;
    --party-d: #1e66f5;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', system-ui, sans-serif;
    line-height: 1.5;
    min-height: 100vh;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Header */
  .site-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .site-title { font-size: 1.1rem; font-weight: 700; color: var(--accent); letter-spacing: 0.02em; }
  .site-subtitle { font-size: 0.8rem; color: var(--subtext); margin-top: 0.15rem; }
  .header-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
  .theme-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background 0.15s;
  }
  .theme-btn:hover { background: var(--border); }

  /* Main content */
  main { max-width: 1300px; margin: 0 auto; padding: 1.5rem; }

  /* Section */
  .section { margin-bottom: 2.5rem; }
  .section-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .section-title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .section-count { font-size: 0.8rem; color: var(--muted); }

  /* Stats bar */
  .stats-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
  }
  .stat-item { font-size: 0.82rem; color: var(--subtext); }
  .stat-item strong { color: var(--text); }
  .stat-sep { color: var(--border); user-select: none; }

  /* Trade card grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }
  .trade-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .symbol-block { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .symbol { font-size: 1.1rem; font-weight: 800; color: var(--accent); letter-spacing: 0.04em; }
  .trade-type {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .type-buy { background: rgba(166,227,161,0.15); color: var(--green); border: 1px solid rgba(166,227,161,0.3); }
  .type-sell { background: rgba(243,139,168,0.15); color: var(--red); border: 1px solid rgba(243,139,168,0.3); }

  .score-badge {
    font-size: 1rem;
    font-weight: 800;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .score-high { background: rgba(166,227,161,0.2); color: var(--score-high); }
  .score-med  { background: rgba(249,226,175,0.2); color: var(--score-med); }
  .score-low  { background: rgba(108,112,134,0.15); color: var(--score-low); }

  .asset-desc { font-size: 0.78rem; color: var(--subtext); }

  .trader-row { display: flex; align-items: center; gap: 0.5rem; }
  .trader-name { font-size: 0.88rem; font-weight: 600; }

  .party-tag {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }
  .party-r { background: rgba(243,139,168,0.2); color: var(--party-r); }
  .party-d { background: rgba(137,180,250,0.2); color: var(--party-d); }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
    color: var(--subtext);
  }
  .amount { font-weight: 500; }

  .badge-row { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.25rem; }
  .badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .badge-rare       { background: rgba(203,166,247,0.2); color: var(--mauve); }
  .badge-conviction { background: rgba(250,179,135,0.2); color: var(--peach); }
  .badge-committee  { background: rgba(243,139,168,0.2); color: var(--red); }
  .badge-derivative { background: rgba(148,226,213,0.2); color: var(--teal); }
  .badge-smallcap   { background: rgba(249,226,175,0.2); color: var(--yellow); }
  .badge-indirect   { background: rgba(108,112,134,0.2); color: var(--muted); }

  .trade-details {
    list-style: none;
    font-size: 0.77rem;
    color: var(--subtext);
    border-top: 1px solid var(--border);
    padding-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .trade-details li { padding-left: 0.75rem; position: relative; }
  .trade-details li::before { content: "·"; position: absolute; left: 0; }
  .detail-warning { color: var(--red) !important; }

  /* Sales table */
  .sales-table-wrap { overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.83rem;
  }
  th {
    text-align: left;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid var(--surface2);
    vertical-align: top;
  }
  tr:hover td { background: var(--surface2); }
  .sale-date  { white-space: nowrap; color: var(--subtext); width: 7rem; }
  .sale-sym   { font-weight: 700; color: var(--accent); width: 5rem; }
  .sale-amount { white-space: nowrap; color: var(--subtext); }
  .sale-trader { white-space: nowrap; }
  .sale-desc  { color: var(--muted); font-size: 0.75rem; }
  .owner-tag  { font-size: 0.65rem; color: var(--muted); border: 1px solid var(--border); border-radius: 3px; padding: 0.05rem 0.35rem; margin-left: 0.25rem; }

  /* Footer */
  footer {
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted);
    padding: 2rem 1rem;
    border-top: 1px solid var(--border);
    margin-top: 2rem;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .site-header { flex-direction: column; align-items: flex-start; }
    .card-grid { grid-template-columns: 1fr; }
    .stats-bar { flex-direction: column; gap: 0.4rem; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// JS
// ─────────────────────────────────────────────────────────────────────────────

const JS = `
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme-btn');
  const saved = localStorage.getItem('congress-theme');
  if (saved) root.setAttribute('data-theme', saved);

  function updateLabel() {
    const current = root.getAttribute('data-theme');
    if (btn) btn.textContent = current === 'light' ? '🌙 Dark' : '☀️ Light';
  }
  updateLabel();

  if (btn) {
    btn.addEventListener('click', function () {
      const current = root.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next === 'dark' ? '' : 'light');
      localStorage.setItem('congress-theme', next === 'dark' ? '' : 'light');
      updateLabel();
    });
  }
})();
`;

// ─────────────────────────────────────────────────────────────────────────────
// Main page builder
// ─────────────────────────────────────────────────────────────────────────────

export interface HtmlReportOptions {
  report: AnalysisReport;
  /** All sales trades (sorted by date descending) */
  salesTrades: Array<{ trade: FMPTrade; party: string | undefined }>;
  /** Title date label, e.g. "Week of April 13, 2026" */
  dateLabel: string;
  /** Link back to the index page */
  indexUrl?: string;
}

export function buildHtmlReport(opts: HtmlReportOptions): string {
  const { report, salesTrades, dateLabel, indexUrl } = opts;

  // Top purchases (score >= 40, sorted by score desc)
  const topPurchases = [...report.scoredTrades]
    .filter((t) => {
      const type = (t.trade.type || "").toLowerCase();
      return type.includes("purchase") || type.includes("exchange");
    })
    .sort((a, b) => b.score.overallScore - a.score.overallScore)
    .slice(0, 30);

  // Committee-relevant trades (any type)
  const committeeRelevant = report.summary.byCommitteeRelevance.slice(0, 20);

  const dateRange = (() => {
    const dates = report.scoredTrades
      .map((t) => t.trade.transactionDate)
      .filter((d): d is string => !!d)
      .sort();
    if (!dates.length) return "";
    return dates[0] === dates[dates.length - 1]
      ? dates[0]
      : `${dates[0]} – ${dates[dates.length - 1]}`;
  })();

  const navLink = indexUrl
    ? `<a href="${esc(indexUrl)}">← Archive</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Congress Trades — ${esc(dateLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>${CSS}</style>
</head>
<body>

<header class="site-header">
  <div>
    <div class="site-title">Congress Trades</div>
    <div class="site-subtitle">${esc(dateLabel)}${dateRange ? ` &nbsp;·&nbsp; ${esc(dateRange)}` : ""}</div>
  </div>
  <div class="header-right">
    ${navLink}
    <button class="theme-btn" id="theme-btn">☀️ Light</button>
  </div>
</header>

<main>

  <!-- Stats bar -->
  <div class="stats-bar">
    <span class="stat-item"><strong>${report.totalTradesAnalyzed}</strong> trades analyzed</span>
    <span class="stat-sep">·</span>
    <span class="stat-item"><strong>${topPurchases.length}</strong> notable purchases</span>
    <span class="stat-sep">·</span>
    <span class="stat-item"><strong>${salesTrades.length}</strong> sales</span>
    <span class="stat-sep">·</span>
    <span class="stat-item"><strong>${committeeRelevant.length}</strong> committee-relevant</span>
    <span class="stat-sep">·</span>
    <span class="stat-item">Generated ${new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
  </div>

  <!-- Top Purchases -->
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Top Purchases by Uniqueness Score</h2>
      <span class="section-count">${topPurchases.length} trades</span>
    </div>
    <div class="card-grid">
      ${topPurchases.map(renderTradeCard).join("\n      ")}
    </div>
  </section>

  ${committeeRelevant.length > 0 ? `
  <!-- Committee-Relevant Trades -->
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Committee-Relevant Trades</h2>
      <span class="section-count">${committeeRelevant.length} trades — traders with committee oversight of the stock's sector</span>
    </div>
    <div class="card-grid">
      ${committeeRelevant.map(renderTradeCard).join("\n      ")}
    </div>
  </section>
  ` : ""}

  <!-- Recent Sales -->
  ${salesTrades.length > 0 ? `
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Recent Sales</h2>
      <span class="section-count">${salesTrades.length} trades</span>
    </div>
    <div class="sales-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Symbol</th>
            <th>Amount</th>
            <th>Trader</th>
            <th>Asset</th>
          </tr>
        </thead>
        <tbody>
          ${salesTrades.map(({ trade, party }) => renderSaleRow(trade, party)).join("\n          ")}
        </tbody>
      </table>
    </div>
  </section>
  ` : ""}

</main>

<footer>
  Data sourced from the Financial Modeling Prep API and congress-legislators.
  Scores reflect uniqueness signals; not investment advice.
</footer>

<script>${JS}</script>
</body>
</html>`;
}
