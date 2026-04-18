import { test, expect } from "@playwright/test";

const CARD_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8">
<style>
abbr.committee-abbr { text-decoration: underline dotted; cursor: help; }
.detail-warning { color: red; }
</style>
</head>
<body>
<ul class="trade-details">
  <li class="detail-warning">Committee oversight: Technology</li>
  <li class="detail-warning">Committees:
    <abbr class="committee-abbr" title="Commerce, Science, and Transportation">SSCM</abbr>,
    <abbr class="committee-abbr" title="Banking, Housing, and Urban Affairs">SSBK</abbr>
  </li>
</ul>
</body>
</html>`;

test("committee abbr elements exist", async ({ page }) => {
  await page.setContent(CARD_HTML);
  const abbrs = page.locator("abbr.committee-abbr");
  await expect(abbrs).toHaveCount(2);
});

test("committee abbr has full name in title", async ({ page }) => {
  await page.setContent(CARD_HTML);
  const first = page.locator("abbr.committee-abbr").first();
  expect(await first.getAttribute("title")).toBe("Commerce, Science, and Transportation");
});

test("committee abbr shows short code as text", async ({ page }) => {
  await page.setContent(CARD_HTML);
  const first = page.locator("abbr.committee-abbr").first();
  expect(await first.textContent()).toBe("SSCM");
});

test("committee abbr has help cursor", async ({ page }) => {
  await page.setContent(CARD_HTML);
  const cursor = await page.locator("abbr.committee-abbr").first().evaluate(
    (el) => getComputedStyle(el).cursor
  );
  expect(cursor).toBe("help");
});
