/**
 * House Clerk PTR PDF Parser
 *
 * Decrypts and parses House Periodic Transaction Report PDFs using
 * the standard PDF encryption algorithm (RC4-128, Revision 3).
 * No external dependencies — all crypto via Node.js built-ins.
 *
 * House PTRs are always encrypted with an empty user password.
 * The /ToUnicode CMap for each font is parsed to correctly decode
 * CID-encoded text into readable characters.
 */

import { createHash } from "crypto";
import { inflateSync } from "zlib";

// ── Standard PDF padding constant (PDF spec §7.6.3.3 Table 3.6) ──────────
const PDF_PAD = Buffer.from(
  "28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A",
  "hex"
);

// ── Official House asset type codes ────────────────────────────────────────
// Source: https://fd.house.gov/reference/asset-type-codes.aspx
export const HOUSE_ASSET_TYPE_CODES: Record<string, string> = {
  "4K": "401K and Other Non-Federal Retirement Accounts",
  "5C": "529 College Savings Plan",
  "5F": "529 Portfolio",
  "5P": "529 Prepaid Tuition Plan",
  AB: "Asset-Backed Securities",
  BA: "Bank Accounts, Money Market Accounts and CDs",
  BK: "Brokerage Accounts",
  CO: "Collectibles",
  CS: "Corporate Securities (Bonds and Notes)",
  CT: "Cryptocurrency",
  DB: "Defined Benefit Pension",
  DO: "Debts Owed to the Filer",
  DS: "Delaware Statutory Trust",
  EF: "Exchange Traded Funds (ETF)",
  EQ: "Excepted/Qualified Blind Trust",
  ET: "Exchange Traded Notes",
  FA: "Farms",
  FE: "Foreign Exchange Position (Currency)",
  FN: "Fixed Annuity",
  FU: "Futures",
  GS: "Government Securities and Agency Debt",
  HE: "Hedge Funds & Private Equity Funds (EIF)",
  HN: "Hedge Funds & Private Equity Funds (non-EIF)",
  IC: "Investment Club",
  IH: "IRA (Held in Cash)",
  IP: "Intellectual Property & Royalties",
  IR: "IRA",
  MA: "Managed Accounts (e.g., SMA and UMA)",
  MF: "Mutual Funds",
  MO: "Mineral/Oil/Solar Energy Rights",
  OI: "Ownership Interest (Holding Investments)",
  OL: "Ownership Interest (Engaged in a Trade or Business)",
  OP: "Options",
  OT: "Other",
  PE: "Pensions",
  PM: "Precious Metals",
  PS: "Stock (Not Publicly Traded)",
  RE: "Real Estate Invest. Trust (REIT)",
  RF: "REIT (EIF)",
  RN: "REIT (non-EIF)",
  RP: "Real Property",
  RS: "Restricted Stock Units (RSUs)",
  SA: "Stock Appreciation Right",
  // Kept as plain "Stock" (rather than the official "Stocks (including ADRs)" title)
  // to match the label the rest of the app already special-cases (see report-sales.ts).
  ST: "Stock",
  TR: "Trust",
  VA: "Variable Annuity",
  VI: "Variable Insurance",
  WU: "Whole/Universal Insurance",
};

/** Expand a House asset type code (e.g. "OP") to its official name; falls back to the raw code if unrecognized. */
export function expandHouseAssetType(code: string | undefined): string | undefined {
  if (!code) return code;
  return HOUSE_ASSET_TYPE_CODES[code] ?? code;
}

// A PTR only reports transactions that already happened, so a transaction/notification
// date should never land in the future or predate the STOCK Act's 2012 disclosure regime.
// Asset descriptions for bonds/notes often embed a call or maturity date ("CALL MAKE
// WHOLE ... 04/22/2036") as a separate text block ahead of the real date columns, which
// this guards against being mistaken for the actual transaction date.
const EARLIEST_PLAUSIBLE_DATE = new Date("2012-01-01");

function isPlausibleTransactionDate(mmddyyyy: string): boolean {
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const d = new Date(`${m[3]}-${m[1]}-${m[2]}`);
  if (isNaN(d.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d >= EARLIEST_PLAUSIBLE_DATE && d <= tomorrow;
}

// ── Parsed transaction from a single PTR filing ───────────────────────────
export interface HousePtrTransaction {
  rowNum?: number;
  owner?: string;          // blank=self, Sp=spouse, DC=dependent, JT=joint
  assetDescription: string;
  ticker?: string;
  assetType?: string;      // ST=stock, OP=option, etc.
  transactionType?: string; // P=purchase, S=sale, E=exchange
  transactionDate?: string; // MM/DD/YYYY
  notificationDate?: string;
  amount?: string;          // "$1,001 - $15,000" etc.
  capGains?: string;
  comment?: string;
}

export interface ParsedPtr {
  memberName?: string;
  district?: string;
  filingId?: string;
  transactions: HousePtrTransaction[];
  /** Issues that warrant manual review */
  flags: string[];
}

// ── RC4 ───────────────────────────────────────────────────────────────────
function rc4(key: Buffer, data: Buffer): Buffer {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = Buffer.alloc(data.length);
  let x = 0, y = 0;
  for (let i = 0; i < data.length; i++) {
    x = (x + 1) & 0xff;
    y = (y + S[x]) & 0xff;
    [S[x], S[y]] = [S[y], S[x]];
    out[i] = data[i] ^ S[(S[x] + S[y]) & 0xff];
  }
  return out;
}

// ── PDF object indexer ────────────────────────────────────────────────────
function buildObjIndex(latin: string): Map<number, number> {
  const index = new Map<number, number>();
  const re = /(\d+)\s+0\s+obj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    index.set(parseInt(m[1]), m.index + m[0].length);
  }
  return index;
}

function getBody(latin: string, index: Map<number, number>, n: number): string {
  const bodyStart = index.get(n);
  if (bodyStart === undefined) return "";
  return latin.slice(bodyStart, latin.indexOf("endobj", bodyStart));
}

// ── Page tree walking ──────────────────────────────────────────────────────
// Multi-transaction PTRs span multiple pages. Page 1 is often rendered through
// a Form XObject wrapper ("q /XOBJ0 Do Q"), but later pages commonly reference
// their content stream directly via /Contents with fonts on the page's own
// /Resources — transactions can land on either kind of page, so every page in
// the document (per the /Pages tree's /Kids order) must be walked, not just
// whichever Form XObject happens to be found first.
function findPageOrder(latin: string, index: Map<number, number>): number[] {
  function expand(n: number, seen: Set<number>): number[] {
    if (seen.has(n)) return [];
    seen.add(n);
    const body = getBody(latin, index, n);
    const kidsM = body.match(/\/Kids\s*\[([^\]]*)\]/);
    if (!kidsM) return [n]; // leaf page
    const kids = [...kidsM[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => parseInt(m[1]));
    return kids.flatMap((k) => expand(k, seen));
  }

  for (const [n] of index) {
    const body = getBody(latin, index, n);
    if (/\/Type\s*\/Pages\b/.test(body) && !body.includes("/Parent")) {
      return expand(n, new Set());
    }
  }
  return [];
}

interface PageContent {
  contentObjNum: number;
  /** Object body containing this page's /Font resource entries. */
  fontResourceBody: string;
}

function findPageContent(latin: string, index: Map<number, number>, pageNum: number): PageContent | null {
  const pageBody = getBody(latin, index, pageNum);

  const xobjRefM = pageBody.match(/\/XObject\s*<<\s*\/\w+\s+(\d+)\s+0\s+R/);
  if (xobjRefM) {
    const xobjNum = parseInt(xobjRefM[1]);
    const xobjBody = getBody(latin, index, xobjNum);
    if (xobjBody.includes("/Subtype /Form") && xobjBody.includes("/Font")) {
      return { contentObjNum: xobjNum, fontResourceBody: xobjBody };
    }
  }

  const contentsM = pageBody.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (contentsM) {
    return { contentObjNum: parseInt(contentsM[1]), fontResourceBody: pageBody };
  }

  return null;
}

/** Fallback for PDFs with no discoverable /Pages tree: scan for any Form XObject with fonts. */
function findFallbackFormXObject(latin: string, index: Map<number, number>, encN: number): PageContent | null {
  for (const [n] of index) {
    if (n === encN || n === 0) continue;
    const body = getBody(latin, index, n);
    if (body.includes("/Subtype /Form") && body.includes("/Font")) {
      return { contentObjNum: n, fontResourceBody: body };
    }
  }
  return null;
}

function hexVal(s: string | undefined): Buffer {
  return Buffer.from((s || "").replace(/[<>\s]/g, ""), "hex");
}

// ── Per-object decryption key (Algorithm 1, PDF spec) ─────────────────────
function makeObjKey(fileKey: Buffer, n: number): Buffer {
  const input = Buffer.concat([
    fileKey,
    Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, 0, 0]),
  ]);
  return createHash("md5").update(input).digest().slice(0, Math.min(fileKey.length + 5, 16));
}

// ── Decrypt + inflate a stream object ─────────────────────────────────────
function decryptStream(
  buf: Buffer,
  latin: string,
  index: Map<number, number>,
  fileKey: Buffer,
  n: number
): string | null {
  const body = getBody(latin, index, n);
  const sm = body.match(/stream\r?\n/);
  if (!sm) return null;
  const bodyStart = index.get(n)!;
  const stStart = bodyStart + body.indexOf(sm[0]) + sm[0].length;
  const stEnd = latin.indexOf("\nendstream", stStart);
  if (stEnd < 0) return null;

  const objKey = makeObjKey(fileKey, n);
  const decrypted = rc4(objKey, buf.slice(stStart, stEnd));

  try {
    return inflateSync(decrypted).toString("binary");
  } catch {
    return decrypted.toString("binary");
  }
}

// ── Parse /ToUnicode CMap ──────────────────────────────────────────────────
function parseToUnicodeCmap(cmapText: string): Map<number, string> {
  const map = new Map<number, string>();

  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let m: RegExpExecArray | null;
  while ((m = bfcharRe.exec(cmapText)) !== null) {
    const lineRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(m[1])) !== null) {
      map.set(parseInt(lm[1], 16), String.fromCodePoint(parseInt(lm[2], 16)));
    }
  }

  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRe.exec(cmapText)) !== null) {
    const lineRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(m[1])) !== null) {
      let code = parseInt(lm[3], 16);
      for (let cid = parseInt(lm[1], 16); cid <= parseInt(lm[2], 16); cid++) {
        map.set(cid, String.fromCodePoint(code++));
      }
    }
  }

  return map;
}

// ── Decode hex-encoded CIDs using a CMap ──────────────────────────────────
function decodeCidHex(hex: string, cmap: Map<number, string> | null): string {
  const result: string[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    const cid = parseInt(hex.slice(i, i + 4), 16);
    if (cid === 0) continue;
    if (cmap?.has(cid)) {
      result.push(cmap.get(cid)!);
    } else if (cid <= 0x0003) {
      result.push(" ");
    } else if (cid >= 0x0020 && cid <= 0x007e) {
      result.push(String.fromCharCode(cid));
    }
  }
  return result.join("").replace(/\s+/g, " ").trim();
}

// ── Extract text blocks from a decrypted PDF content stream ───────────────
function extractTextBlocks(
  stream: string,
  fontCmaps: Map<string, Map<number, string>>
): Array<{ font: string; text: string }> {
  const blocks: Array<{ font: string; text: string }> = [];
  let currentFont = "";

  const btRe = /BT([\s\S]*?)ET/g;
  let bm: RegExpExecArray | null;
  while ((bm = btRe.exec(stream)) !== null) {
    const block = bm[1];
    const fontM = block.match(/\/(F\d+)\s+[\d.]+\s+Tf/);
    if (fontM) currentFont = fontM[1];

    const cmap = fontCmaps.get(currentFont) ?? null;
    const hexMatches = block.match(/<([0-9A-Fa-f]{4,})>\s*Tj/g) || [];
    for (const hm of hexMatches) {
      const hex = hm.match(/<([0-9A-Fa-f]+)>/)?.[1];
      if (hex) {
        const text = decodeCidHex(hex, cmap);
        if (text.trim()) blocks.push({ font: currentFont, text });
      }
    }
  }

  return blocks;
}

// ── Main parser ────────────────────────────────────────────────────────────
export async function parseHousePtrPdf(pdfBytes: Buffer): Promise<ParsedPtr> {
  const flags: string[] = [];
  const buf = pdfBytes;
  const latin = buf.toString("binary");

  // Check for encryption
  if (!latin.includes("/Encrypt")) {
    flags.push("PDF is not encrypted — unexpected format, may need different parser");
  }

  // Parse encryption parameters
  const trailer = latin.slice(latin.lastIndexOf("trailer"), latin.lastIndexOf("trailer") + 500);
  const encN = parseInt(trailer.match(/\/Encrypt\s+(\d+)/)?.[1] || "0");
  const docId = hexVal(trailer.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>/)?.[1]);

  const index = buildObjIndex(latin);
  const encBody = getBody(latin, index, encN);

  const O = hexVal(encBody.match(/\/O\s*(<[^>]+>)/)?.[1]);
  const P = parseInt(encBody.match(/\/P\s+(-?\d+)/)?.[1] || "0");
  const keyLen = parseInt(encBody.match(/\/Length\s+(\d+)/)?.[1] || "128") / 8;

  // Algorithm 2: derive file encryption key with empty user password
  const md5Input = Buffer.concat([
    PDF_PAD,
    O,
    Buffer.from([P & 0xff, (P >> 8) & 0xff, (P >> 16) & 0xff, (P >> 24) & 0xff]),
    docId,
  ]);
  let fileKey = createHash("md5").update(md5Input).digest();
  for (let i = 0; i < 50; i++) {
    fileKey = createHash("md5").update(fileKey.slice(0, keyLen)).digest();
  }
  fileKey = fileKey.slice(0, keyLen);

  // Walk every page in document order, extracting text from whichever content
  // structure that page uses (Form XObject wrapper, or a direct /Contents stream).
  const pageOrder = findPageOrder(latin, index);
  const pages: PageContent[] = pageOrder.length
    ? pageOrder.map((p) => findPageContent(latin, index, p)).filter((p): p is PageContent => p !== null)
    : [findFallbackFormXObject(latin, index, encN)].filter((p): p is PageContent => p !== null);

  if (pages.length === 0) {
    flags.push("Could not find Form XObject — PTR may be image-only (scanned PDF)");
    return { flags, transactions: [] };
  }

  const blocks: Array<{ font: string; text: string }> = [];
  let anyCmapsFound = false;

  for (const page of pages) {
    const fontCmaps = new Map<string, Map<number, string>>();
    const fontRefRe = /\/(F\d+)\s+(\d+)\s+0\s+R/g;
    let fr: RegExpExecArray | null;
    while ((fr = fontRefRe.exec(page.fontResourceBody)) !== null) {
      const fname = fr[1];
      const fObjNum = parseInt(fr[2]);
      const fontBody = getBody(latin, index, fObjNum);
      const touM = fontBody.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      if (!touM) continue;
      const cmapText = decryptStream(buf, latin, index, fileKey, parseInt(touM[1]));
      if (cmapText) fontCmaps.set(fname, parseToUnicodeCmap(cmapText));
    }
    if (fontCmaps.size > 0) anyCmapsFound = true;

    const stream = decryptStream(buf, latin, index, fileKey, page.contentObjNum);
    if (!stream) continue;

    blocks.push(...extractTextBlocks(stream, fontCmaps));
  }

  if (!anyCmapsFound) {
    flags.push("No ToUnicode CMaps found — text may not decode correctly");
  }

  if (blocks.length === 0) {
    flags.push("Could not decrypt any page content stream");
    return { flags, transactions: [] };
  }

  // ── Identify the data font (the one with member names, dates, tickers) ──
  // Different PTR generations use different font names for the data (F6, F7, etc.)
  // The data font contains dates (MM/DD/YYYY), amounts, and ticker-like strings.
  // The label font contains short strings like "Name:", "Status:", column headers.
  const dateRe = /^\d{2}\/\d{2}\/\d{4}$/;
  const amountRe = /^\$[\d,]+ - \$[\d,]+$|^\$[\d,]+ -$|^Over \$[\d,]+$/i;

  const fontScores = new Map<string, number>();
  for (const { font, text } of blocks) {
    const t = text.trim();
    if (!t) continue;
    let score = fontScores.get(font) ?? 0;
    if (dateRe.test(t)) score += 5;
    if (amountRe.test(t)) score += 5;
    if (t.match(/^\[?[A-Z]{2,3}\]?$/) && t.length <= 6) score += 2; // [ST], GSK etc.
    if (t.includes("Clerk of the House")) score += 10;
    if (t.startsWith("Hon.")) score += 8;
    if (t.match(/^[A-Z]{2}\d{2}$/)) score += 5; // district code
    if (t.match(/^[A-Z]{1,2}[0-9]{1,5}[A-Z0-9]*$/)) score += 1; // ticker-ish
    fontScores.set(font, score);
  }
  const dataFont = [...fontScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "F6";

  const dataBlocks = blocks
    .filter(b => b.font === dataFont)
    .map(b => b.text)
    .filter(t => t.trim().length > 0);

  // Extract member name and district from the header block
  // Pattern: "Hon. First Last" or "First Last"
  let memberName: string | undefined;
  let district: string | undefined;
  let filingId: string | undefined;

  for (const text of dataBlocks) {
    // Member name: "Hon. First Last" without a date or comma+date suffix
    if (
      (text.startsWith("Hon.") || text.match(/^[A-Z][a-z]/)) &&
      !text.includes("Clerk") &&
      !text.match(/\d{2}\/\d{2}\/\d{4}/) &&  // skip lines with dates (Digitally Signed)
      !memberName
    ) {
      memberName = text.replace(/^Hon\.\s*/i, "").replace(/\s*,\s*$/, "").trim();
    }
    if (text.match(/^[A-Z]{2}\d{2}$/)) district = text;
    const fidM = text.match(/Filing ID #?(\d+)/i);
    if (fidM) filingId = fidM[1];
  }

  // Find transaction rows
  // Transaction data pattern:
  //   [owner?] asset description [ticker?] [assetType] [txnType?] date date $amount [capgains]
  // We use date-like strings as anchors and work backwards for asset, forwards for amount.
  const transactions: HousePtrTransaction[] = [];

  const tickerRe = /^\(([A-Z0-9.^-]+)\)$/;
  const assetTypeRe = /^\[([A-Z]{2,3})\]$/;
  const txnTypeMap: Record<string, string> = {
    P: "Purchase", S: "Sale", E: "Exchange", G: "Gift", O: "Other",
  };

  // Merge adjacent amount fragments ("$15,001 -" + "$50,000" → "$15,001 - $50,000")
  const mergedBlocks: string[] = [];
  for (let i = 0; i < dataBlocks.length; i++) {
    if (dataBlocks[i].match(/^\$[\d,]+ -$/) && i + 1 < dataBlocks.length && dataBlocks[i + 1].match(/^\$[\d,]+$/)) {
      mergedBlocks.push(`${dataBlocks[i]} ${dataBlocks[i + 1]}`);
      i++;
    } else {
      mergedBlocks.push(dataBlocks[i]);
    }
  }

  // Walk through merged blocks collecting transaction rows
  // A row typically looks like: [description] [ticker] [type] [txn-type] [date] [date] [amount] [gains]
  let i = 0;
  while (i < mergedBlocks.length) {
    const block = mergedBlocks[i];

    // Skip header / footer blocks
    if (
      block.includes("Clerk of the House") ||
      block.includes("CERTIFY") ||
      block.includes("Filing ID") ||
      block.includes("asset type abbreviations") ||
      block.includes("fd.house.gov") ||
      block === "Member" ||
      block === "Yes" ||
      block === "No" ||
      (block.startsWith("Hon.") && block.includes(","))
    ) {
      i++;
      continue;
    }

    // Skip district code and member name blocks we've already captured
    if (block.match(/^[A-Z]{2}\d{2}$/)) { i++; continue; }
    if (memberName && (block === memberName || block === `Hon. ${memberName}` || block.includes(memberName))) {
      i++; continue;
    }

    // Check if this looks like an asset description (substantial text, not a date/amount/ticker)
    if (
      block.length > 5 &&
      !dateRe.test(block) &&
      !amountRe.test(block) &&
      !tickerRe.test(block) &&
      !assetTypeRe.test(block) &&
      !txnTypeMap[block] &&
      block !== "F" && block.length > 2
    ) {
      // Looks like the start of a transaction row
      const tx: HousePtrTransaction = { assetDescription: block };

      // Peek at following blocks to fill in transaction fields
      let j = i + 1;
      while (j < mergedBlocks.length) {
        const next = mergedBlocks[j];

        const tickM = next.match(/^\(([A-Z0-9.^-]+)\)$/);
        if (tickM) { tx.ticker = tickM[1]; j++; continue; }

        const typeM = next.match(/^\[([A-Z]{2,3})\]$/);
        if (typeM) { tx.assetType = typeM[1]; j++; continue; }

        // Guard against reassignment: stray single-char noise from unrelated form
        // fields can land in the data font and coincidentally match P/S/E/G/O,
        // silently overwriting an already-correctly-parsed transaction type.
        if (!tx.transactionType && txnTypeMap[next]) { tx.transactionType = txnTypeMap[next]; j++; continue; }
        // Owner codes: Sp/SP=spouse, DC=dependent child, JT=joint
        if (next.match(/^(Sp|SP|DC|JT)$/i)) { tx.owner = next.toLowerCase() === "sp" ? "Spouse" : next; j++; continue; }
        // Ticker embedded in asset description as "Something (TICK)" — extract
        if (!tx.ticker && !tx.assetType) {
          const embeddedTicker = next.match(/\(([A-Z]{1,5})\)\s*$/) || block.match(/\(([A-Z]{1,5})\)\s*$/);
          if (embeddedTicker && next.length < 100) { tx.assetDescription = (tx.assetDescription + " " + next).trim(); j++; continue; }
        }

        // Field order varies between filings (dates can appear before or after
        // the ticker/asset-type marker), so plausibility — not position — decides
        // whether a date-shaped block is the real transaction date. A bond's
        // embedded call/maturity date (e.g. "CALL MAKE WHOLE ... 04/22/2036")
        // fails that check and gets folded into the description instead.
        if (dateRe.test(next)) {
          if (!tx.transactionDate && isPlausibleTransactionDate(next)) {
            tx.transactionDate = next;
          } else if (!tx.notificationDate && isPlausibleTransactionDate(next)) {
            tx.notificationDate = next;
          } else if (!isPlausibleTransactionDate(next)) {
            tx.assetDescription = (tx.assetDescription + " " + next).trim();
          }
          j++;
          continue;
        }

        if (amountRe.test(next)) { tx.amount = next; j++; continue; }

        // "F" = no, "T" = yes for capital gains checkbox
        if (next === "F" && tx.amount) { tx.capGains = "No"; j++; continue; }
        if (next === "T" && tx.amount) { tx.capGains = "Yes"; j++; continue; }

        // Once we hit a new potential asset description, stop this row
        if (!dateRe.test(next) && !amountRe.test(next) && next.length > 5 && j > i + 1) break;

        j++;
      }

      if (tx.transactionDate || tx.amount || tx.ticker) {
        // Extract ticker embedded at end of asset description: "...Common Stock (TMO)"
        if (!tx.ticker) {
          const embedded = tx.assetDescription.match(/\(([A-Z]{1,5})\)\s*$/);
          if (embedded) tx.ticker = embedded[1];
        }
        if (!tx.ticker) flags.push(`No ticker found for: "${tx.assetDescription.slice(0, 40)}"`);
        if (!tx.transactionDate) flags.push(`No date found for: "${tx.assetDescription.slice(0, 40)}"`);
        if (!tx.transactionType) tx.transactionType = "Unknown";
        transactions.push(tx);
        i = j;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  if (transactions.length === 0) {
    flags.push("No transactions parsed — review raw PDF manually");
  }

  return { memberName, district, filingId, transactions, flags };
}
