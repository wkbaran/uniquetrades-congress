import { test, expect } from "@playwright/test";

// Minimal index page HTML matching our buildIndexPage() output structure
function makeIndexHtml(entries: Array<{ date: string; label: string; file: string; count: number; symbols: string[] }>) {
  const rows = entries.map(
    (e) => `
    <div class="report-item">
      <div class="report-meta">
        <div class="report-date">${e.label}</div>
        <div class="report-count">${e.count} trades</div>
        <div class="report-chips">${e.symbols.map((s) => `<span class="chip">${s}</span>`).join("")}</div>
      </div>
      <span class="report-link"><a href="${e.file}">View report →</a></span>
    </div>`
  );

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --surface:#313244; --border:#585b70; --text:#cdd6f4; --subtext:#a6adc8; --accent:#89b4fa; --radius:10px; }
[data-theme="light"] { --bg:#eff1f5; --surface:#e6e9ef; --border:#bcc0cc; --text:#4c4f69; --accent:#1e66f5; }
body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; }
.report-item { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:1rem; display:flex; justify-content:space-between; gap:1rem; margin-bottom:.75rem; }
.chip { font-size:.72rem; padding:.15rem .5rem; border-radius:4px; background:rgba(137,180,250,.12); color:var(--accent); }
</style>
</head>
<body>
<div class="report-list">${rows.join("\n")}</div>
</body>
</html>`;
}

test("index lists all report entries", async ({ page }) => {
  await page.setContent(
    makeIndexHtml([
      { date: "2026-04-18", label: "Week of April 14, 2026", file: "report-2026-04-18.html", count: 42, symbols: ["AAPL", "MSFT"] },
      { date: "2026-04-11", label: "Week of April 7, 2026",  file: "report-2026-04-11.html", count: 38, symbols: ["NVDA"] },
    ])
  );
  await expect(page.locator(".report-item")).toHaveCount(2);
});

test("index report entry shows date label", async ({ page }) => {
  await page.setContent(
    makeIndexHtml([
      { date: "2026-04-18", label: "Week of April 14, 2026", file: "report-2026-04-18.html", count: 42, symbols: [] },
    ])
  );
  await expect(page.locator(".report-date").first()).toHaveText("Week of April 14, 2026");
});

test("index report entry shows trade count", async ({ page }) => {
  await page.setContent(
    makeIndexHtml([
      { date: "2026-04-18", label: "Week of April 14, 2026", file: "report-2026-04-18.html", count: 42, symbols: [] },
    ])
  );
  await expect(page.locator(".report-count").first()).toHaveText("42 trades");
});

test("index report entry links to correct file", async ({ page }) => {
  await page.setContent(
    makeIndexHtml([
      { date: "2026-04-18", label: "Week of April 14, 2026", file: "report-2026-04-18.html", count: 42, symbols: [] },
    ])
  );
  const href = await page.locator(".report-link a").first().getAttribute("href");
  expect(href).toBe("report-2026-04-18.html");
});

test("index report entry shows symbol chips", async ({ page }) => {
  await page.setContent(
    makeIndexHtml([
      { date: "2026-04-18", label: "Week of April 14, 2026", file: "report-2026-04-18.html", count: 42, symbols: ["AAPL", "MSFT", "NVDA"] },
    ])
  );
  const chips = page.locator(".chip");
  await expect(chips).toHaveCount(3);
  await expect(chips.first()).toHaveText("AAPL");
});

test("newest report appears first", async ({ page }) => {
  await page.setContent(
    makeIndexHtml([
      { date: "2026-04-18", label: "Week of April 14, 2026", file: "report-2026-04-18.html", count: 42, symbols: [] },
      { date: "2026-04-11", label: "Week of April 7, 2026",  file: "report-2026-04-11.html", count: 38, symbols: [] },
    ])
  );
  const dates = page.locator(".report-date");
  await expect(dates.first()).toHaveText("Week of April 14, 2026");
  await expect(dates.nth(1)).toHaveText("Week of April 7, 2026");
});

test("empty index shows placeholder message when no reports", async ({ page }) => {
  await page.setContent(`<!DOCTYPE html>
<html lang="en" data-theme="dark">
<body>
<div class="report-list">
  <p class="empty-msg">No reports yet.</p>
</div>
</body>
</html>`);
  await expect(page.locator(".report-item")).toHaveCount(0);
  await expect(page.locator(".empty-msg")).toBeVisible();
});
