/**
 * Committee-to-Sector Taxonomy
 *
 * Maps FMP sectors and industries to congressional committees.
 * This allows detecting when a congress member trades in sectors
 * their committees have oversight of.
 *
 * FMP Sectors (validated 2026-01-27):
 * - Basic Materials, Communication Services, Consumer Cyclical,
 * - Consumer Defensive, Energy, Financial Services, Healthcare,
 * - Industrials, Real Estate, Technology, Utilities
 *
 * Industry names updated to match FMP's exact naming convention.
 */

// ============================================
// Types
// ============================================

export interface CommitteeSectorTaxonomy {
  committeeId: string;
  committeeName: string;
  /** FMP sectors this committee has jurisdiction over */
  sectors: string[];
  /** FMP industries this committee has jurisdiction over */
  industries: string[];
}

// ============================================
// Senate Committees
// ============================================

export const SENATE_COMMITTEE_TAXONOMY: CommitteeSectorTaxonomy[] = [
  {
    committeeId: "SSAF",
    committeeName: "Agriculture, Nutrition, and Forestry",
    sectors: ["Consumer Defensive", "Basic Materials"],
    industries: [
      "Agricultural Farm Products",
      "Agricultural Inputs",
      "Packaged Foods",
      "Food Distribution",
      "Beverages - Non-Alcoholic",
      "Food Confectioners",
    ],
  },
  {
    committeeId: "SSAP",
    committeeName: "Appropriations",
    sectors: [], // Broad jurisdiction, hard to map
    industries: [],
  },
  {
    committeeId: "SSAS",
    committeeName: "Armed Services",
    sectors: ["Industrials"],
    industries: [
      "Aerospace & Defense",
      "Security & Protection Services",
    ],
  },
  {
    committeeId: "SSBK",
    committeeName: "Banking, Housing, and Urban Affairs",
    sectors: ["Financial Services", "Real Estate"],
    industries: [
      "Banks - Regional",
      "Banks - Diversified",
      "Banks",
      "Financial - Credit Services",
      "Asset Management",
      "Financial - Capital Markets",
      "Insurance - Diversified",
      "Insurance - Property & Casualty",
      "Insurance - Life",
      "Financial - Data & Stock Exchanges",
      "Financial - Mortgages",
      "Real Estate - Development",
      "Real Estate - Services",
      "REIT - Diversified",
      "REIT - Residential",
    ],
  },
  {
    committeeId: "SSBU",
    committeeName: "Budget",
    sectors: [], // Procedural, hard to map
    industries: [],
  },
  {
    committeeId: "SSCM",
    committeeName: "Commerce, Science, and Transportation",
    sectors: ["Technology", "Communication Services", "Industrials"],
    industries: [
      "Internet Content & Information",
      "Software - Infrastructure",
      "Software - Application",
      "Semiconductors",
      "Consumer Electronics",
      "Communication Equipment",
      "Telecommunications Services",
      "Broadcasting",
      "Entertainment",
      "Airlines, Airports & Air Services",
      "Railroads",
      "Trucking",
      "Marine Shipping",
    ],
  },
  {
    committeeId: "SSEG",
    committeeName: "Energy and Natural Resources",
    sectors: ["Energy", "Utilities", "Basic Materials"],
    industries: [
      "Oil & Gas Exploration & Production",
      "Oil & Gas Integrated",
      "Oil & Gas Midstream",
      "Oil & Gas Refining & Marketing",
      "Oil & Gas Equipment & Services",
      "Uranium",
      "Regulated Electric",
      "Renewable Utilities",
      "Independent Power Producers",
      "Solar",
      "Coal",
    ],
  },
  {
    committeeId: "SSEV",
    committeeName: "Environment and Public Works",
    sectors: ["Utilities", "Industrials", "Basic Materials"],
    industries: [
      "Waste Management",
      "Engineering & Construction",
      "Construction Materials",
      "Chemicals - Specialty",
      "Environmental Services",
    ],
  },
  {
    committeeId: "SSFI",
    committeeName: "Finance",
    sectors: ["Healthcare", "Financial Services"],
    industries: [
      "Medical - Healthcare Plans",
      "Medical - Pharmaceuticals",
      "Medical - Care Facilities",
      "Insurance - Diversified",
    ],
  },
  {
    committeeId: "SSFR",
    committeeName: "Foreign Relations",
    sectors: [], // Diplomatic, hard to map
    industries: [
      "Aerospace & Defense",
    ],
  },
  {
    committeeId: "SSHR",
    committeeName: "Health, Education, Labor, and Pensions",
    sectors: ["Healthcare"],
    industries: [
      "Drug Manufacturers - General",
      "Drug Manufacturers - Specialty & Generic",
      "Biotechnology",
      "Medical - Devices",
      "Medical - Instruments & Supplies",
      "Medical - Diagnostics & Research",
      "Medical - Healthcare Plans",
      "Medical - Care Facilities",
      "Education & Training Services",
    ],
  },
  {
    committeeId: "SSHM",
    committeeName: "Homeland Security and Governmental Affairs",
    sectors: ["Technology", "Industrials"],
    industries: [
      "Information Technology Services",
      "Software - Infrastructure",
      "Security & Protection Services",
      "Aerospace & Defense",
    ],
  },
  {
    committeeId: "SSJU",
    committeeName: "Judiciary",
    sectors: ["Technology", "Communication Services"],
    industries: [
      "Internet Content & Information",
      "Software - Application",
    ],
  },
  {
    committeeId: "SSRA",
    committeeName: "Rules and Administration",
    sectors: [],
    industries: [],
  },
  {
    committeeId: "SSSB",
    committeeName: "Small Business and Entrepreneurship",
    sectors: [], // Broad, hard to map
    industries: [],
  },
  {
    committeeId: "SSVA",
    committeeName: "Veterans' Affairs",
    sectors: ["Healthcare"],
    industries: [
      "Medical - Healthcare Plans",
      "Medical - Care Facilities",
      "Drug Manufacturers - Specialty & Generic",
    ],
  },
];

// ============================================
// House Committees
// ============================================

export const HOUSE_COMMITTEE_TAXONOMY: CommitteeSectorTaxonomy[] = [
  {
    committeeId: "HSAG",
    committeeName: "Agriculture",
    sectors: ["Consumer Defensive", "Basic Materials"],
    industries: [
      "Agricultural Farm Products",
      "Agricultural Inputs",
      "Packaged Foods",
      "Food Distribution",
    ],
  },
  {
    committeeId: "HSAP",
    committeeName: "Appropriations",
    sectors: [],
    industries: [],
  },
  {
    committeeId: "HSAS",
    committeeName: "Armed Services",
    sectors: ["Industrials"],
    industries: [
      "Aerospace & Defense",
      "Security & Protection Services",
    ],
  },
  {
    committeeId: "HSBA",
    committeeName: "Financial Services",
    sectors: ["Financial Services", "Real Estate"],
    industries: [
      "Banks - Regional",
      "Banks - Diversified",
      "Banks",
      "Financial - Credit Services",
      "Asset Management",
      "Financial - Capital Markets",
      "Insurance - Diversified",
      "Insurance - Property & Casualty",
      "Insurance - Life",
      "Financial - Data & Stock Exchanges",
      "Financial - Mortgages",
      "REIT - Diversified",
    ],
  },
  {
    committeeId: "HSBU",
    committeeName: "Budget",
    sectors: [],
    industries: [],
  },
  {
    committeeId: "HSED",
    committeeName: "Education and the Workforce",
    sectors: ["Healthcare"],
    industries: [
      "Education & Training Services",
      "Staffing & Employment Services",
      "Medical - Healthcare Plans",
    ],
  },
  {
    committeeId: "HSIF",
    committeeName: "Energy and Commerce",
    sectors: ["Energy", "Healthcare", "Technology", "Communication Services"],
    industries: [
      "Oil & Gas Exploration & Production",
      "Oil & Gas Integrated",
      "Regulated Electric",
      "Drug Manufacturers - General",
      "Biotechnology",
      "Medical - Devices",
      "Telecommunications Services",
      "Internet Content & Information",
      "Broadcasting",
    ],
  },
  {
    committeeId: "HSFA",
    committeeName: "Foreign Affairs",
    sectors: [],
    industries: [
      "Aerospace & Defense",
    ],
  },
  {
    committeeId: "HSHA",
    committeeName: "House Administration",
    sectors: [],
    industries: [],
  },
  {
    committeeId: "HSHM",
    committeeName: "Homeland Security",
    sectors: ["Technology", "Industrials"],
    industries: [
      "Information Technology Services",
      "Security & Protection Services",
      "Aerospace & Defense",
    ],
  },
  {
    committeeId: "HSII",
    committeeName: "Natural Resources",
    sectors: ["Energy", "Basic Materials"],
    industries: [
      "Oil & Gas Exploration & Production",
      "Other Precious Metals",
      "Gold",
      "Silver",
      "Copper",
      "Coal",
    ],
  },
  {
    committeeId: "HSJU",
    committeeName: "Judiciary",
    sectors: ["Technology", "Communication Services"],
    industries: [
      "Internet Content & Information",
      "Software - Application",
    ],
  },
  {
    committeeId: "HSGO",
    committeeName: "Oversight and Accountability",
    sectors: [], // Investigative, broad
    industries: [],
  },
  {
    committeeId: "HSPW",
    committeeName: "Transportation and Infrastructure",
    sectors: ["Industrials"],
    industries: [
      "Airlines, Airports & Air Services",
      "Railroads",
      "Trucking",
      "Marine Shipping",
      "Engineering & Construction",
      "Construction Materials",
    ],
  },
  {
    committeeId: "HSRU",
    committeeName: "Rules",
    sectors: [],
    industries: [],
  },
  {
    committeeId: "HSSM",
    committeeName: "Small Business",
    sectors: [],
    industries: [],
  },
  {
    committeeId: "HSSY",
    committeeName: "Science, Space, and Technology",
    sectors: ["Technology", "Industrials"],
    industries: [
      "Aerospace & Defense",
      "Semiconductors",
      "Software - Infrastructure",
    ],
  },
  {
    committeeId: "HSVR",
    committeeName: "Veterans' Affairs",
    sectors: ["Healthcare"],
    industries: [
      "Medical - Healthcare Plans",
      "Medical - Care Facilities",
    ],
  },
  {
    committeeId: "HSWM",
    committeeName: "Ways and Means",
    sectors: ["Healthcare", "Financial Services"],
    industries: [
      "Medical - Healthcare Plans",
      "Insurance - Diversified",
    ],
  },
];

// ============================================
// Lookup Functions
// ============================================

const ALL_COMMITTEES = [...SENATE_COMMITTEE_TAXONOMY, ...HOUSE_COMMITTEE_TAXONOMY];

// Build lookup maps
const committeeMap = new Map<string, CommitteeSectorTaxonomy>();
for (const c of ALL_COMMITTEES) {
  committeeMap.set(c.committeeId, c);
}

/**
 * Get the sectors a committee has jurisdiction over
 */
export function getCommitteeSectors(committeeId: string): string[] {
  return committeeMap.get(committeeId)?.sectors ?? [];
}

/**
 * Get the industries a committee has jurisdiction over
 */
export function getCommitteeIndustries(committeeId: string): string[] {
  return committeeMap.get(committeeId)?.industries ?? [];
}

/**
 * Check if a committee has jurisdiction over a stock's sector/industry
 */
export function hasCommitteeOverlap(
  committeeId: string,
  stockSector: string | null,
  stockIndustry: string | null
): boolean {
  const taxonomy = committeeMap.get(committeeId);
  if (!taxonomy) return false;

  // Check sector match
  if (stockSector && taxonomy.sectors.includes(stockSector)) {
    return true;
  }

  // Check industry match
  if (stockIndustry && taxonomy.industries.includes(stockIndustry)) {
    return true;
  }

  return false;
}

/**
 * Get all committees that have jurisdiction over a sector/industry
 */
export function getCommitteesWithJurisdiction(
  sector: string | null,
  industry: string | null
): CommitteeSectorTaxonomy[] {
  return ALL_COMMITTEES.filter((c) => {
    if (sector && c.sectors.includes(sector)) return true;
    if (industry && c.industries.includes(industry)) return true;
    return false;
  });
}

/**
 * Check if any of the trader's committees have jurisdiction
 */
export function checkCommitteeRelevance(
  traderCommitteeIds: string[],
  stockSector: string | null,
  stockIndustry: string | null
): { hasRelevance: boolean; overlappingCommittees: string[] } {
  const overlapping: string[] = [];

  for (const committeeId of traderCommitteeIds) {
    if (hasCommitteeOverlap(committeeId, stockSector, stockIndustry)) {
      overlapping.push(committeeId);
    }
  }

  return {
    hasRelevance: overlapping.length > 0,
    overlappingCommittees: overlapping,
  };
}
