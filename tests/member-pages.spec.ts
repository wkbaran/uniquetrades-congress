import { test, expect } from "@playwright/test";

const MEMBER_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --text:#cdd6f4; --accent:#89b4fa; --border:#585b70;
        --surface:#313244; --muted:#6c7086; --party-r:#f38ba8; --party-d:#89b4fa; }
body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; }
.site-title { font-size:1.1rem; font-weight:700; color:var(--accent); }
.party-tag { font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px; }
.party-r { background:rgba(243,139,168,0.2); color:var(--party-r); }
.party-d { background:rgba(137,180,250,0.2); color:var(--party-d); }
.stats-bar { display:flex; gap:0.75rem; background:var(--surface); padding:0.85rem 1rem; }
.stat-item { font-size:0.82rem; }
.section { margin-bottom:2rem; }
.section-title { font-size:1rem; font-weight:700; }
table { width:100%; border-collapse:collapse; }
th, td { padding:0.45rem 0.75rem; border-bottom:1px solid var(--border); }
.symbol-link { color:var(--accent); text-decoration:none; }
.owner-tag { font-size:0.65rem; color:var(--muted); border:1px solid var(--border); border-radius:3px; padding:0.05rem 0.35rem; }
</style>
</head>
<body>
<header>
  <div class="site-title">Sen. Jane Smith <span class="party-tag party-d">D</span></div>
  <nav><a href="report-2026-04-18.html">← Report</a> &nbsp;·&nbsp; <a href="index.html">← Archive</a></nav>
</header>
<main>
  <div class="stats-bar">
    <span class="stat-item"><strong>3</strong> purchases</span>
    <span class="stat-item">·</span>
    <span class="stat-item"><strong>1</strong> sales</span>
    <span class="stat-item">·</span>
    <span class="stat-item"><strong>4</strong> total</span>
  </div>

  <section class="section" id="purchases">
    <div class="section-header">
      <h2 class="section-title">Purchases</h2>
      <span class="section-count">3 trades</span>
    </div>
    <div class="sales-table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Symbol</th><th>Amount</th><th>Asset</th></tr></thead>
        <tbody>
          <tr>
            <td class="sale-date">2026-04-10</td>
            <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NASDAQ%3AMSFT" target="_blank" rel="noopener noreferrer">MSFT</a></td>
            <td class="sale-amount">$1,001 - $15,000</td>
            <td class="sale-desc">Microsoft Corporation</td>
          </tr>
          <tr>
            <td class="sale-date">2026-04-08</td>
            <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NYSE%3AIBM" target="_blank" rel="noopener noreferrer">IBM</a></td>
            <td class="sale-amount">$15,001 - $50,000</td>
            <td class="sale-desc">IBM Corp <span class="owner-tag">Spouse</span></td>
          </tr>
          <tr>
            <td class="sale-date">2026-04-05</td>
            <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=AAPL" target="_blank" rel="noopener noreferrer">AAPL</a></td>
            <td class="sale-amount">$50,001 - $100,000</td>
            <td class="sale-desc">Apple Inc.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="section" id="sales">
    <div class="section-header">
      <h2 class="section-title">Sales</h2>
      <span class="section-count">1 trades</span>
    </div>
    <div class="sales-table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Symbol</th><th>Amount</th><th>Asset</th></tr></thead>
        <tbody>
          <tr>
            <td class="sale-date">2026-04-09</td>
            <td class="sale-sym"><a class="symbol-link" href="https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA" target="_blank" rel="noopener noreferrer">NVDA</a></td>
            <td class="sale-amount">$100,001 - $250,000</td>
            <td class="sale-desc">NVIDIA Corp</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;

test("member page shows member name with chamber prefix", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  await expect(page.locator(".site-title")).toContainText("Sen. Jane Smith");
});

test("member page shows party tag", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  await expect(page.locator(".party-tag")).toContainText("D");
});

test("member page has Purchases section", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  await expect(page.locator("#purchases .section-title")).toHaveText("Purchases");
});

test("member page has Sales section", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  await expect(page.locator("#sales .section-title")).toHaveText("Sales");
});

test("member purchases have 4 columns (no Trader column)", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  const headers = page.locator("#purchases thead th");
  await expect(headers).toHaveCount(4);
  const texts = await headers.allTextContents();
  expect(texts).toEqual(["Date", "Symbol", "Amount", "Asset"]);
});

test("member page stats show correct totals", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  const statsText = await page.locator(".stats-bar").textContent();
  expect(statsText).toContain("3");
  expect(statsText).toContain("1");
  expect(statsText).toContain("4");
});

test("member symbol links open TradingView in new tab", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  const links = page.locator(".symbol-link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    expect(await links.nth(i).getAttribute("href")).toContain("tradingview.com");
    expect(await links.nth(i).getAttribute("target")).toBe("_blank");
  }
});

test("indirect ownership shows owner-tag", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  await expect(page.locator(".owner-tag")).toContainText("Spouse");
});

test("member page has back links to report and archive", async ({ page }) => {
  await page.setContent(MEMBER_HTML);
  await expect(page.locator('a[href="report-2026-04-18.html"]')).toBeVisible();
  await expect(page.locator('a[href="index.html"]')).toBeVisible();
});
