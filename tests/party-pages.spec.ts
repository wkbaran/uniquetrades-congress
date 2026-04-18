import { test, expect } from "@playwright/test";

function buildPartyHtml(partyLabel: string, purchaseCount: number, saleCount: number): string {
  const purchaseRows = Array.from({ length: purchaseCount }, (_, i) => `
    <tr>
      <td class="sale-date">2026-04-${String(10 - i).padStart(2, "0")}</td>
      <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=SYM${i}" target="_blank" rel="noopener noreferrer">SYM${i}</a></td>
      <td class="sale-amount">$1,001 - $15,000</td>
      <td class="sale-trader">Trader ${i}</td>
      <td class="sale-desc">Asset ${i}</td>
    </tr>`).join("");

  const saleRows = Array.from({ length: saleCount }, (_, i) => `
    <tr>
      <td class="sale-date">2026-04-${String(10 - i).padStart(2, "0")}</td>
      <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=SAL${i}" target="_blank" rel="noopener noreferrer">SAL${i}</a></td>
      <td class="sale-amount">$15,001 - $50,000</td>
      <td class="sale-trader">Seller ${i}</td>
      <td class="sale-desc">Sold Asset ${i}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --text:#cdd6f4; --accent:#89b4fa; --border:#585b70;
        --surface:#313244; --muted:#6c7086; --radius:10px; }
body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; }
.site-title { font-size:1.1rem; font-weight:700; color:var(--accent); }
.section { margin-bottom:2rem; }
.section-title { font-size:1rem; font-weight:700; }
.stats-bar { display:flex; gap:0.75rem; background:var(--surface); padding:0.85rem 1rem; }
.stat-item { font-size:0.82rem; }
table { width:100%; border-collapse:collapse; }
th, td { padding:0.45rem 0.75rem; border-bottom:1px solid var(--border); }
.symbol-link { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>
<header>
  <div class="site-title">${partyLabel} Trades</div>
  <nav><a href="report.html">← Report</a> <a href="index.html">← Archive</a></nav>
</header>
<main>
  <div class="stats-bar">
    <span class="stat-item"><strong>${purchaseCount}</strong> purchases</span>
    <span class="stat-item">·</span>
    <span class="stat-item"><strong>${saleCount}</strong> sales</span>
    <span class="stat-item">·</span>
    <span class="stat-item"><strong>${purchaseCount + saleCount}</strong> total</span>
  </div>
  ${purchaseCount > 0 ? `
  <section class="section" id="purchases">
    <div class="section-header">
      <h2 class="section-title">Purchases</h2>
      <span class="section-count">${purchaseCount} trades</span>
    </div>
    <div class="sales-table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Symbol</th><th>Amount</th><th>Trader</th><th>Asset</th></tr></thead>
        <tbody>${purchaseRows}</tbody>
      </table>
    </div>
  </section>` : ""}
  ${saleCount > 0 ? `
  <section class="section" id="sales">
    <div class="section-header">
      <h2 class="section-title">Sales</h2>
      <span class="section-count">${saleCount} trades</span>
    </div>
    <div class="sales-table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Symbol</th><th>Amount</th><th>Trader</th><th>Asset</th></tr></thead>
        <tbody>${saleRows}</tbody>
      </table>
    </div>
  </section>` : ""}
</main>
</body>
</html>`;
}

const REPUBLICAN_HTML = buildPartyHtml("Republican", 3, 2);
const DEMOCRAT_HTML = buildPartyHtml("Democrat", 4, 1);
const INDEPENDENT_HTML = buildPartyHtml("Independent", 1, 0);

test("party page shows party name in title", async ({ page }) => {
  await page.setContent(REPUBLICAN_HTML);
  await expect(page.locator(".site-title")).toContainText("Republican");
});

test("party page has Purchases and Sales sections", async ({ page }) => {
  await page.setContent(REPUBLICAN_HTML);
  await expect(page.locator("#purchases .section-title")).toHaveText("Purchases");
  await expect(page.locator("#sales .section-title")).toHaveText("Sales");
});

test("stats bar shows correct purchase and sale counts", async ({ page }) => {
  await page.setContent(REPUBLICAN_HTML);
  const statText = await page.locator(".stats-bar").textContent();
  expect(statText).toContain("3");
  expect(statText).toContain("2");
});

test("purchases section has correct row count", async ({ page }) => {
  await page.setContent(REPUBLICAN_HTML);
  await expect(page.locator("#purchases tbody tr")).toHaveCount(3);
});

test("sales section has correct row count", async ({ page }) => {
  await page.setContent(REPUBLICAN_HTML);
  await expect(page.locator("#sales tbody tr")).toHaveCount(2);
});

test("symbol links in party page point to TradingView", async ({ page }) => {
  await page.setContent(DEMOCRAT_HTML);
  const links = page.locator(".symbol-link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    expect(href).toContain("tradingview.com");
  }
});

test("party page with no sales omits sales section", async ({ page }) => {
  await page.setContent(INDEPENDENT_HTML);
  await expect(page.locator("#purchases")).toBeVisible();
  await expect(page.locator("#sales")).toHaveCount(0);
});

test("party page has back link to report", async ({ page }) => {
  await page.setContent(REPUBLICAN_HTML);
  const reportLink = page.locator('a[href="report.html"]');
  await expect(reportLink).toBeVisible();
});
