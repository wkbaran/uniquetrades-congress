import type { FMPTrade, Legislator } from "../types/index.js";
import { resolveLegislator } from "../services/committee-service.js";

/** Filename-safe slug for a member name, e.g. "María Elvira Salazar" → "maria-elvira-salazar" */
export function memberKey(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface MemberIdentity {
  /** Stable slug used for the member page filename (member-<key>.html) */
  key: string;
  /** Display name for the member page heading */
  name: string;
  chamber?: "Sen." | "Rep.";
  bioguide?: string;
}

export type MemberResolver = (trade: Pick<FMPTrade, "firstName" | "lastName">) => MemberIdentity | null;

const NOISE_WORDS = /^(mr|mrs|ms|miss|dr|hon|rep|sen|jr|sr|ii|iii|iv)$/i;

/** Split a filed name into words, dropping initials, honorifics and suffixes. */
function cleanWords(s: string): string[] {
  return s.split(/\s+/)
    .map((w) => w.replace(/[.,]+$/, ""))
    .filter((w) => w.length > 1 && !NOISE_WORDS.test(w));
}

/**
 * Build the single source of truth for "which member page does this trade belong to".
 * Filers spell their names inconsistently across disclosures ("Greg"/"W. Gregory",
 * "John J Mr", "Kelly Louise"), so members are identified by bioguide ID when the
 * legislators data can resolve them, and by a normalized first-given-name + last-name
 * slug otherwise.
 */
export function createMemberResolver(legislators?: Legislator[]): MemberResolver {
  const cache = new Map<string, MemberIdentity | null>();

  return (trade) => {
    const first = trade.firstName ?? "";
    const last = trade.lastName ?? "";
    const cacheKey = `${first}|${last}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    let identity: MemberIdentity | null = null;
    const leg = legislators && first && last ? resolveLegislator(first, last, legislators) : null;

    if (leg) {
      const { name } = leg;
      // "J. French Hill" goes by his middle name
      const given = /^[A-Za-z]\.?$/.test(name.first) && name.middle ? name.middle : name.first;
      const term = leg.terms[leg.terms.length - 1];
      identity = {
        key: memberKey(`${given} ${name.last}`),
        name: name.official_full ?? `${given} ${name.last}`,
        chamber: term ? (term.type === "sen" ? "Sen." : "Rep.") : undefined,
        bioguide: leg.id.bioguide,
      };
    } else {
      const firstWords = cleanWords(first);
      const lastWords = cleanWords(last);
      const name = [firstWords[0] ?? "", ...lastWords].join(" ").trim();
      if (name) identity = { key: memberKey(name), name };
    }

    cache.set(cacheKey, identity);
    return identity;
  };
}
