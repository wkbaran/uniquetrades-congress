/**
 * Committee Sector Map
 *
 * Implements the CommitteeSectorMap interface for the scoring module.
 * Wraps existing committee-sector mapping logic.
 */

import type { CommitteeSectorMap } from "../scoring/types.js";
import type { MarketSector, CommitteeSectorMapping } from "../types/index.js";
import { inferStockSector } from "../mappings/committee-sectors.js";

export class CommitteeSectorMapImpl implements CommitteeSectorMap {
  private committeeToSectors = new Map<string, MarketSector[]>();

  constructor(sectorMappings: CommitteeSectorMapping[]) {
    for (const mapping of sectorMappings) {
      this.committeeToSectors.set(mapping.committeeId, mapping.sectors);
    }
  }

  getCommitteeSectors(committeeId: string): MarketSector[] {
    return this.committeeToSectors.get(committeeId) || [];
  }

  getStockSectors(symbol: string, description: string): MarketSector[] {
    return inferStockSector(description, symbol);
  }
}
