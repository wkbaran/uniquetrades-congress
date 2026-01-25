import { Command } from "commander";
import { loadTrades } from "../services/trade-service.js";
import {
  loadCommitteeData,
  findMemberByName,
  getMemberCommittees,
  getCommitteeById,
} from "../services/committee-service.js";
import {
  inferStockSector,
  hasRelevantCommitteeExposure,
} from "../mappings/committee-sectors.js";
import type { FMPTrade, CommitteeData, MarketSector } from "../types/index.js";

interface TradeSummary {
  trader: string;
  chamber: "Senate" | "House";
  symbol: string;
  description: string;
  type: string;
  amount: string;
  date: string;
  inferredSectors: MarketSector[];
  traderCommittees: string[];
  relevantCommittees: string[];
  hasCommitteeOverlap: boolean;
}

export const listTradesCommand = new Command("list:trades")
  .description("Display recent trades with committee relevance analysis")
  .option("--chamber <chamber>", "Filter by chamber (senate, house)")
  .option("--trader <name>", "Filter by trader name")
  .option("--symbol <symbol>", "Filter by stock symbol")
  .option("--relevant-only", "Show only trades with committee relevance")
  .option("--limit <n>", "Limit number of trades shown", "50")
  .option("--json", "Output raw JSON")
  .action(async (options) => {
    try {
      const [tradeData, committeeData] = await Promise.all([
        loadTrades(),
        loadCommitteeData(),
      ]);

      if (!tradeData) {
        console.error("❌ No trade data found. Run 'fetch:trades' first.");
        process.exit(1);
      }

      if (!committeeData) {
        console.warn("⚠️  No committee data found. Committee analysis will be limited.");
        console.warn("   Run 'fetch:committees' for full analysis.\n");
      }

      // Combine trades with chamber info
      const allTrades: { trade: FMPTrade; chamber: "Senate" | "House" }[] = [
        ...tradeData.senateTrades.map((t) => ({ trade: t, chamber: "Senate" as const })),
        ...tradeData.houseTrades.map((t) => ({ trade: t, chamber: "House" as const })),
      ];

      // Sort by date descending
      allTrades.sort((a, b) => {
        const dateA = a.trade.transactionDate || "";
        const dateB = b.trade.transactionDate || "";
        return dateB.localeCompare(dateA);
      });

      // Build trade summaries
      const summaries: TradeSummary[] = [];

      for (const { trade, chamber } of allTrades) {
        // Filter by chamber
        if (options.chamber) {
          if (options.chamber.toLowerCase() !== chamber.toLowerCase()) continue;
        }

        // Filter by trader name
        if (options.trader) {
          const traderLower = options.trader.toLowerCase();
          const fullName = `${trade.firstName || ""} ${trade.lastName || ""}`.toLowerCase();
          if (!fullName.includes(traderLower)) continue;
        }

        // Filter by symbol
        if (options.symbol) {
          if (trade.symbol?.toUpperCase() !== options.symbol.toUpperCase()) continue;
        }

        // Infer stock sectors from description
        const inferredSectors = inferStockSector(
          trade.assetDescription || "",
          trade.symbol
        );

        // Find trader's committees
        let traderCommittees: string[] = [];
        let relevantCommittees: string[] = [];
        let hasCommitteeOverlap = false;

        if (committeeData && trade.firstName && trade.lastName) {
          const bioguideId = findMemberByName(
            trade.firstName,
            trade.lastName,
            committeeData.membership
          );

          if (bioguideId) {
            traderCommittees = getMemberCommittees(bioguideId, committeeData.membership);

            if (inferredSectors.length > 0 && traderCommittees.length > 0) {
              const relevance = hasRelevantCommitteeExposure(
                traderCommittees,
                inferredSectors,
                committeeData.sectorMappings
              );
              hasCommitteeOverlap = relevance.relevant;
              relevantCommittees = relevance.committees;
            }
          }
        }

        // Filter relevant-only
        if (options.relevantOnly && !hasCommitteeOverlap) continue;

        summaries.push({
          trader: `${trade.firstName || ""} ${trade.lastName || ""}`.trim(),
          chamber,
          symbol: trade.symbol || "N/A",
          description: trade.assetDescription || "Unknown",
          type: trade.type || "Unknown",
          amount: trade.amount || "N/A",
          date: trade.transactionDate || "N/A",
          inferredSectors,
          traderCommittees,
          relevantCommittees,
          hasCommitteeOverlap,
        });

        // Apply limit
        if (summaries.length >= parseInt(options.limit, 10)) break;
      }

      if (options.json) {
        console.log(JSON.stringify(summaries, null, 2));
        return;
      }

      // Display in aesthetic format
      console.log("\n" + "═".repeat(100));
      console.log("  RECENT CONGRESSIONAL TRADES");
      console.log("═".repeat(100));

      if (summaries.length === 0) {
        console.log("\n  No trades found matching the criteria.\n");
        return;
      }

      for (const summary of summaries) {
        const overlapIcon = summary.hasCommitteeOverlap ? "⚠️ " : "  ";
        const chamberIcon = summary.chamber === "Senate" ? "🏛️" : "🏠";

        console.log("");
        console.log(`  ${overlapIcon}┌${"─".repeat(94)}┐`);

        // Header line: Symbol, Type, Amount
        const headerLine = `${summary.symbol} │ ${summary.type.toUpperCase()} │ ${summary.amount}`;
        console.log(`  ${overlapIcon}│ ${formatCell(headerLine, 92)} │`);

        // Description
        console.log(`  ${overlapIcon}│ ${formatCell(summary.description, 92)} │`);

        console.log(`  ${overlapIcon}├${"─".repeat(94)}┤`);

        // Trader info
        const traderLine = `${chamberIcon} ${summary.trader} (${summary.chamber}) │ 📅 ${summary.date}`;
        console.log(`  ${overlapIcon}│ ${formatCell(traderLine, 92)} │`);

        // Inferred sectors
        if (summary.inferredSectors.length > 0) {
          const sectorLine = `📊 Sectors: ${summary.inferredSectors.join(", ")}`;
          console.log(`  ${overlapIcon}│ ${formatCell(sectorLine, 92)} │`);
        }

        // Trader's committees (abbreviated)
        if (summary.traderCommittees.length > 0 && committeeData) {
          const committeeNames = summary.traderCommittees
            .slice(0, 3)
            .map((id) => {
              const comm = getCommitteeById(id, committeeData.committees);
              return comm ? abbreviateCommittee(comm.name) : id;
            });

          const remaining =
            summary.traderCommittees.length > 3
              ? ` +${summary.traderCommittees.length - 3} more`
              : "";

          const committeeLine = `👤 Committees: ${committeeNames.join(", ")}${remaining}`;
          console.log(`  ${overlapIcon}│ ${formatCell(committeeLine, 92)} │`);
        }

        // Committee overlap warning
        if (summary.hasCommitteeOverlap && committeeData) {
          console.log(`  ${overlapIcon}├${"─".repeat(94)}┤`);
          const relevantNames = summary.relevantCommittees
            .map((id) => {
              const comm = getCommitteeById(id, committeeData.committees);
              return comm ? abbreviateCommittee(comm.name) : id;
            })
            .join(", ");

          console.log(
            `  ${overlapIcon}│ ${formatCell("⚠️  POTENTIAL COMMITTEE RELEVANCE", 92)} │`
          );
          console.log(
            `  ${overlapIcon}│ ${formatCell(`   Trader sits on: ${relevantNames}`, 92)} │`
          );
          console.log(
            `  ${overlapIcon}│ ${formatCell(`   Which covers: ${summary.inferredSectors.join(", ")}`, 92)} │`
          );
        }

        console.log(`  ${overlapIcon}└${"─".repeat(94)}┘`);
      }

      // Summary stats
      const relevantCount = summaries.filter((s) => s.hasCommitteeOverlap).length;

      console.log("\n" + "═".repeat(100));
      console.log(`  Showing ${summaries.length} trades`);
      if (relevantCount > 0) {
        console.log(`  ⚠️  ${relevantCount} trades have potential committee relevance`);
      }
      console.log("═".repeat(100) + "\n");
    } catch (error) {
      console.error("❌ Failed to list trades:", error);
      process.exit(1);
    }
  });

function formatCell(text: string, width: number): string {
  if (text.length > width) {
    return text.substring(0, width - 3) + "...";
  }
  return text.padEnd(width);
}

function abbreviateCommittee(name: string): string {
  // Shorten common committee name patterns
  return name
    .replace("Committee on ", "")
    .replace("Subcommittee on ", "Sub: ")
    .replace(" and ", " & ")
    .replace("United States ", "")
    .replace("Administration", "Admin")
    .replace("Appropriations", "Approps")
    .replace("Transportation", "Transport")
    .replace("Infrastructure", "Infra")
    .replace("Environment", "Environ")
    .replace("Government", "Gov't")
    .replace("Intelligence", "Intel")
    .replace("Agriculture", "Ag")
    .replace("Financial", "Fin")
    .replace("Services", "Svcs");
}
