import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseSenatePtrPage } from "../src/data/government-provider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf-8");
}

test("stock PTR: reads ticker, type, and amount from each table row", () => {
  // Real filing: John Boozman, 6298991b-e48f-4b11-9bbb-dfc94a7e1b32
  const parsed = parseSenatePtrPage(fixture("senate-ptr-stocks.html"));

  expect(parsed.flags).toHaveLength(0);
  expect(parsed.memberName).toBe("John Boozman");
  expect(parsed.filingDate).toBe("09/11/2026");
  expect(parsed.transactions).toHaveLength(4);

  const ivv = parsed.transactions.find((t) => t.ticker === "IVV");
  expect(ivv?.transactionDate).toBe("08/27/2026");
  expect(ivv?.owner).toBe("Joint");
  expect(ivv?.assetDescription).toBe("iShares Core S&P 500 ETF");
  expect(ivv?.transactionType).toBe("Sale (Partial)");
  expect(ivv?.amount).toBe("$1,001 - $15,000");
});

test("owner and asset types outside the old enumerations still parse", () => {
  // Real filing: John Fetterman, a0431e36-2161-4e97-b99a-74a966d7193a. The flattened-text
  // regex didn't know owner "Child" or asset type "Corporate Bond" and found nothing.
  const parsed = parseSenatePtrPage(fixture("senate-ptr-child-bond.html"));

  expect(parsed.transactions).toHaveLength(1);
  const [tx] = parsed.transactions;
  expect(tx.owner).toBe("Child");
  expect(tx.assetType).toBe("Corporate Bond");
  expect(tx.ticker).toBe("");
  expect(tx.transactionType).toBe("Purchase");
  expect(tx.amount).toBe("$1,001 - $15,000");
});

test("non-public stock PTR: full details instead of fabricated fallback rows", () => {
  // Real filing: Timothy Sheehy, e15641c6-d632-4b7a-82d1-45c242b1515a. Previously the
  // fallback parser emitted five "Purchase" rows with no asset, type, or amount.
  const parsed = parseSenatePtrPage(fixture("senate-ptr-non-public.html"));

  expect(parsed.flags).toHaveLength(0);
  expect(parsed.transactions).toHaveLength(5);
  expect(parsed.transactions.filter((t) => t.transactionType === "Sale (Full)")).toHaveLength(2);
  for (const tx of parsed.transactions) {
    expect(tx.assetType).toBe("Non-Public Stock");
    expect(tx.amount).toMatch(/^\$[\d,]+ - \$[\d,]+$/);
    expect(tx.assetDescription).not.toMatch(/&nbsp;|&amp;/);
  }
});
