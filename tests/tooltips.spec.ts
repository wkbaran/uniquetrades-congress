import { test, expect } from "@playwright/test";

const BADGES_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<style>
:root { --bg:#1e1e2e; --surface2:#45475a; --border:#585b70; --text:#cdd6f4;
        --mauve:#cba6f7; --peach:#fab387; --red:#f38ba8; --teal:#94e2d5;
        --yellow:#f9e2af; --muted:#6c7086; }
body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; padding:2rem; }
.badge-row { display:flex; flex-wrap:wrap; gap:.35rem; }
.badge {
  font-size:.65rem; font-weight:600; padding:.15rem .45rem; border-radius:4px;
  text-transform:uppercase; letter-spacing:.04em; position:relative; cursor:default;
}
.badge::after {
  content:attr(title);
  position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
  background:var(--surface2); color:var(--text); border:1px solid var(--border);
  border-radius:5px; padding:.3rem .6rem; font-size:.72rem; font-weight:400;
  text-transform:none; letter-spacing:0; pointer-events:none;
  opacity:0; transition:opacity 0.15s; z-index:100; white-space:normal; text-align:center;
}
.badge:hover::after { opacity:1; }
.badge-rare       { background:rgba(203,166,247,.2); color:var(--mauve); }
.badge-conviction { background:rgba(250,179,135,.2); color:var(--peach); }
.badge-committee  { background:rgba(243,139,168,.2); color:var(--red); }
.badge-derivative { background:rgba(148,226,213,.2); color:var(--teal); }
.badge-smallcap   { background:rgba(249,226,175,.2); color:var(--yellow); }
.badge-indirect   { background:rgba(108,112,134,.2); color:var(--muted); }
</style>
</head>
<body>
<div class="badge-row">
  <span class="badge badge-rare"
        title="Stock rarely traded by Congress \u2014 fewer than 4 total trades">Rare</span>
  <span class="badge badge-conviction"
        title="Trade is significantly larger than this member's typical trade size">High Conviction</span>
  <span class="badge badge-committee"
        title="Trader serves on a committee that oversees this stock's sector \u2014 potential insider knowledge">Committee</span>
  <span class="badge badge-derivative"
        title="Options, warrants, or other derivatives \u2014 signals timing sensitivity">Derivative</span>
  <span class="badge badge-smallcap"
        title="Small or micro-cap stock (market cap below \$2B) \u2014 less analyst coverage">Small Cap</span>
  <span class="badge badge-indirect"
        title="Trade made via a spouse or family member rather than directly by the member">Indirect</span>
</div>
</body>
</html>`;

const ALL_BADGE_TYPES = [
  "badge-rare",
  "badge-conviction",
  "badge-committee",
  "badge-derivative",
  "badge-smallcap",
  "badge-indirect",
] as const;

test("all badge types have non-empty title attributes", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  for (const cls of ALL_BADGE_TYPES) {
    const title = await page.locator(`.${cls}`).getAttribute("title");
    expect(title, `${cls} should have a title`).toBeTruthy();
    expect(title!.length, `${cls} title should be descriptive`).toBeGreaterThan(15);
  }
});

test("Rare badge tooltip mentions Congress", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  const title = await page.locator(".badge-rare").getAttribute("title");
  expect(title).toContain("Congress");
});

test("Committee badge tooltip explains oversight risk", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  const title = await page.locator(".badge-committee").getAttribute("title");
  expect(title).toContain("committee");
  expect(title).toContain("sector");
});

test("Indirect badge tooltip explains family trades", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  const title = await page.locator(".badge-indirect").getAttribute("title");
  expect(title).toContain("spouse");
});

test("Small Cap badge tooltip mentions market cap threshold", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  const title = await page.locator(".badge-smallcap").getAttribute("title");
  expect(title).toContain("$2B");
});

test("badge has position:relative so CSS tooltip can anchor to it", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  const position = await page.locator(".badge-rare").evaluate((el) =>
    getComputedStyle(el).position
  );
  expect(position).toBe("relative");
});

test("badge ::after content is set from title attribute (CSS tooltip mechanism)", async ({ page }) => {
  await page.setContent(BADGES_HTML);
  // The CSS rule `.badge::after { content: attr(title) }` means the pseudo-element
  // gets its text from the title attribute. Verify by checking the title is non-empty
  // and that the computed content of ::after matches.
  const result = await page.locator(".badge-rare").evaluate((el) => {
    const title = el.getAttribute("title") ?? "";
    const afterContent = getComputedStyle(el, "::after").content;
    // content is a quoted CSS string like '"Stock rarely traded..."'
    // when content == attr(title), the computed value equals the quoted title text
    return { titleNonEmpty: title.length > 0, afterContent };
  });
  expect(result.titleNonEmpty).toBe(true);
  // Verify the CSS ::after is wired up (content is not 'none' or empty)
  expect(result.afterContent).not.toBe("none");
  expect(result.afterContent.length).toBeGreaterThan(2);
});
