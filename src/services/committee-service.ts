import {
  CommitteesResponseSchema,
  CommitteeMembershipResponseSchema,
  LegislatorsResponseSchema,
  type Committee,
  type CommitteeMembershipResponse,
  type CommitteeData,
  type CommitteeSectorMapping,
  type Legislator,
  type LegislatorPartyMap,
} from "../types/index.js";
import { mapCommitteeToSectors } from "../mappings/committee-sectors.js";
import { saveData, loadData } from "../utils/storage.js";

const COMMITTEES_URL =
  "https://unitedstates.github.io/congress-legislators/committees-current.json";
const MEMBERSHIP_URL =
  "https://unitedstates.github.io/congress-legislators/committee-membership-current.json";
const LEGISLATORS_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const LEGISLATORS_HISTORICAL_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-historical.json";
// Former members whose service ended on/after this date are kept so trades they
// filed (or that surface in late disclosures) still resolve after they leave office.
const FORMER_MEMBERS_SINCE = "2025-01-01";

const COMMITTEES_FILE = "committees.json";
const MEMBERSHIP_FILE = "membership.json";
const LEGISLATORS_FILE = "legislators.json";
const COMMITTEE_DATA_FILE = "committee-data.json";

/**
 * Fetch current committees from congress-legislators
 */
export async function fetchCommittees(): Promise<Committee[]> {
  const response = await fetch(COMMITTEES_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch committees: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const committees = CommitteesResponseSchema.parse(data);

  await saveData(COMMITTEES_FILE, committees);
  console.log(`Fetched and saved ${committees.length} committees`);

  return committees;
}

/**
 * Fetch current committee membership from congress-legislators
 */
export async function fetchMembership(): Promise<CommitteeMembershipResponse> {
  const response = await fetch(MEMBERSHIP_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch membership: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const membership = CommitteeMembershipResponseSchema.parse(data);

  await saveData(MEMBERSHIP_FILE, membership);

  const totalMembers = Object.values(membership).reduce(
    (sum, members) => sum + members.length,
    0
  );
  console.log(
    `Fetched and saved membership data: ${Object.keys(membership).length} committees, ${totalMembers} total assignments`
  );

  return membership;
}

/**
 * Fetch current legislators plus recently departed ones from congress-legislators.
 * Members who resign or lose their seat move to the historical file, but their
 * disclosures stay in the trade data, so they still need a name and party.
 */
export async function fetchLegislators(): Promise<Legislator[]> {
  const response = await fetch(LEGISLATORS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch legislators: ${response.status} ${response.statusText}`
    );
  }

  const current = LegislatorsResponseSchema.parse(await response.json());

  let former: Legislator[] = [];
  try {
    const histResponse = await fetch(LEGISLATORS_HISTORICAL_URL);
    if (!histResponse.ok) throw new Error(`${histResponse.status} ${histResponse.statusText}`);
    // Filter before validating: the full history (1789 onward) has entries the
    // schema doesn't cover, and only recent members matter here.
    const history = (await histResponse.json()) as Array<{ id?: { bioguide?: string }; terms?: Array<{ end?: string }> }>;
    const currentIds = new Set(current.map((l) => l.id.bioguide));
    former = LegislatorsResponseSchema.parse(
      history.filter((l) =>
        (l.terms?.at(-1)?.end ?? "") >= FORMER_MEMBERS_SINCE &&
        !currentIds.has(l.id?.bioguide ?? "")
      )
    );
  } catch (error) {
    console.warn("Warning: Could not fetch former legislators:", (error as Error).message);
  }

  const legislators = [...current, ...former];
  await saveData(LEGISLATORS_FILE, legislators);
  console.log(
    `Fetched and saved ${legislators.length} legislators (${current.length} current, ${former.length} former since ${FORMER_MEMBERS_SINCE})`
  );

  return legislators;
}

/** A legislator whose most recent term hasn't ended yet */
export function isCurrentLegislator(legislator: Legislator, today = new Date().toISOString().slice(0, 10)): boolean {
  return (legislator.terms.at(-1)?.end ?? "") >= today;
}

/**
 * Load cached legislators data
 */
export async function loadLegislators(): Promise<Legislator[] | null> {
  const stored = await loadData<Legislator[]>(LEGISLATORS_FILE);
  return stored?.data || null;
}

/**
 * Build a map of bioguide ID to party name from legislators data
 * Uses the most recent term's party affiliation
 */
export function buildPartyMap(legislators: Legislator[]): LegislatorPartyMap {
  const partyMap: LegislatorPartyMap = new Map();

  for (const legislator of legislators) {
    const bioguide = legislator.id.bioguide;
    // Get the most recent term (last in the array)
    const currentTerm = legislator.terms[legislator.terms.length - 1];
    if (currentTerm) {
      partyMap.set(bioguide, currentTerm.party);
    }
  }

  return partyMap;
}

/**
 * Get party for a member by bioguide ID
 * Falls back to the provided fallback (e.g., "majority"/"minority") if not found
 */
export function getMemberParty(
  bioguideId: string | undefined,
  partyMap: LegislatorPartyMap | null,
  fallback?: string
): string {
  if (!bioguideId || !partyMap) {
    return fallback || "Unknown";
  }
  return partyMap.get(bioguideId) || fallback || "Unknown";
}

/**
 * Generate sector mappings for all committees
 */
export function generateSectorMappings(
  committees: Committee[]
): CommitteeSectorMapping[] {
  const mappings: CommitteeSectorMapping[] = [];

  for (const committee of committees) {
    const mapping = mapCommitteeToSectors(committee);
    mappings.push(mapping);

    // Also process subcommittees if they exist
    if (committee.subcommittees) {
      for (const sub of committee.subcommittees) {
        const subCommittee: Committee = {
          type: committee.type,
          name: `${committee.name} - ${sub.name}`,
          thomas_id: sub.thomas_id,
        };
        const subMapping = mapCommitteeToSectors(subCommittee);
        // Inherit parent sectors if subcommittee has none
        if (subMapping.sectors.length === 0) {
          subMapping.sectors = [...mapping.sectors];
        }
        mappings.push(subMapping);
      }
    }
  }

  return mappings;
}

/**
 * Fetch all committee data and generate mappings
 */
export async function fetchAllCommitteeData(): Promise<CommitteeData> {
  console.log("Fetching committee data...");

  const [committees, membership] = await Promise.all([
    fetchCommittees(),
    fetchMembership(),
  ]);

  // Try to fetch legislators for party info, but don't fail if it errors
  let legislators: Legislator[] | undefined;
  try {
    legislators = await fetchLegislators();
  } catch (error) {
    console.warn("Warning: Could not fetch legislators data:", error);
    console.warn("Party affiliations will show as majority/minority");
  }

  console.log("Generating sector mappings...");
  const sectorMappings = generateSectorMappings(committees);

  const mappingsWithSectors = sectorMappings.filter(
    (m) => m.sectors.length > 0
  );
  console.log(
    `Generated ${sectorMappings.length} committee mappings (${mappingsWithSectors.length} with sector associations)`
  );

  const committeeData: CommitteeData = {
    committees,
    membership,
    sectorMappings,
    legislators,
  };

  await saveData(COMMITTEE_DATA_FILE, committeeData);
  console.log("Committee data saved to", COMMITTEE_DATA_FILE);

  return committeeData;
}

/**
 * Load cached committee data
 */
export async function loadCommitteeData(): Promise<CommitteeData | null> {
  const stored = await loadData<CommitteeData>(COMMITTEE_DATA_FILE);
  return stored?.data || null;
}

/**
 * Find which committees a congress member belongs to
 */
export function getMemberCommittees(
  bioguideId: string,
  membership: CommitteeMembershipResponse
): string[] {
  const committees: string[] = [];

  for (const [committeeId, members] of Object.entries(membership)) {
    const isMember = members.some((m) => m.bioguide === bioguideId);
    if (isMember) {
      committees.push(committeeId);
    }
  }

  return committees;
}

/**
 * Check if a first name matches, handling initials
 * e.g., "J." matches "James", "James" matches "James"
 */
function firstNameMatches(searchName: string, memberName: string): boolean {
  const search = searchName.toLowerCase().trim();
  const member = memberName.toLowerCase().trim();

  // Exact match
  if (member.includes(search)) return true;

  // Check if member name starts with search initial
  // e.g., search="james", member="j." or "j. french"
  const searchInitial = search.charAt(0);
  const memberParts = member.split(/[\s.]+/);
  for (const part of memberParts) {
    if (part.length === 1 && part === searchInitial) return true;
  }

  // Check if search name is an initial that matches member
  // e.g., search="j", member="james"
  if (search.length <= 2 && member.startsWith(search.replace(".", ""))) {
    return true;
  }

  return false;
}

const NAME_NOISE = new Set(["mr", "mrs", "ms", "miss", "dr", "hon", "rep", "sen", "jr", "sr", "ii", "iii", "iv"]);

// Formal name → common short forms, for filings that use a nickname the
// legislators data doesn't list (e.g. "Richard" vs "Rich", "Matthew" vs "Matt").
const NICKNAMES: string[][] = [
  ["william", "bill", "will", "billy"], ["james", "jim", "jimmy", "jamie"],
  ["richard", "rick", "rich", "dick"], ["david", "dave"], ["daniel", "dan", "danny"],
  ["elizabeth", "liz", "lizzie", "beth", "betsy"], ["robert", "rob", "bob", "bobby"],
  ["michael", "mike"], ["thomas", "tom", "tommy"], ["matthew", "matt"],
  ["rudolph", "rudy"], ["valerie", "val"], ["gregory", "greg"], ["donald", "don"],
  ["edward", "ed", "eddie"], ["christopher", "chris"], ["joseph", "joe"],
  ["katherine", "kate", "kathy", "katie"], ["nicholas", "nick"], ["jonathan", "jon"],
  ["steven", "steve"], ["stephen", "steve"], ["charles", "chuck", "chip"],
  ["theodore", "ted"], ["frederick", "fred"], ["patrick", "pat"], ["anthony", "tony"],
  // Scanned PTRs list "Rohit Khanna"; the legislators data only knows "Ro"
  ["rohit", "ro"],
];

/** Lowercase, strip accents/punctuation, and drop initials, honorifics and suffixes. */
export function nameTokens(s: string): string[] {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/["'().,]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NAME_NOISE.has(t));
}

function givenNamesCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (NICKNAMES.some((g) => g.includes(a) && g.includes(b))) return true;
  return Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a));
}

function endsWithTokens(tokens: string[], tail: string[]): boolean {
  return tail.length <= tokens.length && tail.every((t, i) => tokens[tokens.length - tail.length + i] === t);
}

/**
 * Resolve a filer name (as written on a disclosure) to a single legislator.
 * Requires both a whole-word last-name match and a compatible given name, and
 * refuses ambiguous results, so different people who share a last name
 * (Susie/Laurel Lee, Dave/Rich McCormick) never collapse into one.
 * Sitting members are matched first; former members are only considered when
 * no sitting member matches, so a departed namesake can't steal a current filer.
 */
export function resolveLegislator(
  firstName: string,
  lastName: string,
  legislators: Legislator[]
): Legislator | null {
  const lastToks = nameTokens(lastName);
  if (lastToks.length === 0) return null;

  const current = legislators.filter((l) => isCurrentLegislator(l));
  const fromCurrent = bestLegislatorMatch(firstName, lastToks, current);
  if (fromCurrent.best || fromCurrent.tied) return fromCurrent.tied ? null : fromCurrent.best;

  const former = legislators.filter((l) => !isCurrentLegislator(l));
  const fromFormer = bestLegislatorMatch(firstName, lastToks, former);
  return fromFormer.tied ? null : fromFormer.best;
}

function bestLegislatorMatch(
  firstName: string,
  lastToks: string[],
  legislators: Legislator[]
): { best: Legislator | null; tied: boolean } {
  const rawFirst = firstName.trim();

  let best: Legislator | null = null;
  let bestScore = 0;
  let tied = false;

  for (const leg of legislators) {
    const legLast = nameTokens(leg.name.last);
    if (legLast.length === 0) continue;
    // Filers sometimes spill a middle name into the last-name field ("Moore Capito",
    // "M. Collins") or drop a surname prefix ("Epps" for "Van Epps").
    let spill: string[];
    if (endsWithTokens(lastToks, legLast)) spill = lastToks.slice(0, lastToks.length - legLast.length);
    else if (endsWithTokens(legLast, lastToks)) spill = [];
    else continue;

    const given = [...nameTokens(rawFirst), ...spill];
    const primary = nameTokens(leg.name.first)[0];
    const nick = leg.name.nickname ? nameTokens(leg.name.nickname)[0] : undefined;
    const legGiven = new Set([
      ...nameTokens(leg.name.first),
      ...nameTokens(leg.name.middle ?? ""),
      ...nameTokens(leg.name.nickname ?? ""),
      ...nameTokens(leg.name.official_full ?? "").filter((t) => !legLast.includes(t)),
    ]);

    let score = 0;
    if (given.length > 0 && (given[0] === primary || given[0] === nick)) score = 3;
    else if (given.some((g) => [...legGiven].some((l) => givenNamesCompatible(g, l)))) score = 2;
    else if (/^[a-z]\.?$/i.test(leg.name.first) && rawFirst.toLowerCase().startsWith(leg.name.first[0].toLowerCase())) score = 1;
    if (score === 0) continue;

    if (score > bestScore) { best = leg; bestScore = score; tied = false; }
    else if (score === bestScore) tied = true;
  }

  return { best, tied };
}

/**
 * Find congress member by name in membership data
 * Returns bioguide ID if found
 */
export function findMemberByName(
  firstName: string,
  lastName: string,
  membership: CommitteeMembershipResponse,
  legislators?: Legislator[]
): string | null {
  if (legislators) {
    const leg = resolveLegislator(firstName, lastName, legislators);
    if (leg) return leg.id.bioguide;
  }

  const normalizedFirst = firstName.toLowerCase().trim();
  const normalizedLast = lastName.toLowerCase().trim();
  // Whole-word match: a plain substring check let "Hill" match "Hillary J. Scholten"
  const lastRe = new RegExp(`(^|[^a-z])${normalizedLast.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);

  // First, search committee membership
  for (const members of Object.values(membership)) {
    for (const member of members) {
      const memberName = member.name.toLowerCase();

      // Must have last name
      if (!lastRe.test(memberName)) continue;

      // Check first name with initial handling
      if (firstNameMatches(normalizedFirst, memberName)) {
        return member.bioguide || null;
      }
    }
  }

  // If not found in membership, search legislators directly
  // (handles members not on any committees)
  if (legislators) {
    for (const legislator of legislators) {
      const legFirst = (legislator.name.first || "").toLowerCase();
      const legLast = (legislator.name.last || "").toLowerCase();
      const legOfficial = (legislator.name.official_full || "").toLowerCase();

      // Must have last name match
      if (legLast !== normalizedLast && !legOfficial.includes(normalizedLast)) {
        continue;
      }

      // Try exact match on first name
      if (legFirst === normalizedFirst) {
        return legislator.id.bioguide;
      }

      // Try initial match
      if (firstNameMatches(normalizedFirst, legFirst) ||
          firstNameMatches(normalizedFirst, legOfficial)) {
        return legislator.id.bioguide;
      }
    }
  }

  return null;
}

/**
 * Get committee details by ID
 */
export function getCommitteeById(
  committeeId: string,
  committees: Committee[]
): Committee | null {
  // Check main committees
  for (const committee of committees) {
    if (
      committee.thomas_id === committeeId ||
      committee.house_committee_id === committeeId ||
      committee.senate_committee_id === committeeId
    ) {
      return committee;
    }

    // Check subcommittees
    if (committee.subcommittees) {
      for (const sub of committee.subcommittees) {
        if (sub.thomas_id === committeeId) {
          return {
            ...committee,
            name: `${committee.name} - ${sub.name}`,
            thomas_id: sub.thomas_id,
          };
        }
      }
    }
  }

  return null;
}
