#!/usr/bin/env node

import { config } from "dotenv";
import { Command } from "commander";
import { fetchCommitteesCommand } from "./commands/fetch-committees.js";
import { fetchTradesCommand } from "./commands/fetch-trades.js";
import { fetchTaxonomyCommand } from "./commands/fetch-taxonomy.js";
import { analyzeCommand } from "./commands/analyze.js";
import { statusCommand } from "./commands/status.js";
import { runCommand } from "./commands/run.js";
import { listCommitteesCommand } from "./commands/list-committees.js";
import { listTradesCommand } from "./commands/list-trades.js";

// Load environment variables
config();

const program = new Command();

program
  .name("congress-trades")
  .description("CLI tool to identify unique trades made by US Congress members")
  .version("1.0.0");

// Register commands
program.addCommand(fetchCommitteesCommand);
program.addCommand(fetchTradesCommand);
program.addCommand(fetchTaxonomyCommand);
program.addCommand(analyzeCommand);
program.addCommand(statusCommand);
program.addCommand(runCommand);
program.addCommand(listCommitteesCommand);
program.addCommand(listTradesCommand);

// Parse arguments
program.parse();
