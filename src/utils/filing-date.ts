import type { FMPTrade } from "../types/index.js";

/**
 * Normalize a filing date to ISO (YYYY-MM-DD) so it can be compared and sorted.
 *
 * Providers hand us `dateRecieved` (FMP's typo, kept for schema compatibility)
 * as a US-style "M/D/YYYY" string — "9/9/2026", "01/06/2026". Those sort
 * lexically into nonsense, which is why the field has been written by every
 * provider but never read. ISO strings compare correctly as plain strings.
 *
 * Returns null for anything that isn't a recognizable date, so callers can
 * treat "unknown filing date" as "not new" rather than guessing.
 */
export function filingDateIso(trade: FMPTrade): string | null {
  const raw = trade.dateRecieved?.trim();
  if (!raw) return null;

  // Already ISO (some OCR'd filings come through this way).
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  const [, m, d, y] = us;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Latest filing date across a set of trades, or null if none are parseable. */
export function maxFilingDate(trades: FMPTrade[]): string | null {
  let max: string | null = null;
  for (const trade of trades) {
    const iso = filingDateIso(trade);
    if (iso && (max === null || iso > max)) max = iso;
  }
  return max;
}

/**
 * Build a predicate for "disclosed since the previous run".
 *
 * `baseline` is the previous run's high-water filing date. With no baseline
 * (first run after this feature, or a manifest with no history) nothing is
 * marked new — better a quiet page than one where all 10k rows light up.
 */
export function createNewlyDisclosedPredicate(
  baseline: string | null
): (trade: FMPTrade) => boolean {
  if (!baseline) return () => false;
  return (trade) => {
    const iso = filingDateIso(trade);
    return iso !== null && iso > baseline;
  };
}
