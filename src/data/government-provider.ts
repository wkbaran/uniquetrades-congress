/**
 * Government Data Provider
 *
 * Fetches congressional trade data directly from government sources:
 *   House: House Clerk annual filing index + PDF decryption per PTR
 *   Senate: Senate eFD individual PTR HTML pages (session-authenticated)
 *
 * Both chambers produce the same FMPTrade shape as the existing pipeline.
 * Includes detailed run-report logging to flag data quality issues.
 */

import { inflateRawSync } from "zlib";
import { createHash } from "crypto";
import { parseHousePtrPdf, expandHouseAssetType, type HousePtrTransaction } from "./house-pdf-parser.js";
import type { FMPTrade } from "../types/index.js";
import type { TradeSourceProvider } from "./trade-source.js";
import { loadData, saveData } from "../utils/storage.js";

// ── Constants ─────────────────────────────────────────────────────────────
const HOUSE_INDEX_URL = (year: number) =>
  `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.zip`;
const HOUSE_PTR_URL = (year: number, docId: string) =>
  `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${year}/${docId}.pdf`;
const SENATE_HOME_URL = "https://efdsearch.senate.gov/search/home/";
const SENATE_SEARCH_URL = "https://efdsearch.senate.gov/search/report/data/";

const HOUSE_SEEN_FILE = "house-seen-docids.json";
const SENATE_SEEN_FILE = "senate-seen-guids.json";
const USER_AGENT =
  "uniquetrades-congress/1.0 (bill.baran@gmail.com) government-data-scraper";

// ── Run report ─────────────────────────────────────────────────────────────
export interface ScrapeRunReport {
  runAt: string;
  house: ChamberReport;
  senate: ChamberReport;
}

interface ChamberReport {
  ptrsProcessed: number;
  ptrsSkipped: number;     // already seen
  ptrsErrored: number;
  tradesExtracted: number;
  flagged: FlaggedItem[];
}

interface FlaggedItem {
  docId: string;
  member?: string;
  issues: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function log(chamber: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`  [${ts}] [${chamber}] ${msg}`);
}

async function fetchWithUA(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: { "User-Agent": USER_AGENT, ...options?.headers },
  });
}

async function loadSeen(file: string): Promise<Set<string>> {
  const stored = await loadData<string[]>(file);
  return new Set(stored?.data ?? []);
}

async function saveSeen(file: string, seen: Set<string>) {
  await saveData(file, [...seen]);
}

// ── Amount range parser ───────────────────────────────────────────────────
function parseAmountRange(amount: string | undefined): { low: number; high: number } | null {
  if (!amount) return null;
  const m = amount.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/);
  if (m) return {
    low: parseInt(m[1].replace(/,/g, "")),
    high: parseInt(m[2].replace(/,/g, "")),
  };
  const over = amount.match(/Over \$([\d,]+)/i);
  if (over) {
    const v = parseInt(over[1].replace(/,/g, ""));
    return { low: v, high: v * 2 };
  }
  return null;
}

function normalizeTransactionType(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase();
  if (r.includes("purchase")) return "Purchase";
  if (r.includes("sale") || r === "s") return "Sale (Full)";
  if (r.includes("exchange") || r === "e") return "Exchange";
  return raw;
}

// ── Convert parsed PTR transaction to FMPTrade shape ─────────────────────
function toFMPTrade(
  tx: HousePtrTransaction,
  memberName: string,
  chamber: "senate" | "house",
  ptrLink: string,
  dateReceived?: string
): FMPTrade {
  const nameParts = memberName.replace(/^Hon\.\s*/i, "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(-1)[0] || "";

  const amountRange = parseAmountRange(tx.amount);
  const amountStr = tx.amount ?? undefined;

  return {
    firstName,
    lastName,
    office: undefined,
    link: ptrLink,
    dateRecieved: dateReceived,
    transactionDate: tx.transactionDate
      ? reformatDate(tx.transactionDate)
      : undefined,
    owner: tx.owner ?? "self",
    assetDescription: tx.assetDescription,
    assetType: expandHouseAssetType(tx.assetType) ?? "Stock",
    type: normalizeTransactionType(tx.transactionType),
    amount: amountStr,
    comment: tx.comment,
    symbol: tx.ticker,
  };
}

/** Convert MM/DD/YYYY → YYYY-MM-DD */
function reformatDate(d: string): string {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return d;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  HOUSE CLERK                                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

async function fetchHouseIndexDocIds(year: number, sinceDate: Date): Promise<
  Array<{ docId: string; firstName: string; lastName: string; filingDate: string; year: number }>
> {
  log("House", `Downloading ${year} filing index ZIP...`);
  const resp = await fetchWithUA(HOUSE_INDEX_URL(year));
  if (!resp.ok) {
    log("House", `  Warning: index ZIP for ${year} returned HTTP ${resp.status}`);
    return [];
  }
  const zipBuf = Buffer.from(await resp.arrayBuffer());
  log("House", `  Index ZIP: ${(zipBuf.length / 1024).toFixed(0)} KB`);

  // Unzip in memory — the ZIP has a simple structure (1-2 files)
  const xmlContent = extractXmlFromZip(zipBuf);
  if (!xmlContent) {
    log("House", "  Could not extract XML from ZIP");
    return [];
  }

  // Parse XML: <Member><Last>..</Last><First>..</First><FilingType>P</FilingType><FilingDate>M/D/YYYY</FilingDate><DocID>N</DocID></Member>
  const members: Array<{
    docId: string; firstName: string; lastName: string; filingDate: string; year: number;
  }> = [];

  const memberRe = /<Member>([\s\S]*?)<\/Member>/g;
  let m: RegExpExecArray | null;
  while ((m = memberRe.exec(xmlContent)) !== null) {
    const block = m[1];
    const getTag = (tag: string) =>
      block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))?.[1]?.trim() ?? "";

    if (getTag("FilingType") !== "P") continue; // Only PTRs

    const filingDate = getTag("FilingDate");
    // Filter by date
    if (filingDate) {
      const d = new Date(filingDate);
      if (!isNaN(d.getTime()) && d < sinceDate) continue;
    }

    members.push({
      docId: getTag("DocID"),
      firstName: getTag("First"),
      lastName: getTag("Last"),
      filingDate,
      year,
    });
  }

  log("House", `  Found ${members.length} PTR filings since ${sinceDate.toISOString().split("T")[0]}`);
  return members;
}

/** Minimal ZIP parser — extracts the XML from the House Clerk annual ZIP */
function extractXmlFromZip(zipBuf: Buffer): string | null {
  // Find local file headers (signature 0x04034b50)
  let pos = 0;
  while (pos < zipBuf.length - 30) {
    const sig = zipBuf.readUInt32LE(pos);
    if (sig !== 0x04034b50) { pos++; continue; }

    const compression = zipBuf.readUInt16LE(pos + 8);
    const compSize = zipBuf.readUInt32LE(pos + 18);
    const nameLen = zipBuf.readUInt16LE(pos + 26);
    const extraLen = zipBuf.readUInt16LE(pos + 28);
    const name = zipBuf.slice(pos + 30, pos + 30 + nameLen).toString("utf8");
    const dataStart = pos + 30 + nameLen + extraLen;

    if (name.endsWith(".xml")) {
      const compData = zipBuf.slice(dataStart, dataStart + compSize);
      if (compression === 0) {
        return compData.toString("utf8"); // Stored (no compression)
      } else if (compression === 8) {
        return inflateRawSync(compData).toString("utf8"); // DEFLATE
      }
    }
    pos = dataStart + compSize;
  }
  return null;
}

async function processHousePtr(
  entry: { docId: string; firstName: string; lastName: string; filingDate: string; year: number },
  chamberReport: ChamberReport
): Promise<FMPTrade[]> {
  const ptrUrl = HOUSE_PTR_URL(entry.year, entry.docId);
  log("House", `Processing PTR ${entry.docId}: ${entry.lastName}, ${entry.firstName}`);

  let pdfBytes: Buffer;
  try {
    const resp = await fetchWithUA(ptrUrl);
    if (!resp.ok) {
      log("House", `  ⚠️  HTTP ${resp.status} — skipping`);
      chamberReport.ptrsErrored++;
      chamberReport.flagged.push({
        docId: entry.docId,
        member: `${entry.firstName} ${entry.lastName}`,
        issues: [`HTTP ${resp.status} fetching PDF`],
      });
      return [];
    }
    pdfBytes = Buffer.from(await resp.arrayBuffer());
  } catch (e) {
    log("House", `  ⚠️  Fetch error: ${(e as Error).message}`);
    chamberReport.ptrsErrored++;
    return [];
  }

  let parsed;
  try {
    parsed = await parseHousePtrPdf(pdfBytes);
  } catch (e) {
    log("House", `  ⚠️  Parse error: ${(e as Error).message}`);
    chamberReport.ptrsErrored++;
    chamberReport.flagged.push({
      docId: entry.docId,
      member: `${entry.firstName} ${entry.lastName}`,
      issues: [`Parse error: ${(e as Error).message}`],
    });
    return [];
  }

  const memberName = parsed.memberName ?? `${entry.firstName} ${entry.lastName}`;
  const trades = parsed.transactions.map(tx =>
    toFMPTrade(tx, memberName, "house", ptrUrl, entry.filingDate)
  );

  chamberReport.ptrsProcessed++;
  chamberReport.tradesExtracted += trades.length;

  const txSummary = trades
    .map(t => `${t.symbol || "???"} ${t.type || "?"} ${t.amount || "?"}`)
    .join(", ");
  log("House", `  ✅ ${trades.length} trade(s): ${txSummary.slice(0, 80)}`);

  if (parsed.flags.length > 0) {
    log("House", `  ⚠️  Flags: ${parsed.flags.join("; ")}`);
    chamberReport.flagged.push({
      docId: entry.docId,
      member: memberName,
      issues: parsed.flags,
    });
  }

  return trades;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  SENATE EFD                                                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Accept terms and return a session cookie string */
async function acceptSenatEfdTerms(): Promise<string | null> {
  // Get CSRF token from home page
  const homeResp = await fetchWithUA(SENATE_HOME_URL);
  if (!homeResp.ok) return null;
  const homeHtml = await homeResp.text();

  const csrf = homeHtml.match(/csrfmiddlewaretoken[^>]*value="([^"]+)"/)?.[1];
  const setCookie = homeResp.headers.get("set-cookie") || "";
  const csrfCookie = setCookie.match(/csrftoken=([^;]+)/)?.[1];
  if (!csrf || !csrfCookie) return null;

  const cookieHeader = `csrftoken=${csrfCookie}`;

  // POST acceptance
  const acceptResp = await fetchWithUA(SENATE_HOME_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": SENATE_HOME_URL,
      "Cookie": cookieHeader,
    },
    body: `prohibition_agreement=1&csrfmiddlewaretoken=${encodeURIComponent(csrf)}`,
    redirect: "manual",
  });

  const sessionCookie = acceptResp.headers.get("set-cookie")?.match(/sessionid=([^;]+)/)?.[1];
  if (!sessionCookie) {
    // Try reading session from subsequent redirect cookie
    return cookieHeader;
  }
  return `${cookieHeader}; sessionid=${sessionCookie}`;
}

async function fetchSenatePtrGuids(
  cookie: string,
  sinceDate: Date
): Promise<Array<{ guid: string; senator: string; filedDate: string }>> {
  // The AJAX search API returns JSON with PTR (report type 11) filings
  const startDate = sinceDate.toLocaleDateString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric"
  });

  const searchUrl = `${SENATE_SEARCH_URL}?report_types%5B%5D=11&limit=200&offset=0&order_by=-date_received`;

  const resp = await fetchWithUA(searchUrl, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json",
      "Referer": "https://efdsearch.senate.gov/search/",
      "Cookie": cookie,
    },
  });

  if (!resp.ok) {
    log("Senate", `  Search API returned ${resp.status} — skipping (API may be in maintenance)`);
    return [];
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    log("Senate", "  Search API returned non-JSON — skipping");
    return [];
  }

  const data = (json as { data?: unknown[] }).data ?? [];
  const results: Array<{ guid: string; senator: string; filedDate: string }> = [];

  for (const row of data) {
    const r = row as { first_name?: string; last_name?: string; filed_date?: string; link?: string[] };
    const link = r.link?.[0] || r.link?.[1] || "";
    const guidM = link.match(/\/ptr\/([a-f0-9-]+)\//);
    if (!guidM) continue;

    const filedDate = r.filed_date || "";
    if (filedDate) {
      const d = new Date(filedDate);
      if (!isNaN(d.getTime()) && d < sinceDate) continue;
    }

    results.push({
      guid: guidM[1],
      senator: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      filedDate,
    });
  }

  return results;
}

function parseSenatePtrPage(html: string): {
  memberName?: string;
  filingDate?: string;
  transactions: Array<{
    transactionDate: string;
    owner: string;
    ticker: string;
    assetDescription: string;
    assetType: string;
    transactionType: string;
    amount: string;
    comment: string;
  }>;
  flags: string[];
} {
  const flags: string[] = [];

  // Extract member name from title
  const memberM = html.match(/Periodic Transaction Report for[\s\S]*?The Honorable ([^\n(]+)/);
  const memberName = memberM ? memberM[1].trim() : undefined;

  const filingM = html.match(/Filed (\d{2}\/\d{2}\/\d{4})/);
  const filingDate = filingM ? filingM[1] : undefined;

  // Strip tags for text parsing
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#35;/g, "#")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ");

  // Parse transaction table
  // Pattern: # | date | owner | ticker | asset | type | txn_type | amount | comment
  const transactions: ReturnType<typeof parseSenatePtrPage>["transactions"] = [];

  // Find the transactions list block
  const txListStart = text.indexOf("List of transactions added to this report");
  if (txListStart < 0) {
    flags.push("No transaction list found in PTR page");
    return { memberName, filingDate, transactions, flags };
  }

  const txSection = text.slice(txListStart);

  // Each row: number, date, owner, ticker, asset, type, txntype, amount, comment
  // The numbers are sequential: 1, 2, 3...
  // Dates match MM/DD/YYYY
  const rowRe = /\d+\s+(\d{2}\/\d{2}\/\d{4})\s+(Self|Joint|Spouse|Dependent Child)\s+(\S+)\s+([^\n]+?)\s+(Stock|Option|Other|Bond|ETF|Cryptocurrency|Mutual Fund(?:\s+\(Not ETF\))?)\s+(Purchase|Sale \(Full\)|Sale \(Partial\)|Exchange)\s+(\$[^\n]+?)\s+(--[^\n]*|[^\n]{0,100})/g;

  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(txSection)) !== null) {
    const ticker = rm[3] === "--" ? "" : rm[3];
    transactions.push({
      transactionDate: rm[1],
      owner: rm[2],
      ticker,
      assetDescription: rm[4].trim(),
      assetType: rm[5].trim(),
      transactionType: rm[6].trim(),
      amount: rm[7].trim(),
      comment: rm[8].trim(),
    });
  }

  // Fallback: look for simpler date+ticker pattern if structured parse fails
  if (transactions.length === 0) {
    const simpleDateRe = /(\d{2}\/\d{2}\/\d{4})\s+(Self|Joint|Spouse|Dependent Child)\s+([A-Z\--.]{1,10})\s+/g;
    while ((rm = simpleDateRe.exec(txSection)) !== null) {
      transactions.push({
        transactionDate: rm[1],
        owner: rm[2],
        ticker: rm[3] === "--" ? "" : rm[3],
        assetDescription: "",
        assetType: "Stock",
        transactionType: "Purchase",
        amount: "",
        comment: "",
      });
    }
    if (transactions.length > 0) {
      flags.push("Used fallback parser — transaction details may be incomplete");
    }
  }

  if (transactions.length === 0) {
    flags.push("No transactions found in PTR page — review manually");
  }

  return { memberName, filingDate, transactions, flags };
}

async function processSenatePtr(
  entry: { guid: string; senator: string; filedDate: string },
  cookie: string,
  chamberReport: ChamberReport
): Promise<FMPTrade[]> {
  const ptrUrl = `https://efdsearch.senate.gov/search/view/ptr/${entry.guid}/`;
  log("Senate", `Processing PTR ${entry.guid}: ${entry.senator}`);

  let html: string;
  try {
    const resp = await fetchWithUA(ptrUrl, {
      headers: { Cookie: cookie, Referer: "https://efdsearch.senate.gov/search/" },
    });
    if (!resp.ok) {
      log("Senate", `  ⚠️  HTTP ${resp.status}`);
      chamberReport.ptrsErrored++;
      return [];
    }
    html = await resp.text();
  } catch (e) {
    log("Senate", `  ⚠️  Fetch error: ${(e as Error).message}`);
    chamberReport.ptrsErrored++;
    return [];
  }

  const parsed = parseSenatePtrPage(html);
  const memberName = parsed.memberName ?? entry.senator;

  const trades: FMPTrade[] = parsed.transactions.map(tx => {
    const nameParts = memberName.replace(/^Hon\.\s*/i, "").trim().split(/\s+/);
    return {
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(-1)[0] || "",
      office: undefined,
      link: ptrUrl,
      dateRecieved: parsed.filingDate,
      transactionDate: reformatDate(tx.transactionDate),
      owner: tx.owner,
      assetDescription: tx.assetDescription,
      assetType: tx.assetType,
      type: tx.transactionType,
      amount: tx.amount,
      comment: tx.comment === "--" ? undefined : tx.comment,
      symbol: tx.ticker || undefined,
    };
  });

  chamberReport.ptrsProcessed++;
  chamberReport.tradesExtracted += trades.length;

  const txSummary = trades
    .map(t => `${t.symbol || "???"} ${t.type || "?"} ${t.amount || "?"}`)
    .join(", ");
  log("Senate", `  ✅ ${trades.length} trade(s): ${txSummary.slice(0, 80)}`);

  if (parsed.flags.length > 0) {
    log("Senate", `  ⚠️  Flags: ${parsed.flags.join("; ")}`);
    chamberReport.flagged.push({ docId: entry.guid, member: memberName, issues: parsed.flags });
  }

  return trades;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  GovernmentProvider — TradeSourceProvider implementation                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export class GovernmentProvider implements TradeSourceProvider {
  private lastRunReport: ScrapeRunReport | null = null;

  getName(): string { return "Government (House Clerk + Senate eFD)"; }

  async fetchSenateTrades(sinceDate: Date): Promise<FMPTrade[]> {
    const chamberReport: ChamberReport = {
      ptrsProcessed: 0, ptrsSkipped: 0, ptrsErrored: 0, tradesExtracted: 0, flagged: [],
    };

    log("Senate", `Fetching trades since ${sinceDate.toISOString().split("T")[0]}`);

    // Accept terms
    const cookie = await acceptSenatEfdTerms();
    if (!cookie) {
      log("Senate", "⚠️  Could not accept eFD terms — skipping Senate fetch");
      return [];
    }
    log("Senate", "Session established");

    // Get known GUIDs
    const seen = await loadSeen(SENATE_SEEN_FILE);
    log("Senate", `${seen.size} PTRs already seen`);

    // Fetch new PTR GUIDs from search
    const entries = await fetchSenatePtrGuids(cookie, sinceDate);
    log("Senate", `${entries.length} PTR(s) from search (${entries.filter(e => seen.has(e.guid)).length} already seen)`);

    const trades: FMPTrade[] = [];
    let delay = 1000;

    for (const entry of entries) {
      if (seen.has(entry.guid)) { chamberReport.ptrsSkipped++; continue; }

      await new Promise(r => setTimeout(r, delay));
      const entryTrades = await processSenatePtr(entry, cookie, chamberReport);
      trades.push(...entryTrades);
      seen.add(entry.guid);
    }

    await saveSeen(SENATE_SEEN_FILE, seen);
    this.lastRunReport = { ...this.lastRunReport!, senate: chamberReport } as ScrapeRunReport;

    log("Senate", `Done: ${chamberReport.ptrsProcessed} processed, ${chamberReport.tradesExtracted} trades, ${chamberReport.flagged.length} flagged`);
    return trades;
  }

  async fetchHouseTrades(sinceDate: Date): Promise<FMPTrade[]> {
    const chamberReport: ChamberReport = {
      ptrsProcessed: 0, ptrsSkipped: 0, ptrsErrored: 0, tradesExtracted: 0, flagged: [],
    };
    this.lastRunReport = {
      runAt: new Date().toISOString(),
      house: chamberReport,
      senate: { ptrsProcessed: 0, ptrsSkipped: 0, ptrsErrored: 0, tradesExtracted: 0, flagged: [] },
    };

    log("House", `Fetching trades since ${sinceDate.toISOString().split("T")[0]}`);

    const seen = await loadSeen(HOUSE_SEEN_FILE);
    log("House", `${seen.size} PTRs already seen`);

    // Fetch index for current year and previous year (in case sinceDate spans year boundary)
    const currentYear = new Date().getFullYear();
    const years = sinceDate.getFullYear() < currentYear
      ? [sinceDate.getFullYear(), currentYear]
      : [currentYear];

    const allEntries: Array<{
      docId: string; firstName: string; lastName: string; filingDate: string; year: number;
    }> = [];

    for (const year of years) {
      const entries = await fetchHouseIndexDocIds(year, sinceDate);
      allEntries.push(...entries);
    }

    const newEntries = allEntries.filter(e => !seen.has(e.docId));
    log("House", `${allEntries.length} PTRs in date range, ${newEntries.length} new`);

    if (newEntries.length === 0) {
      log("House", "Nothing new to process");
      return [];
    }

    const trades: FMPTrade[] = [];
    let i = 0;

    for (const entry of newEntries) {
      i++;
      process.stdout.write(
        `\r  [House] Processing ${i}/${newEntries.length}: ${entry.lastName}, ${entry.firstName}                `
      );

      await new Promise(r => setTimeout(r, 800)); // 800ms between PDF fetches
      const entryTrades = await processHousePtr(entry, chamberReport);
      trades.push(...entryTrades);
      seen.add(entry.docId);
    }
    process.stdout.write("\n");

    await saveSeen(HOUSE_SEEN_FILE, seen);
    this.lastRunReport!.house = chamberReport;

    log("House", `Done: ${chamberReport.ptrsProcessed} processed, ${chamberReport.tradesExtracted} trades, ${chamberReport.flagged.length} flagged, ${chamberReport.ptrsErrored} errors`);

    return trades;
  }

  /** Save and print the run report */
  async saveRunReport(dataDir = "data"): Promise<string> {
    if (!this.lastRunReport) return "";
    const report = this.lastRunReport;
    const filename = `scrape-report-${report.runAt.slice(0, 10)}.json`;
    await saveData(filename, report, "reports");

    console.log("\n" + "═".repeat(60));
    console.log("GOVERNMENT SCRAPE RUN REPORT");
    console.log("═".repeat(60));

    for (const chamber of ["house", "senate"] as const) {
      const r = report[chamber];
      console.log(`\n${chamber.toUpperCase()}:`);
      console.log(`  PTRs processed: ${r.ptrsProcessed}`);
      console.log(`  PTRs skipped (seen): ${r.ptrsSkipped}`);
      console.log(`  PTRs errored: ${r.ptrsErrored}`);
      console.log(`  Trades extracted: ${r.tradesExtracted}`);
      if (r.flagged.length > 0) {
        console.log(`  Flagged for review (${r.flagged.length}):`);
        for (const f of r.flagged) {
          console.log(`    • ${f.member ?? f.docId}: ${f.issues.join("; ")}`);
        }
      } else {
        console.log("  No items flagged.");
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log(`Full report: data/reports/${filename}`);

    return filename;
  }
}

export function createGovernmentProvider(): GovernmentProvider {
  return new GovernmentProvider();
}
