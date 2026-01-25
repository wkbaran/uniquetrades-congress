import { Command } from "commander";
import { loadCommitteeData } from "../services/committee-service.js";

export const listCommitteesCommand = new Command("list:committees")
  .description("Display committees with sectors and members")
  .option("--chamber <chamber>", "Filter by chamber (senate, house)")
  .option("--sector <sector>", "Filter by market sector")
  .option("--json", "Output raw JSON")
  .action(async (options) => {
    try {
      const committeeData = await loadCommitteeData();

      if (!committeeData) {
        console.error("❌ No committee data found. Run 'fetch:committees' first.");
        process.exit(1);
      }

      const { committees, membership, sectorMappings } = committeeData;

      // Build committee display data
      interface CommitteeDisplay {
        code: string;
        name: string;
        type: string;
        sectors: string[];
        members: { name: string; party?: string; title?: string }[];
      }

      const committeeDisplays: CommitteeDisplay[] = [];

      for (const committee of committees) {
        const code =
          committee.thomas_id ||
          committee.house_committee_id ||
          committee.senate_committee_id ||
          "N/A";

        // Filter by chamber if specified
        if (options.chamber) {
          const isMatch =
            (options.chamber === "senate" && committee.type === "senate") ||
            (options.chamber === "house" && committee.type === "house");
          if (!isMatch) continue;
        }

        // Find sector mapping
        const mapping = sectorMappings.find(
          (m) =>
            m.committeeId === code ||
            m.committeeId === committee.thomas_id ||
            m.committeeName === committee.name
        );
        const sectors = mapping?.sectors || [];

        // Filter by sector if specified
        if (options.sector) {
          const sectorLower = options.sector.toLowerCase();
          const hasMatch = sectors.some((s) =>
            s.toLowerCase().includes(sectorLower)
          );
          if (!hasMatch) continue;
        }

        // Get members
        const memberList = membership[code] || [];
        const members = memberList.map((m) => ({
          name: m.name,
          party: m.party,
          title: m.title,
        }));

        committeeDisplays.push({
          code,
          name: committee.name,
          type: committee.type,
          sectors,
          members,
        });
      }

      // Sort by type then name
      committeeDisplays.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      });

      if (options.json) {
        console.log(JSON.stringify(committeeDisplays, null, 2));
        return;
      }

      // Display in aesthetic format
      console.log("\n" + "═".repeat(80));
      console.log("  CONGRESSIONAL COMMITTEES");
      console.log("═".repeat(80));

      let currentType = "";

      for (const comm of committeeDisplays) {
        // Section header for chamber
        if (comm.type !== currentType) {
          currentType = comm.type;
          const chamberName = currentType === "senate" ? "SENATE" : "HOUSE";
          console.log("\n" + "─".repeat(80));
          console.log(`  📜 ${chamberName} COMMITTEES`);
          console.log("─".repeat(80));
        }

        console.log("");
        console.log(`  ┌${"─".repeat(76)}┐`);
        console.log(`  │ ${formatCell(comm.code, 8)} │ ${formatCell(comm.name, 63)} │`);
        console.log(`  ├${"─".repeat(76)}┤`);

        // Sectors
        if (comm.sectors.length > 0) {
          const sectorLine = `  📊 Sectors: ${comm.sectors.join(", ")}`;
          wrapText(sectorLine, 74).forEach((line) => {
            console.log(`  │ ${formatCell(line, 74)} │`);
          });
        } else {
          console.log(`  │ ${formatCell("  📊 Sectors: (none mapped)", 74)} │`);
        }

        console.log(`  ├${"─".repeat(76)}┤`);

        // Members
        if (comm.members.length > 0) {
          console.log(`  │ ${formatCell(`  👥 Members (${comm.members.length}):`, 74)} │`);

          // Group by role
          const chair = comm.members.find((m) =>
            m.title?.toLowerCase().includes("chair")
          );
          const rankingMember = comm.members.find(
            (m) =>
              m.title?.toLowerCase().includes("ranking") ||
              m.title?.toLowerCase().includes("vice")
          );
          const others = comm.members.filter(
            (m) => m !== chair && m !== rankingMember
          );

          if (chair) {
            const partyTag = chair.party ? ` (${chair.party})` : "";
            console.log(
              `  │ ${formatCell(`     ⭐ ${chair.name}${partyTag} - ${chair.title || "Chair"}`, 74)} │`
            );
          }

          if (rankingMember) {
            const partyTag = rankingMember.party ? ` (${rankingMember.party})` : "";
            console.log(
              `  │ ${formatCell(`     🔹 ${rankingMember.name}${partyTag} - ${rankingMember.title || "Ranking Member"}`, 74)} │`
            );
          }

          // Show first 8 other members
          const displayMembers = others.slice(0, 8);
          for (const member of displayMembers) {
            const partyTag = member.party ? ` (${member.party})` : "";
            console.log(
              `  │ ${formatCell(`        ${member.name}${partyTag}`, 74)} │`
            );
          }

          if (others.length > 8) {
            console.log(
              `  │ ${formatCell(`        ... and ${others.length - 8} more members`, 74)} │`
            );
          }
        } else {
          console.log(`  │ ${formatCell("  👥 Members: (data not available)", 74)} │`);
        }

        console.log(`  └${"─".repeat(76)}┘`);
      }

      console.log("\n" + "═".repeat(80));
      console.log(`  Total: ${committeeDisplays.length} committees`);
      console.log("═".repeat(80) + "\n");
    } catch (error) {
      console.error("❌ Failed to list committees:", error);
      process.exit(1);
    }
  });

function formatCell(text: string, width: number): string {
  if (text.length > width) {
    return text.substring(0, width - 3) + "...";
  }
  return text.padEnd(width);
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > width) {
    let breakPoint = remaining.lastIndexOf(" ", width);
    if (breakPoint === -1) breakPoint = width;
    lines.push(remaining.substring(0, breakPoint));
    remaining = "     " + remaining.substring(breakPoint).trim();
  }

  if (remaining.trim()) {
    lines.push(remaining);
  }

  return lines;
}
