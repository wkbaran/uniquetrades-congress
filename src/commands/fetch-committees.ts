import { Command } from "commander";
import { fetchAllCommitteeData } from "../services/committee-service.js";
import { getDataAge, formatDuration } from "../utils/storage.js";

export const fetchCommitteesCommand = new Command("fetch:committees")
  .description("Fetch and store current committee data and membership")
  .option("-f, --force", "Force fetch even if data is recent")
  .action(async (options) => {
    try {
      // Check if we have recent data
      const age = await getDataAge("committee-data.json");

      if (age.exists && !options.force) {
        const hoursSinceUpdate = (age.ageMs || 0) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 24) {
          console.log(
            `Committee data was fetched ${formatDuration(age.ageMs || 0)} ago.`
          );
          console.log("Use --force to fetch anyway.");
          return;
        }
      }

      console.log("Fetching committee data...\n");
      const data = await fetchAllCommitteeData();

      console.log("\n✅ Committee data fetched successfully:");
      console.log(`   - ${data.committees.length} committees`);
      console.log(
        `   - ${Object.keys(data.membership).length} committee membership records`
      );
      console.log(`   - ${data.sectorMappings.length} sector mappings`);
    } catch (error) {
      console.error("❌ Failed to fetch committee data:", error);
      process.exit(1);
    }
  });
