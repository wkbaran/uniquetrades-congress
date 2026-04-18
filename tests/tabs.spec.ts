import { test, expect } from "@playwright/test";

const HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
.tab-bar { display:flex; gap:0.25rem; border-bottom:2px solid #585b70; margin-bottom:1.5rem; }
.tab-btn { background:none; border:none; border-bottom:2px solid transparent; margin-bottom:-2px;
  padding:0.55rem 1rem; font-size:0.85rem; font-weight:600; color:#6c7086; cursor:pointer; }
.tab-btn.active { color:#89b4fa; border-bottom-color:#89b4fa; }
.tab-panel { display:none; }
.tab-panel.active { display:block; }
</style>
</head>
<body>
<div class="tab-bar" role="tablist">
  <button class="tab-btn" data-tab="tab-top" role="tab">Top Purchases (10)</button>
  <button class="tab-btn" data-tab="tab-committee" role="tab">Committee-Relevant (5)</button>
  <button class="tab-btn" data-tab="tab-purchases" role="tab">Recent Purchases (20)</button>
  <button class="tab-btn" data-tab="tab-sales" role="tab">Recent Sales (15)</button>
</div>
<div class="tab-panel" id="tab-top" role="tabpanel"><p>Top Purchases content</p></div>
<div class="tab-panel" id="tab-committee" role="tabpanel"><p>Committee content</p></div>
<div class="tab-panel" id="tab-purchases" role="tabpanel"><p>Recent Purchases content</p></div>
<div class="tab-panel" id="tab-sales" role="tabpanel"><p>Recent Sales content</p></div>
<script>
(function () {
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabPanels = document.querySelectorAll('.tab-panel');
  function activateTab(id) {
    tabBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.tab === id); });
    tabPanels.forEach(function(p) { p.classList.toggle('active', p.id === id); });
  }
  tabBtns.forEach(function(b) {
    b.addEventListener('click', function() { activateTab(b.dataset.tab); });
  });
  activateTab(tabBtns.length ? tabBtns[0].dataset.tab : null);
})();
</script>
</body>
</html>`;

test("four tab buttons are rendered", async ({ page }) => {
  await page.setContent(HTML);
  const tabs = page.locator(".tab-btn");
  await expect(tabs).toHaveCount(4);
});

test("first tab is active by default", async ({ page }) => {
  await page.setContent(HTML);
  const active = page.locator(".tab-btn.active");
  await expect(active).toHaveCount(1);
  await expect(active).toContainText("Top Purchases");
});

test("only first panel is visible on load", async ({ page }) => {
  await page.setContent(HTML);
  await expect(page.locator("#tab-top")).toBeVisible();
  await expect(page.locator("#tab-committee")).not.toBeVisible();
  await expect(page.locator("#tab-purchases")).not.toBeVisible();
  await expect(page.locator("#tab-sales")).not.toBeVisible();
});

test("clicking Committee tab shows that panel and hides others", async ({ page }) => {
  await page.setContent(HTML);
  await page.click('[data-tab="tab-committee"]');
  await expect(page.locator("#tab-committee")).toBeVisible();
  await expect(page.locator("#tab-top")).not.toBeVisible();
});

test("clicking Recent Sales tab shows sales panel", async ({ page }) => {
  await page.setContent(HTML);
  await page.click('[data-tab="tab-sales"]');
  await expect(page.locator("#tab-sales")).toBeVisible();
  await expect(page.locator("#tab-top")).not.toBeVisible();
});

test("active class moves to clicked tab button", async ({ page }) => {
  await page.setContent(HTML);
  await page.click('[data-tab="tab-purchases"]');
  const active = page.locator(".tab-btn.active");
  await expect(active).toHaveCount(1);
  await expect(active).toContainText("Recent Purchases");
});

test("tab buttons show trade counts", async ({ page }) => {
  await page.setContent(HTML);
  const labels = await page.locator(".tab-btn").allTextContents();
  expect(labels.some((l) => l.includes("(10)"))).toBe(true);
  expect(labels.some((l) => l.includes("(15)"))).toBe(true);
});
