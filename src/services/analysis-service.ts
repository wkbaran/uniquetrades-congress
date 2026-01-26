import {
  DEFAULT_ANALYSIS_CONFIG,
  type FMPTrade,
  type EnrichedTrade,
  type CongressMemberProfile,
  type UniquenessScore,
  type UniquenessFactors,
  type UniqueTradeReport,
  type AnalysisReport,
  type CommitteeData,
  type AnalysisConfig,
  type MarketSector,
} from "../types/index.js";
import { FMPClient } from "./fmp-client.js";
import {
  inferStockSector,
  hasRelevantCommitteeExposure,
} from "../mappings/committee-sectors.js";
import {
  getMemberCommittees,
  findMemberByName,
} from "./committee-service.js";
import { saveReport } from "../utils/storage.js";

/**
 * Parse FMP amount string to numeric range
 * Amounts come as "$1,001 - $15,000" or similar
 */
function parseAmountRange(amount: string | undefined): {
  low: number;
  high: number;
} | null {
  if (!amount) return null;

  // Remove $ and commas, then extract numbers
  const cleaned = amount.replace(/[$,]/g, "");
  const numbers = cleaned.match(/(\d+)/g);

  if (!numbers || numbers.length === 0) return null;

  if (numbers.length === 1) {
    const value = parseInt(numbers[0], 10);
    return { low: value, high: value };
  }

  return {
    low: parseInt(numbers[0], 10),
    high: parseInt(numbers[1], 10),
  };
}

/**
 * Create a unique member ID from trade data
 */
function getMemberId(trade: FMPTrade, chamber: "senate" | "house"): string {
  const first = (trade.firstName || "").toLowerCase().trim();
  const last = (trade.lastName || "").toLowerCase().trim();
  return `${chamber}-${first}-${last}`;
}

/**
 * Enrich trades with additional data
 */
export async function enrichTrades(
  trades: FMPTrade[],
  chamber: "senate" | "house",
  fmpClient: FMPClient
): Promise<EnrichedTrade[]> {
  // Extract unique symbols
  const symbols = [
    ...new Set(
      trades
        .map((t) => t.symbol)
        .filter((s): s is string => !!s && s.length > 0)
    ),
  ];

  console.log(`Fetching quotes for ${symbols.length} unique symbols...`);
  const quotes = await fmpClient.getQuotes(symbols);

  return trades.map((trade) => {
    const quote = trade.symbol ? quotes.get(trade.symbol) : undefined;
    const amountRange = parseAmountRange(trade.amount);

    return {
      ...trade,
      congressMemberId: getMemberId(trade, chamber),
      chamber,
      marketCap: quote?.marketCap,
      avgVolume: quote?.avgVolume,
      currentPrice: quote?.price,
      amountLow: amountRange?.low,
      amountHigh: amountRange?.high,
    };
  });
}

/**
 * Build member profiles from trades
 */
export function buildMemberProfiles(
  trades: EnrichedTrade[],
  committeeData: CommitteeData | null
): Map<string, CongressMemberProfile> {
  const profiles = new Map<string, CongressMemberProfile>();

  for (const trade of trades) {
    let profile = profiles.get(trade.congressMemberId);

    if (!profile) {
      // Try to find bioguide ID for committee lookup
      let committees: string[] = [];
      if (committeeData && trade.firstName && trade.lastName) {
        const bioguideId = findMemberByName(
          trade.firstName,
          trade.lastName,
          committeeData.membership
        );
        if (bioguideId) {
          committees = getMemberCommittees(bioguideId, committeeData.membership);
        }
      }

      profile = {
        id: trade.congressMemberId,
        firstName: trade.firstName || "",
        lastName: trade.lastName || "",
        chamber: trade.chamber,
        committees,
        trades: [],
        totalTrades: 0,
      };
      profiles.set(trade.congressMemberId, profile);
    }

    profile.trades.push(trade);
    profile.totalTrades++;
  }

  // Calculate average trade sizes
  for (const profile of profiles.values()) {
    const tradeSizes = profile.trades
      .map((t) => (t.amountLow && t.amountHigh ? (t.amountLow + t.amountHigh) / 2 : null))
      .filter((s): s is number => s !== null);

    if (tradeSizes.length > 0) {
      profile.averageTradeSize =
        tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
    }
  }

  return profiles;
}

/**
 * Calculate uniqueness score for a trade
 */
export function calculateUniquenessScore(
  trade: EnrichedTrade,
  memberProfile: CongressMemberProfile,
  config: AnalysisConfig
): UniquenessScore {
  const factors: UniquenessFactors = {
    isSmallCap: false,
    isBelowAvgVolume: false,
    isHighConviction: false,
  };

  let marketCapScore = 0;
  let volumeScore = 0;
  let convictionScore = 0;
  let relativeVolumeScore = 0;

  // Market cap scoring (0-25 points)
  if (trade.marketCap !== undefined) {
    factors.marketCap = trade.marketCap;
    if (trade.marketCap < config.marketCapThreshold) {
      factors.isSmallCap = true;
      // Scale: smaller cap = higher score
      // < $500M = 25, < $1B = 20, < $2B = 15
      if (trade.marketCap < 500_000_000) {
        marketCapScore = 25;
      } else if (trade.marketCap < 1_000_000_000) {
        marketCapScore = 20;
      } else {
        marketCapScore = 15;
      }
    }
  }

  // Volume scoring (0-25 points)
  // Compare trade size to stock's average daily volume
  if (trade.avgVolume !== undefined && trade.amountHigh && trade.currentPrice) {
    factors.avgVolume = trade.avgVolume;
    // Estimate shares traded from dollar amount
    const estimatedShares = trade.amountHigh / trade.currentPrice;
    const volumeRatio = estimatedShares / trade.avgVolume;
    factors.relativeToAvgVolume = volumeRatio;

    if (volumeRatio > config.volumeThresholdMultiplier) {
      factors.isBelowAvgVolume = true; // Trade is significant vs avg volume
      // Scale based on how significant
      if (volumeRatio > 0.5) {
        relativeVolumeScore = 25;
      } else if (volumeRatio > 0.25) {
        relativeVolumeScore = 20;
      } else if (volumeRatio > 0.1) {
        relativeVolumeScore = 15;
      } else {
        relativeVolumeScore = 10;
      }
    }
  }

  // Conviction scoring (0-25 points)
  // Compare trade size to member's typical trade size
  if (
    trade.amountLow &&
    trade.amountHigh &&
    memberProfile.averageTradeSize
  ) {
    factors.tradeAmount = { low: trade.amountLow, high: trade.amountHigh };
    factors.memberAvgTradeSize = memberProfile.averageTradeSize;

    const tradeSize = (trade.amountLow + trade.amountHigh) / 2;
    const convictionRatio = tradeSize / memberProfile.averageTradeSize;

    if (convictionRatio >= config.convictionThresholdMultiplier) {
      factors.isHighConviction = true;
      // Scale based on conviction level
      if (convictionRatio >= 5) {
        convictionScore = 25;
      } else if (convictionRatio >= 3) {
        convictionScore = 20;
      } else if (convictionRatio >= 2) {
        convictionScore = 15;
      }
    }
  }

  // Stock volume below average (0-25 points)
  // This is different from relative volume - it's about the stock's volume being low
  // Making the trade harder to execute without impact
  if (trade.avgVolume !== undefined) {
    // Low volume stocks (< 500k daily avg) are harder to trade
    if (trade.avgVolume < 100_000) {
      volumeScore = 25;
    } else if (trade.avgVolume < 250_000) {
      volumeScore = 20;
    } else if (trade.avgVolume < 500_000) {
      volumeScore = 15;
    } else if (trade.avgVolume < 1_000_000) {
      volumeScore = 10;
    }
  }

  const overall =
    marketCapScore + volumeScore + convictionScore + relativeVolumeScore;

  return {
    overall,
    marketCapScore,
    volumeScore,
    convictionScore,
    relativeVolumeScore,
    factors,
  };
}

/**
 * Analyze trades and generate unique trade reports
 */
export async function analyzeTrades(
  senateTrades: FMPTrade[],
  houseTrades: FMPTrade[],
  committeeData: CommitteeData | null,
  fmpClient: FMPClient,
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): Promise<AnalysisReport> {
  console.log(
    `Analyzing ${senateTrades.length} Senate trades and ${houseTrades.length} House trades...`
  );

  // Enrich trades with market data - run sequentially to avoid rate limiting
  console.log("Enriching Senate trades...");
  const enrichedSenate = await enrichTrades(senateTrades, "senate", fmpClient);

  console.log("Enriching House trades...");
  const enrichedHouse = await enrichTrades(houseTrades, "house", fmpClient);

  const allTrades = [...enrichedSenate, ...enrichedHouse];

  // Build member profiles
  const memberProfiles = buildMemberProfiles(allTrades, committeeData);
  console.log(`Built profiles for ${memberProfiles.size} congress members`);

  // Calculate uniqueness scores
  const uniqueTradeReports: UniqueTradeReport[] = [];

  for (const trade of allTrades) {
    const profile = memberProfiles.get(trade.congressMemberId);
    if (!profile) continue;

    const score = calculateUniquenessScore(trade, profile, config);

    // Skip trades below minimum score
    if (score.overall < config.minUniquenessScore) continue;

    // Determine committee relevance
    let committeeRelevance: UniqueTradeReport["committeeRelevance"];
    if (committeeData && trade.assetDescription) {
      const stockSectors = inferStockSector(trade.assetDescription, trade.symbol);
      if (stockSectors.length > 0 && profile.committees.length > 0) {
        const relevance = hasRelevantCommitteeExposure(
          profile.committees,
          stockSectors,
          committeeData.sectorMappings
        );
        if (relevance.relevant) {
          committeeRelevance = {
            committees: relevance.committees,
            sectors: relevance.sectors,
            potentialInsight: true,
          };
        }
      }
    }

    uniqueTradeReports.push({
      trade,
      score,
      memberProfile: profile,
      committeeRelevance,
    });
  }

  // Sort by score descending
  uniqueTradeReports.sort((a, b) => b.score.overall - a.score.overall);

  console.log(
    `Found ${uniqueTradeReports.length} unique trades (score >= ${config.minUniquenessScore})`
  );

  // Build summary
  const byMember: Record<string, UniqueTradeReport[]> = {};
  const bySector: Record<string, UniqueTradeReport[]> = {};

  for (const report of uniqueTradeReports) {
    const memberName = `${report.trade.firstName} ${report.trade.lastName}`;
    if (!byMember[memberName]) {
      byMember[memberName] = [];
    }
    byMember[memberName].push(report);

    if (report.committeeRelevance) {
      for (const sector of report.committeeRelevance.sectors) {
        if (!bySector[sector]) {
          bySector[sector] = [];
        }
        bySector[sector].push(report);
      }
    }
  }

  const analysisReport: AnalysisReport = {
    generatedAt: new Date().toISOString(),
    totalTradesAnalyzed: allTrades.length,
    uniqueTrades: uniqueTradeReports,
    summary: {
      topByScore: uniqueTradeReports.slice(0, 20),
      byMember,
      bySector,
    },
  };

  // Save report
  const reportPath = await saveReport("unique-trades", analysisReport);
  console.log(`Report saved to ${reportPath}`);

  return analysisReport;
}

/**
 * Format a unique trade report for display
 */
export function formatTradeReport(report: UniqueTradeReport): string {
  const { trade, score, committeeRelevance } = report;

  const lines = [
    `📊 ${trade.symbol || "N/A"} - ${trade.assetDescription || "Unknown"}`,
    `   Trader: ${trade.firstName} ${trade.lastName} (${trade.chamber})`,
    `   Type: ${trade.type || "N/A"} | Amount: ${trade.amount || "N/A"}`,
    `   Date: ${trade.transactionDate || "N/A"}`,
    `   Score: ${score.overall}/100`,
    `   Factors:`,
  ];

  if (score.factors.isSmallCap) {
    lines.push(
      `     - Small Cap: $${((score.factors.marketCap || 0) / 1_000_000).toFixed(0)}M`
    );
  }
  if (score.factors.isBelowAvgVolume) {
    lines.push(
      `     - Low Volume Stock: ${(score.factors.avgVolume || 0).toLocaleString()} avg daily`
    );
  }
  if (score.factors.isHighConviction) {
    lines.push(
      `     - High Conviction: ${((score.factors.tradeAmount?.high || 0) / (score.factors.memberAvgTradeSize || 1)).toFixed(1)}x typical trade`
    );
  }
  if (score.factors.relativeToAvgVolume && score.factors.relativeToAvgVolume > 0.1) {
    lines.push(
      `     - Trade Size: ${(score.factors.relativeToAvgVolume * 100).toFixed(1)}% of avg volume`
    );
  }

  if (committeeRelevance?.potentialInsight) {
    lines.push(`   ⚠️  Committee Relevance: ${committeeRelevance.sectors.join(", ")}`);
  }

  return lines.join("\n");
}
