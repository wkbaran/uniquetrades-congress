import { test, expect } from "@playwright/test";
import { buildMemberPage } from "../src/output/html.js";
import type { FMPTrade } from "../src/types/index.js";

// Unlike the other tests in this directory, this exercises the real HTML
// generator (buildMemberPage) rather than asserting against a hand-authored
// HTML fixture -- the filing-link feature has no coverage otherwise, since a
// hand-written fixture can't catch a regression in the code that produces it.

function trade(overrides: Partial<FMPTrade>): FMPTrade {
  return {
    firstName: "Nancy",
    lastName: "Pelosi",
    transactionDate: "2026-05-29",
    owner: "Spouse",
    assetDescription: "Intel Corporation - Common Stock",
    assetType: "Options",
    type: "Purchase",
    amount: "$1,000,001 - $5,000,000",
    symbol: "INTC",
    ...overrides,
  };
}

test("member page links each trade to its source PTR filing", () => {
  const html = buildMemberPage({
    memberName: "Nancy Pelosi",
    chamber: "Rep.",
    party: "Democrat",
    dateLabel: "Week of July 13, 2026",
    reportUrl: "report.html",
    trades: [
      {
        trade: trade({ link: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034836.pdf" }),
        party: "Democrat",
      },
    ],
  });

  expect(html).toContain('class="filing-link" href="https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034836.pdf"');
});

test("member page renders no filing link when a trade has no source URL", () => {
  const html = buildMemberPage({
    memberName: "Nancy Pelosi",
    chamber: "Rep.",
    party: "Democrat",
    dateLabel: "Week of July 13, 2026",
    reportUrl: "report.html",
    trades: [{ trade: trade({ link: undefined }), party: "Democrat" }],
  });

  // "filing-link" itself always appears in the <style> block's CSS rule;
  // what matters is that no actual anchor with that class was rendered.
  expect(html).not.toContain('class="filing-link"');
});
