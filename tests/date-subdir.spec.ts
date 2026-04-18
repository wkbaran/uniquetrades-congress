import { test, expect } from "@playwright/test";

// Simulated index.html that links into a date subdirectory
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --text:#cdd6f4; --accent:#89b4fa; --border:#585b70; }
body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; }
.report-link a { color:var(--accent); }
</style>
</head>
<body>
<main>
  <table id="report-list">
    <thead><tr><th>Date</th><th>Trades</th><th>Link</th></tr></thead>
    <tbody>
      <tr>
        <td>2026-04-18</td>
        <td>462</td>
        <td class="report-link"><a href="2026-04-18/report.html">View report →</a></td>
      </tr>
      <tr>
        <td>2026-04-11</td>
        <td>390</td>
        <td class="report-link"><a href="2026-04-11/report.html">View report →</a></td>
      </tr>
    </tbody>
  </table>
</main>
</body>
</html>`;

// Simulated report page inside a date subdir — back-link uses ../index.html
const REPORT_IN_SUBDIR_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --text:#cdd6f4; --accent:#89b4fa; }
body { background:var(--bg); color:var(--text); }
.site-title { color:var(--accent); font-weight:700; }
</style>
</head>
<body>
<header>
  <div class="site-title">Congress Trades</div>
  <nav>
    <a href="../index.html">← Archive</a>
  </nav>
</header>
<main>
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="tab-top">Top Purchases (10)</button>
    <button class="tab-btn" data-tab="tab-sales">Recent Sales (15)</button>
  </div>
</main>
</body>
</html>`;

// Simulated party page inside subdir — links use relative paths
const PARTY_IN_SUBDIR_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8"></head>
<body>
<nav>
  <a href="report.html">← Report</a>
  &nbsp;·&nbsp;
  <a href="../index.html">← Archive</a>
</nav>
<h1>Republican Trades</h1>
</body>
</html>`;

// Simulated member page inside subdir
const MEMBER_IN_SUBDIR_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8"></head>
<body>
<nav>
  <a href="report.html">← Report</a>
  &nbsp;·&nbsp;
  <a href="../index.html">← Archive</a>
</nav>
<h1>Sen. Jane Smith</h1>
</body>
</html>`;

test("index links point into date subdirectories", async ({ page }) => {
  await page.setContent(INDEX_HTML);
  const links = page.locator(".report-link a");
  const count = await links.count();
  expect(count).toBe(2);
  const href0 = await links.nth(0).getAttribute("href");
  const href1 = await links.nth(1).getAttribute("href");
  expect(href0).toMatch(/^\d{4}-\d{2}-\d{2}\/report\.html$/);
  expect(href1).toMatch(/^\d{4}-\d{2}-\d{2}\/report\.html$/);
});

test("report page back-link goes up one level to index", async ({ page }) => {
  await page.setContent(REPORT_IN_SUBDIR_HTML);
  const archiveLink = page.locator('a[href="../index.html"]');
  await expect(archiveLink).toBeVisible();
  await expect(archiveLink).toContainText("Archive");
});

test("party page links to report (same dir) and archive (parent)", async ({ page }) => {
  await page.setContent(PARTY_IN_SUBDIR_HTML);
  await expect(page.locator('a[href="report.html"]')).toBeVisible();
  await expect(page.locator('a[href="../index.html"]')).toBeVisible();
});

test("member page links to report (same dir) and archive (parent)", async ({ page }) => {
  await page.setContent(MEMBER_IN_SUBDIR_HTML);
  await expect(page.locator('a[href="report.html"]')).toBeVisible();
  await expect(page.locator('a[href="../index.html"]')).toBeVisible();
});

test("report page has tabs with counts", async ({ page }) => {
  await page.setContent(REPORT_IN_SUBDIR_HTML);
  const tabs = page.locator(".tab-btn");
  await expect(tabs).toHaveCount(2);
  const labels = await tabs.allTextContents();
  expect(labels.some((l) => l.includes("Top Purchases"))).toBe(true);
});

test("index date links use YYYY-MM-DD format", async ({ page }) => {
  await page.setContent(INDEX_HTML);
  const hrefs = await page.locator(".report-link a").evaluateAll(
    (els) => els.map((el) => el.getAttribute("href") ?? "")
  );
  for (const href of hrefs) {
    expect(href).toMatch(/^\d{4}-\d{2}-\d{2}\//);
  }
});
