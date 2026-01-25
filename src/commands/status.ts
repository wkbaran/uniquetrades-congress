import { Command } from "commander";
import { getDataAge, formatDuration, listReports } from "../utils/storage.js";

export const statusCommand = new Command("status")
  .description("Show status of cached data and reports")
  .action(async () => {
    console.log("\n📊 DATA STATUS\n");

    // Check committee data
    const committeeAge = await getDataAge("committee-data.json");
    if (committeeAge.exists) {
      console.log("✅ Committee Data:");
      console.log(`   Last fetched: ${committeeAge.fetchedAt}`);
      console.log(`   Age: ${formatDuration(committeeAge.ageMs || 0)}`);
    } else {
      console.log("❌ Committee Data: Not fetched");
      console.log("   Run 'fetch:committees' to fetch");
    }

    console.log("");

    // Check trade data
    const tradeAge = await getDataAge("trades.json");
    if (tradeAge.exists) {
      console.log("✅ Trade Data:");
      console.log(`   Last fetched: ${tradeAge.fetchedAt}`);
      console.log(`   Age: ${formatDuration(tradeAge.ageMs || 0)}`);
    } else {
      console.log("❌ Trade Data: Not fetched");
      console.log("   Run 'fetch:trades' to fetch");
    }

    console.log("");

    // Check reports
    const reports = await listReports();
    const uniqueTradeReports = reports.filter((r) =>
      r.startsWith("unique-trades")
    );

    if (uniqueTradeReports.length > 0) {
      console.log(`📄 Reports: ${uniqueTradeReports.length} analysis reports`);
      console.log(`   Latest: ${uniqueTradeReports[0]}`);
    } else {
      console.log("📄 Reports: None generated yet");
      console.log("   Run 'analyze' to generate");
    }

    console.log("");
  });
