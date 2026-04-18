import { test, expect } from "@playwright/test";

// HTML with two trade cards — one with known exchange (NASDAQ), one without
const REPORT_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --text:#cdd6f4; --accent:#89b4fa; }
body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; }
.trade-card { padding:1rem; margin-bottom:1rem; border:1px solid #585b70; border-radius:8px; }
.symbol { font-size:1.1rem; font-weight:800; }
.symbol-link { color:var(--accent); text-decoration:none; }
.symbol-link:hover { text-decoration:underline; }
.sale-sym a { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>

<!-- Card with NASDAQ exchange prefix -->
<article class="trade-card" data-symbol="AAPL">
  <div class="symbol-block">
    <span class="symbol">
      <a class="symbol-link"
         href="https://www.tradingview.com/chart/?symbol=NASDAQ%3AAPPL"
         target="_blank" rel="noopener noreferrer">AAPL</a>
    </span>
  </div>
</article>

<!-- Card with NYSE exchange prefix -->
<article class="trade-card" data-symbol="IBM">
  <div class="symbol-block">
    <span class="symbol">
      <a class="symbol-link"
         href="https://www.tradingview.com/chart/?symbol=NYSE%3AIBM"
         target="_blank" rel="noopener noreferrer">IBM</a>
    </span>
  </div>
</article>

<!-- Card with no exchange info (symbol only) -->
<article class="trade-card" data-symbol="XYZW">
  <div class="symbol-block">
    <span class="symbol">
      <a class="symbol-link"
         href="https://www.tradingview.com/chart/?symbol=XYZW"
         target="_blank" rel="noopener noreferrer">XYZW</a>
    </span>
  </div>
</article>

<!-- Sales table with symbol links -->
<table>
  <tbody>
    <tr>
      <td class="sale-sym">
        <a class="symbol-link"
           href="https://www.tradingview.com/chart/?symbol=NASDAQ%3AMSFT"
           target="_blank" rel="noopener noreferrer">MSFT</a>
      </td>
    </tr>
  </tbody>
</table>

</body>
</html>`;

test("trade card symbols are links", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const links = page.locator(".trade-card .symbol-link");
  await expect(links).toHaveCount(3);
});

test("symbol links point to TradingView", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const links = page.locator(".symbol-link");
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    expect(href).toContain("tradingview.com");
  }
});

test("NASDAQ exchange prefix is included when exchange is known", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const aaplLink = page.locator('[data-symbol="AAPL"] .symbol-link');
  const href = await aaplLink.getAttribute("href");
  expect(href).toContain("NASDAQ");
});

test("NYSE exchange prefix is included for NYSE stocks", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const ibmLink = page.locator('[data-symbol="IBM"] .symbol-link');
  const href = await ibmLink.getAttribute("href");
  expect(href).toContain("NYSE");
});

test("symbol-only URL used when exchange is unknown", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const unknownLink = page.locator('[data-symbol="XYZW"] .symbol-link');
  const href = await unknownLink.getAttribute("href");
  expect(href).toContain("XYZW");
  expect(href).not.toMatch(/[A-Z]+:[A-Z]/); // no "EXCHANGE:SYM" pattern
});

test("symbol links open in new tab", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const link = page.locator(".symbol-link").first();
  expect(await link.getAttribute("target")).toBe("_blank");
  expect(await link.getAttribute("rel")).toContain("noopener");
});

test("sales table symbols are also TradingView links", async ({ page }) => {
  await page.setContent(REPORT_HTML);
  const salesLink = page.locator("table .symbol-link");
  await expect(salesLink).toHaveCount(1);
  const href = await salesLink.getAttribute("href");
  expect(href).toContain("tradingview.com");
  expect(href).toContain("MSFT");
});
