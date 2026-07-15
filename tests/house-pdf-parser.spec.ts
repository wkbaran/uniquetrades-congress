import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseHousePtrPdf } from "../src/data/house-pdf-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "fixtures", name));
}

// A PTR only ever reports a transaction that already happened, so a parsed
// transaction date should never land in the future.
function isPlausiblePastDate(mmddyyyy: string | undefined): boolean {
  if (!mmddyyyy) return false;
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const d = new Date(`${m[3]}-${m[1]}-${m[2]}`);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d >= new Date("2012-01-01") && d <= tomorrow;
}

test("single-page options PTR: extracts both transactions with correct ticker, type, and date", async () => {
  // Real filing: Nancy Pelosi, docId 20034836 (INTC + UBER options purchases, 2026-05-29)
  const parsed = await parseHousePtrPdf(fixture("house-ptr-options-single-page.pdf"));

  expect(parsed.memberName).toBe("Nancy Pelosi");
  expect(parsed.transactions).toHaveLength(2);

  const tickers = parsed.transactions.map((t) => t.ticker).sort();
  expect(tickers).toEqual(["INTC", "UBER"]);

  for (const tx of parsed.transactions) {
    expect(tx.transactionType).toBe("Purchase");
    expect(tx.transactionDate).toBe("05/29/2026");
    expect(tx.assetType).toBe("OP"); // House code for Options
  }
});

test("multi-page PTR: extracts transactions from every page, not just page 1", async () => {
  // Real filing: Nancy Pelosi, docId 20033725 -- a 3-page omnibus filing.
  // Page 1 renders via a Form XObject; pages 2-3 reference /Contents directly.
  // Before the multi-page fix, only page 1's ~6 transactions were extracted;
  // everything on pages 2-3 (including the Tempus AI purchase) was silently dropped.
  const parsed = await parseHousePtrPdf(fixture("house-ptr-multipage.pdf"));

  expect(parsed.memberName).toBe("Nancy Pelosi");
  expect(parsed.transactions.length).toBeGreaterThan(15);

  const tem = parsed.transactions.find((t) => t.ticker === "TEM");
  expect(tem).toBeDefined();
  expect(tem?.transactionDate).toBe("01/16/2026");
  expect(tem?.transactionType).toBe("Purchase");
  expect(tem?.assetDescription).toContain("Tempus AI");
});

test("bond-dates PTR: never mistakes an embedded maturity/call date for the transaction date", async () => {
  // Real filing: William Keating, docId 20034417 -- corporate notes whose asset
  // descriptions embed a "CALL MAKE WHOLE ... MM/DD/YYYY" maturity date ahead of
  // the real transaction-date columns. That date used to get captured as the
  // transaction date itself (e.g. 04/22/2036), which corrupted the incremental
  // fetch watermark since it's derived from the max transaction date in cache.
  const parsed = await parseHousePtrPdf(fixture("house-ptr-bond-dates.pdf"));

  expect(parsed.memberName).toBe("William R. Keating");
  expect(parsed.transactions.length).toBeGreaterThan(0);

  for (const tx of parsed.transactions) {
    expect(isPlausiblePastDate(tx.transactionDate)).toBe(true);
  }
});

test("bond-dates PTR: transaction type isn't clobbered by stray PDF noise later in the row", async () => {
  // Every row in this filing is coded "P" (Purchase) in the source PDF except
  // one "S" (Sale); stray single-character noise from unrelated form fields
  // used to overwrite an already-parsed transaction type later in the same row.
  const parsed = await parseHousePtrPdf(fixture("house-ptr-bond-dates.pdf"));

  const types = parsed.transactions.map((t) => t.transactionType);
  expect(types.filter((t) => t === "Purchase")).toHaveLength(7);
  expect(types.filter((t) => t === "Sale")).toHaveLength(1);
});
