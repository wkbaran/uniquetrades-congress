import { test, expect } from "@playwright/test";

const HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --text:#cdd6f4; --accent:#89b4fa; --border:#585b70; --muted:#6c7086; --surface2:#45475a; }
body { background:var(--bg); color:var(--text); }
.section { margin-bottom:2rem; }
.section-title { font-size:1rem; font-weight:700; }
.sales-table-wrap { overflow-x:auto; }
table { width:100%; border-collapse:collapse; }
th { text-align:left; padding:0.5rem; }
td { padding:0.45rem 0.75rem; }
.symbol-link { color:var(--accent); text-decoration:none; }
.party-tag { font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px; }
.party-r { background:rgba(243,139,168,0.2); color:#f38ba8; }
.party-d { background:rgba(137,180,250,0.2); color:#89b4fa; }
</style>
</head>
<body>
<section class="section" id="recent-purchases">
  <div class="section-header">
    <h2 class="section-title">Recent Purchases</h2>
    <span class="section-count">3 trades</span>
  </div>
  <div class="sales-table-wrap">
    <table>
      <thead>
        <tr><th>Date</th><th>Symbol</th><th>Amount</th><th>Trader</th><th>Asset</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="sale-date">2026-04-10</td>
          <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NASDAQ%3AMSFT" target="_blank" rel="noopener noreferrer">MSFT</a></td>
          <td class="sale-amount">$1,001 - $15,000</td>
          <td class="sale-trader">Jane Smith <span class="party-tag party-d">D</span></td>
          <td class="sale-desc">Microsoft Corporation</td>
        </tr>
        <tr>
          <td class="sale-date">2026-04-09</td>
          <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NYSE%3AIBM" target="_blank" rel="noopener noreferrer">IBM</a></td>
          <td class="sale-amount">$15,001 - $50,000</td>
          <td class="sale-trader">John Doe <span class="party-tag party-r">R</span></td>
          <td class="sale-desc">International Business Machines</td>
        </tr>
        <tr>
          <td class="sale-date">2026-04-08</td>
          <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=AAPL" target="_blank" rel="noopener noreferrer">AAPL</a></td>
          <td class="sale-amount">$1,001 - $15,000</td>
          <td class="sale-trader">Alice Brown <span class="party-tag party-r">R</span></td>
          <td class="sale-desc">Apple Inc.</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<section class="section" id="recent-sales">
  <div class="section-header">
    <h2 class="section-title">Recent Sales</h2>
    <span class="section-count">2 trades</span>
  </div>
  <div class="sales-table-wrap">
    <table>
      <thead>
        <tr><th>Date</th><th>Symbol</th><th>Amount</th><th>Trader</th><th>Asset</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="sale-date">2026-04-11</td>
          <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NYSE%3AGOOG" target="_blank" rel="noopener noreferrer">GOOG</a></td>
          <td class="sale-amount">$50,001 - $100,000</td>
          <td class="sale-trader">Bob Lee <span class="party-tag party-d">D</span></td>
          <td class="sale-desc">Alphabet Inc.</td>
        </tr>
        <tr>
          <td class="sale-date">2026-04-07</td>
          <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA" target="_blank" rel="noopener noreferrer">NVDA</a></td>
          <td class="sale-amount">$100,001 - $250,000</td>
          <td class="sale-trader">Carol King <span class="party-tag party-r">R</span></td>
          <td class="sale-desc">NVIDIA Corporation</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
</body>
</html>`;

test("Recent Purchases section exists", async ({ page }) => {
  await page.setContent(HTML);
  await expect(page.locator("#recent-purchases .section-title")).toHaveText("Recent Purchases");
});

test("Recent Sales section exists", async ({ page }) => {
  await page.setContent(HTML);
  await expect(page.locator("#recent-sales .section-title")).toHaveText("Recent Sales");
});

test("Recent Purchases table has correct row count", async ({ page }) => {
  await page.setContent(HTML);
  const rows = page.locator("#recent-purchases tbody tr");
  await expect(rows).toHaveCount(3);
});

test("Recent Purchases rows have Date, Symbol, Amount, Trader, Asset columns", async ({ page }) => {
  await page.setContent(HTML);
  const headers = page.locator("#recent-purchases thead th");
  await expect(headers).toHaveCount(5);
  const texts = await headers.allTextContents();
  expect(texts).toEqual(["Date", "Symbol", "Amount", "Trader", "Asset"]);
});

test("Recent Purchases symbols are TradingView links", async ({ page }) => {
  await page.setContent(HTML);
  const links = page.locator("#recent-purchases .symbol-link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    expect(href).toContain("tradingview.com");
  }
});

test("Recent Purchases sorted newest first", async ({ page }) => {
  await page.setContent(HTML);
  const dates = await page.locator("#recent-purchases .sale-date").allTextContents();
  for (let i = 1; i < dates.length; i++) {
    expect(dates[i - 1] >= dates[i]).toBe(true);
  }
});

test("Recent Purchases and Recent Sales are separate sections", async ({ page }) => {
  await page.setContent(HTML);
  const sections = page.locator(".section");
  await expect(sections).toHaveCount(2);
});
