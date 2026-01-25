import type { CommitteeSectorMapping, MarketSector, Committee } from "../types/index.js";

// Predefined mappings for known committees
// These are based on committee jurisdictions and their regulatory scope
const KNOWN_COMMITTEE_MAPPINGS: Record<string, MarketSector[]> = {
  // Senate Committees
  SSAF: ["Agriculture", "Consumer Staples"], // Agriculture, Nutrition, and Forestry
  SSAP: ["Defense", "Energy", "Healthcare", "Transportation"], // Appropriations
  SSAS: ["Defense", "Aerospace", "Cybersecurity"], // Armed Services
  SSBK: ["Financials", "Real Estate", "Cryptocurrency"], // Banking, Housing, and Urban Affairs
  SSBU: ["Financials"], // Budget
  SSCM: ["Telecommunications", "Media", "Technology", "Consumer Discretionary"], // Commerce, Science, and Transportation
  SSEG: ["Energy", "Utilities", "Materials"], // Energy and Natural Resources
  SSEV: ["Utilities", "Materials", "Energy"], // Environment and Public Works
  SSFI: ["Financials", "Healthcare"], // Finance
  SSFR: ["Defense", "Aerospace"], // Foreign Relations
  SSGA: ["Technology", "Cybersecurity"], // Homeland Security and Governmental Affairs
  SSHR: ["Healthcare", "Pharmaceuticals", "Biotechnology"], // Health, Education, Labor, and Pensions
  SSIA: ["Technology", "Cybersecurity", "Defense"], // Intelligence
  SSJU: ["Technology", "Telecommunications"], // Judiciary
  SSRA: ["Financials"], // Rules and Administration
  SSSB: ["Financials", "Consumer Discretionary"], // Small Business and Entrepreneurship
  SSVA: ["Healthcare", "Pharmaceuticals"], // Veterans' Affairs

  // House Committees
  HSAG: ["Agriculture", "Consumer Staples"], // Agriculture
  HSAP: ["Defense", "Energy", "Healthcare", "Transportation"], // Appropriations
  HSAS: ["Defense", "Aerospace", "Cybersecurity"], // Armed Services
  HSBU: ["Financials"], // Budget
  HSED: ["Healthcare", "Consumer Discretionary"], // Education and the Workforce
  HSIF: ["Energy", "Healthcare", "Telecommunications", "Technology"], // Energy and Commerce
  HSHA: ["Financials"], // House Administration
  HSFA: ["Defense", "Aerospace"], // Foreign Affairs
  HSGO: ["Technology", "Cybersecurity"], // Oversight and Accountability
  HSHM: ["Cybersecurity", "Defense", "Transportation"], // Homeland Security
  HSJU: ["Technology", "Telecommunications"], // Judiciary
  HSPW: ["Transportation", "Industrials", "Real Estate"], // Transportation and Infrastructure
  HSBA: ["Financials", "Real Estate", "Cryptocurrency"], // Financial Services
  HLIG: ["Technology", "Cybersecurity", "Defense"], // Intelligence
  HSII: ["Energy", "Materials", "Agriculture"], // Natural Resources
  HSRU: ["Financials"], // Rules
  HSSM: ["Financials", "Consumer Discretionary"], // Small Business
  HSSY: ["Technology", "Aerospace", "Cybersecurity"], // Science, Space, and Technology
  HSVR: ["Healthcare", "Pharmaceuticals"], // Veterans' Affairs
  HSWM: ["Financials", "Healthcare"], // Ways and Means
};

// Keywords to help match committees dynamically
const SECTOR_KEYWORDS: Record<MarketSector, string[]> = {
  Technology: [
    "technology",
    "science",
    "cyber",
    "digital",
    "internet",
    "computer",
    "innovation",
    "telecommunications",
  ],
  Healthcare: [
    "health",
    "medical",
    "medicare",
    "medicaid",
    "hospital",
    "drug",
    "pharmaceutical",
  ],
  Financials: [
    "banking",
    "finance",
    "financial",
    "budget",
    "tax",
    "treasury",
    "monetary",
    "insurance",
    "securities",
  ],
  Energy: [
    "energy",
    "oil",
    "gas",
    "nuclear",
    "renewable",
    "power",
    "electric",
    "petroleum",
  ],
  Defense: [
    "armed",
    "military",
    "defense",
    "veteran",
    "national security",
    "intelligence",
  ],
  Industrials: ["manufacturing", "industry", "industrial", "infrastructure"],
  "Consumer Discretionary": [
    "consumer",
    "retail",
    "commerce",
    "trade",
    "small business",
  ],
  "Consumer Staples": ["agriculture", "food", "nutrition", "farming"],
  Materials: ["materials", "mining", "natural resources", "environment"],
  "Real Estate": ["housing", "real estate", "urban", "property"],
  Utilities: ["utilities", "water", "public works", "sanitation"],
  Telecommunications: [
    "telecommunications",
    "communications",
    "broadcast",
    "spectrum",
    "fcc",
  ],
  Transportation: [
    "transportation",
    "aviation",
    "railroad",
    "highway",
    "transit",
    "shipping",
    "maritime",
  ],
  Agriculture: ["agriculture", "farm", "rural", "livestock", "crop"],
  Cybersecurity: [
    "cybersecurity",
    "cyber",
    "homeland",
    "digital security",
    "hacking",
  ],
  Cryptocurrency: ["cryptocurrency", "crypto", "digital asset", "blockchain"],
  Pharmaceuticals: ["pharmaceutical", "drug", "fda", "prescription"],
  Biotechnology: ["biotech", "biotechnology", "genetic", "biologic"],
  Media: ["media", "broadcast", "entertainment", "journalism"],
  Aerospace: ["aerospace", "space", "aviation", "nasa", "satellite"],
};

/**
 * Maps a committee to market sectors based on its name and jurisdiction
 */
export function mapCommitteeToSectors(committee: Committee): CommitteeSectorMapping {
  const committeeId =
    committee.thomas_id ||
    committee.house_committee_id ||
    committee.senate_committee_id ||
    committee.name;

  // Check for known mapping first
  if (committeeId && KNOWN_COMMITTEE_MAPPINGS[committeeId]) {
    return {
      committeeId,
      committeeName: committee.name,
      sectors: KNOWN_COMMITTEE_MAPPINGS[committeeId],
      keywords: extractKeywords(committee),
    };
  }

  // Fall back to keyword-based mapping
  const sectors = inferSectorsFromKeywords(committee);

  return {
    committeeId: committeeId || committee.name,
    committeeName: committee.name,
    sectors,
    keywords: extractKeywords(committee),
  };
}

/**
 * Extract relevant keywords from committee data
 */
function extractKeywords(committee: Committee): string[] {
  const keywords: string[] = [];
  const text = [
    committee.name,
    committee.jurisdiction || "",
  ]
    .join(" ")
    .toLowerCase();

  // Extract words that might be relevant
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length > 3 && !STOP_WORDS.has(word)) {
      keywords.push(word);
    }
  }

  return [...new Set(keywords)];
}

const STOP_WORDS = new Set([
  "committee",
  "subcommittee",
  "select",
  "special",
  "joint",
  "house",
  "senate",
  "the",
  "and",
  "for",
  "on",
  "of",
  "to",
  "in",
  "with",
]);

/**
 * Infer sectors from committee name and jurisdiction using keywords
 */
function inferSectorsFromKeywords(committee: Committee): MarketSector[] {
  const text = [
    committee.name,
    committee.jurisdiction || "",
  ]
    .join(" ")
    .toLowerCase();

  const matchedSectors: Set<MarketSector> = new Set();

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedSectors.add(sector as MarketSector);
        break;
      }
    }
  }

  // Default to empty array if no matches (rather than a generic sector)
  return [...matchedSectors];
}

/**
 * Maps a stock symbol/company to potential market sectors
 * This is a simplified mapping - in production you'd use a more robust system
 */
export function inferStockSector(
  assetDescription: string,
  _symbol?: string
): MarketSector[] {
  const desc = assetDescription.toLowerCase();
  const sectors: MarketSector[] = [];

  // Check each sector's keywords against the description
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword.toLowerCase())) {
        sectors.push(sector as MarketSector);
        break;
      }
    }
  }

  return sectors;
}

/**
 * Find committees whose sectors overlap with a stock's sectors
 */
export function findRelevantCommittees(
  stockSectors: MarketSector[],
  committeeMappings: CommitteeSectorMapping[]
): CommitteeSectorMapping[] {
  if (stockSectors.length === 0) return [];

  return committeeMappings.filter((mapping) =>
    mapping.sectors.some((sector) => stockSectors.includes(sector))
  );
}

/**
 * Check if a congress member has committee assignments relevant to a stock
 */
export function hasRelevantCommitteeExposure(
  memberCommittees: string[],
  stockSectors: MarketSector[],
  committeeMappings: CommitteeSectorMapping[]
): { relevant: boolean; committees: string[]; sectors: MarketSector[] } {
  const relevantCommittees: string[] = [];
  const relevantSectors: Set<MarketSector> = new Set();

  for (const committeeId of memberCommittees) {
    const mapping = committeeMappings.find((m) => m.committeeId === committeeId);
    if (mapping) {
      const overlappingSectors = mapping.sectors.filter((s) =>
        stockSectors.includes(s)
      );
      if (overlappingSectors.length > 0) {
        relevantCommittees.push(committeeId);
        overlappingSectors.forEach((s) => relevantSectors.add(s));
      }
    }
  }

  return {
    relevant: relevantCommittees.length > 0,
    committees: relevantCommittees,
    sectors: [...relevantSectors],
  };
}
