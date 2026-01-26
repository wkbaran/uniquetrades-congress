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
 * Fetch current legislators from congress-legislators
 */
export async function fetchLegislators(): Promise<Legislator[]> {
  const response = await fetch(LEGISLATORS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch legislators: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const legislators = LegislatorsResponseSchema.parse(data);

  await saveData(LEGISLATORS_FILE, legislators);
  console.log(`Fetched and saved ${legislators.length} legislators`);

  return legislators;
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
 * Find congress member by name in membership data
 * Returns bioguide ID if found
 */
export function findMemberByName(
  firstName: string,
  lastName: string,
  membership: CommitteeMembershipResponse
): string | null {
  const normalizedFirst = firstName.toLowerCase().trim();
  const normalizedLast = lastName.toLowerCase().trim();

  for (const members of Object.values(membership)) {
    for (const member of members) {
      const memberName = member.name.toLowerCase();
      // Name format is typically "LastName, FirstName" or "FirstName LastName"
      if (
        memberName.includes(normalizedFirst) &&
        memberName.includes(normalizedLast)
      ) {
        return member.bioguide || null;
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
