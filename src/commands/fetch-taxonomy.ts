import { Command } from "commander";
import {
  fetchAvailableSectors,
  fetchAvailableIndustries,
} from "../data/fmp-provider.js";
import {
  SENATE_COMMITTEE_TAXONOMY,
  HOUSE_COMMITTEE_TAXONOMY,
} from "../data/committee-sector-taxonomy.js";

export const fetchTaxonomyCommand = new Command("fetch:taxonomy")
  .description("Fetch FMP sector/industry taxonomy and compare with committee mappings")
  .action(async () => {
    try {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) {
        console.error("❌ FMP_API_KEY environment variable is not set");
        process.exit(1);
      }

      console.log("Fetching FMP taxonomy...\n");

      // Fetch sectors and industries
      const sectors = await fetchAvailableSectors(apiKey);
      const industries = await fetchAvailableIndustries(apiKey);

      console.log("\n" + "=".repeat(60));
      console.log("FMP SECTORS");
      console.log("=".repeat(60));
      for (const sector of sectors.sort()) {
        console.log(`  - ${sector}`);
      }
      console.log(`\nTotal: ${sectors.length} sectors`);

      console.log("\n" + "=".repeat(60));
      console.log("FMP INDUSTRIES");
      console.log("=".repeat(60));
      for (const industry of industries.sort()) {
        console.log(`  - ${industry}`);
      }
      console.log(`\nTotal: ${industries.length} industries`);

      // Compare with our taxonomy
      console.log("\n" + "=".repeat(60));
      console.log("TAXONOMY COMPARISON");
      console.log("=".repeat(60));

      const fmpSectorSet = new Set(sectors);
      const fmpIndustrySet = new Set(industries);

      // Collect all sectors/industries we use in our taxonomy
      const allCommittees = [...SENATE_COMMITTEE_TAXONOMY, ...HOUSE_COMMITTEE_TAXONOMY];
      const usedSectors = new Set<string>();
      const usedIndustries = new Set<string>();

      for (const committee of allCommittees) {
        committee.sectors.forEach((s) => usedSectors.add(s));
        committee.industries.forEach((i) => usedIndustries.add(i));
      }

      // Find mismatches
      const invalidSectors = [...usedSectors].filter((s) => !fmpSectorSet.has(s));
      const invalidIndustries = [...usedIndustries].filter((i) => !fmpIndustrySet.has(i));

      if (invalidSectors.length > 0) {
        console.log("\n❌ INVALID SECTORS (not in FMP):");
        for (const sector of invalidSectors.sort()) {
          console.log(`   - "${sector}"`);
          // Find closest matches
          const matches = sectors.filter((s) =>
            s.toLowerCase().includes(sector.toLowerCase().split(" ")[0])
          );
          if (matches.length > 0) {
            console.log(`     Possible matches: ${matches.join(", ")}`);
          }
        }
      } else {
        console.log("\n✅ All sectors in taxonomy match FMP");
      }

      if (invalidIndustries.length > 0) {
        console.log("\n❌ INVALID INDUSTRIES (not in FMP):");
        for (const industry of invalidIndustries.sort()) {
          console.log(`   - "${industry}"`);
          // Find closest matches
          const firstWord = industry.split(/[—\-\s]/)[0].toLowerCase();
          const matches = industries.filter((i) =>
            i.toLowerCase().includes(firstWord)
          );
          if (matches.length > 0 && matches.length <= 5) {
            console.log(`     Possible matches: ${matches.join(", ")}`);
          }
        }
      } else {
        console.log("\n✅ All industries in taxonomy match FMP");
      }

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("SUMMARY");
      console.log("=".repeat(60));
      console.log(`  FMP Sectors: ${sectors.length}`);
      console.log(`  FMP Industries: ${industries.length}`);
      console.log(`  Our Sectors Used: ${usedSectors.size}`);
      console.log(`  Our Industries Used: ${usedIndustries.size}`);
      console.log(`  Invalid Sectors: ${invalidSectors.length}`);
      console.log(`  Invalid Industries: ${invalidIndustries.length}`);

    } catch (error) {
      console.error("❌ Failed to fetch taxonomy:", error);
      process.exit(1);
    }
  });
