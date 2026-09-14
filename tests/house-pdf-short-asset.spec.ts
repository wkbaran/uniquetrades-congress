import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseHousePtrPdf } from "../src/data/house-pdf-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "fixtures", name));
}

test("short asset names followed by an asset type code still start a row (crypto)", async () => {
  // Real filing: Michael A. Collins Jr, docId 20033840. Asset "usdc [CT]" was skipped
  // because row detection required more than 5 characters, so the filing parsed empty.
  const parsed = await parseHousePtrPdf(fixture("house-ptr-short-asset-crypto.pdf"));

  expect(parsed.transactions).toHaveLength(2);
  const [buy, sell] = parsed.transactions;
  expect(buy.assetDescription).toBe("usdc");
  expect(buy.assetType).toBe("CT");
  expect(buy.transactionType).toBe("Purchase");
  expect(buy.transactionDate).toBe("12/26/2025");
  expect(buy.amount).toBe("$1,001 - $15,000");
  expect(sell.transactionType).toBe("Sale");
  expect(sell.transactionDate).toBe("01/12/2026");
});

test("short asset names followed by an asset type code still start a row (private stock)", async () => {
  // Real filing: Lisa McClain, docId 20033736 — spouse purchase of "xAI [PS]".
  const parsed = await parseHousePtrPdf(fixture("house-ptr-short-asset-private.pdf"));

  expect(parsed.transactions).toHaveLength(1);
  const [tx] = parsed.transactions;
  expect(tx.assetDescription).toBe("xAI");
  expect(tx.assetType).toBe("PS");
  expect(tx.transactionType).toBe("Purchase");
  expect(tx.transactionDate).toBe("12/15/2025");
  expect(tx.amount).toBe("$100,001 - $250,000");
});
