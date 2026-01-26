/**
 * Committee Sector Map
 *
 * Implements the CommitteeSectorMap interface for the scoring module.
 * Uses FMP sector/industry taxonomy for committee relevance detection.
 */

import type { CommitteeSectorMap } from "../scoring/types.js";
import {
  getCommitteeSectors,
  getCommitteeIndustries,
  hasCommitteeOverlap,
} from "./committee-sector-taxonomy.js";

export class CommitteeSectorMapImpl implements CommitteeSectorMap {
  getCommitteeSectors(committeeId: string): string[] {
    return getCommitteeSectors(committeeId);
  }

  getCommitteeIndustries(committeeId: string): string[] {
    return getCommitteeIndustries(committeeId);
  }

  hasOverlap(
    committeeId: string,
    sector: string | null,
    industry: string | null
  ): boolean {
    return hasCommitteeOverlap(committeeId, sector, industry);
  }
}

/**
 * Create a sector map instance
 */
export function createSectorMap(): CommitteeSectorMap {
  return new CommitteeSectorMapImpl();
}
