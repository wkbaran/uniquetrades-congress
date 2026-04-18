import { test, expect, type Page } from "@playwright/test";

// Theme JS matching html.ts / index-page.ts — localStorage wrapped in try/catch
// so tests work both with and without a real origin.
const THEME_JS = `
(function () {
  var root = document.documentElement;
  var btn  = document.getElementById('theme-btn');
  try {
    var saved = localStorage.getItem('congress-theme');
    if (saved === 'light') root.setAttribute('data-theme', 'light');
  } catch(e) {}

  function updateLabel() {
    var current = root.getAttribute('data-theme');
    if (btn) btn.textContent = current === 'light' ? '\\u{1F319} Dark' : '\\u2600\\uFE0F Light';
  }
  updateLabel();

  if (btn) {
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('congress-theme', next); } catch(e) {}
      updateLabel();
    });
  }
})();
`;

function makeThemedHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
:root,[data-theme="dark"] { --bg:#1e1e2e; --text:#cdd6f4; }
[data-theme="light"]      { --bg:#eff1f5; --text:#4c4f69; }
body { background:var(--bg); color:var(--text); }
</style>
</head>
<body>
<button id="theme-btn">&#9728;&#65039; Light</button>
<script>${THEME_JS}</script>
</body>
</html>`;
}

// Helper: serve the HTML at a real URL so localStorage works
async function gotoThemePage(page: Page): Promise<void> {
  await page.route("**/theme-test.html", (route) =>
    route.fulfill({ contentType: "text/html", body: makeThemedHtml() })
  );
  await page.goto("http://localhost/theme-test.html");
}

// ── Basic default theme ───────────────────────────────────────────────────────

test("dark theme is the default (data-theme=dark on <html>)", async ({ page }) => {
  await page.setContent(makeThemedHtml());
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(theme).toBe("dark");
});

test("toggle button shows ☀️ Light in dark mode", async ({ page }) => {
  await page.setContent(makeThemedHtml());
  const label = await page.locator("#theme-btn").textContent();
  expect(label).toContain("Light");
});

// ── Toggle behaviour ──────────────────────────────────────────────────────────

test("clicking toggle switches to light mode", async ({ page }) => {
  await page.setContent(makeThemedHtml());
  await page.locator("#theme-btn").click();
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(theme).toBe("light");
});

test("toggle button shows 🌙 Dark after switching to light", async ({ page }) => {
  await page.setContent(makeThemedHtml());
  await page.locator("#theme-btn").click();
  const label = await page.locator("#theme-btn").textContent();
  expect(label).toContain("Dark");
});

test("clicking toggle twice returns to dark mode", async ({ page }) => {
  await page.setContent(makeThemedHtml());
  await page.locator("#theme-btn").click();
  await page.locator("#theme-btn").click();
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(theme).toBe("dark");
});

// ── localStorage persistence (requires real URL via route) ────────────────────

test("switching theme saves 'light' to localStorage", async ({ page }) => {
  await gotoThemePage(page);
  await page.locator("#theme-btn").click();
  const stored = await page.evaluate(() => localStorage.getItem("congress-theme"));
  expect(stored).toBe("light");
});

test("switching back saves 'dark' to localStorage", async ({ page }) => {
  await gotoThemePage(page);
  await page.locator("#theme-btn").click(); // → light
  await page.locator("#theme-btn").click(); // → dark
  const stored = await page.evaluate(() => localStorage.getItem("congress-theme"));
  expect(stored).toBe("dark");
});

test("saved light preference is restored on page load", async ({ page }) => {
  // Set preference before page loads
  await page.route("**/theme-test.html", (route) =>
    route.fulfill({ contentType: "text/html", body: makeThemedHtml() })
  );
  await page.goto("http://localhost/theme-test.html");
  await page.evaluate(() => localStorage.setItem("congress-theme", "light"));

  // Reload page — JS should restore light theme
  await page.reload();
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(theme).toBe("light");
});
