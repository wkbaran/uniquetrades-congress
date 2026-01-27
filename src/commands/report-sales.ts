import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
import { loadTrades } from "../services/trade-service.js";
import {
  loadCommitteeData,
  findMemberByName,
} from "../services/committee-service.js";
import type { FMPTrade } from "../types/index.js";

export const reportSalesCommand = new Command("report:sales")
  .description("Generate a formatted report of all sales")
  .action(async () => {
    try {
      const [tradeData, committeeData] = await Promise.all([
        loadTrades(),
        loadCommitteeData(),
      ]);

      if (!tradeData) {
        console.error("❌ No trade data found. Run 'fetch:trades' first.");
        process.exit(1);
      }

      // Combine all trades
      const allTrades: { trade: FMPTrade; chamber: "Senate" | "House" }[] = [
        ...tradeData.senateTrades.map((t) => ({ trade: t, chamber: "Senate" as const })),
        ...tradeData.houseTrades.map((t) => ({ trade: t, chamber: "House" as const })),
      ];

      // Filter for sales only
      const sales = allTrades.filter(({ trade }) => {
        const type = (trade.type || "").toLowerCase();
        return type.includes("sale");
      });

      // Sort by date descending
      sales.sort((a, b) => {
        const dateA = a.trade.transactionDate || "";
        const dateB = b.trade.transactionDate || "";
        return dateB.localeCompare(dateA);
      });

      // Get party affiliation helper
      const getParty = (firstName: string, lastName: string): string => {
        if (!committeeData) return "";
        const bioguideId = findMemberByName(
          firstName,
          lastName,
          committeeData.membership,
          committeeData.legislators
        );
        if (!bioguideId) return "";
        const legislator = committeeData.legislators?.find(
          (l) => l.id.bioguide === bioguideId
        );
        if (!legislator) return "";
        const party = legislator.terms?.[legislator.terms.length - 1]?.party;
        if (party === "Republican") return "R";
        if (party === "Democrat") return "D";
        if (party) return party.charAt(0);
        return "";
      };

      // Build formatted output
      const lines: string[] = [];
      lines.push("");
      lines.push("═".repeat(90));
      lines.push("  CONGRESSIONAL SALES REPORT");
      lines.push("═".repeat(90));
      lines.push(`  Generated: ${new Date().toISOString().split("T")[0]}`);
      lines.push(`  Total Sales: ${sales.length}`);
      lines.push("═".repeat(90));
      lines.push("");

      // Group by date for readability
      let currentDate = "";

      for (const { trade, chamber } of sales) {
        const date = trade.transactionDate || "Unknown";

        // Print date header when date changes
        if (date !== currentDate) {
          if (currentDate !== "") lines.push("");
          lines.push(`── ${date} ${"─".repeat(75)}`);
          currentDate = date;
        }

        const name = `${trade.firstName || ""} ${trade.lastName || ""}`.trim();
        const party = getParty(trade.firstName || "", trade.lastName || "");
        const partyLabel = party ? ` (${party})` : "";
        const chamberLabel = chamber === "Senate" ? "Sen" : "Rep";

        const symbol = trade.symbol || "N/A";
        const amount = trade.amount || "N/A";
        const owner = trade.owner || "";
        const ownerLabel = owner && owner !== "Self" ? ` [${owner}]` : "";
        const assetType = trade.assetType || "";
        const typeLabel = assetType && assetType !== "Stock" ? ` (${assetType})` : "";

        // Main line: Symbol, Amount, Member
        lines.push(
          `  ${symbol.padEnd(6)} ${amount.padEnd(22)} ${chamberLabel}. ${name}${partyLabel}${ownerLabel}`
        );

        // Description line (indented)
        const description = trade.assetDescription || "";
        if (description && description !== symbol) {
          lines.push(`         ${description}${typeLabel}`);
        }
      }

      lines.push("");
      lines.push("═".repeat(90));
      lines.push("");

      // Output to console
      const output = lines.join("\n");
      console.log(output);

      // Save to formatted-reports directory
      const reportsDir = path.join(process.cwd(), "formatted-reports");
      await fs.mkdir(reportsDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `sales-${timestamp}.txt`;
      await fs.writeFile(path.join(reportsDir, filename), output);
      console.log(`📁 Saved to formatted-reports/${filename}`);
    } catch (error) {
      console.error("❌ Failed to generate sales report:", error);
      process.exit(1);
    }
  });
