import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StoredData } from "../types/index.js";

const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_DIR = path.join(process.cwd(), "reports");

/**
 * Ensure a directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

/**
 * Save data to a JSON file with timestamp
 */
export async function saveData<T>(
  filename: string,
  data: T,
  directory: "data" | "reports" = "data"
): Promise<string> {
  const dir = directory === "data" ? DATA_DIR : REPORTS_DIR;
  await ensureDir(dir);

  const stored: StoredData<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };

  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2), "utf-8");

  return filePath;
}

/**
 * Load data from a JSON file
 */
export async function loadData<T>(
  filename: string,
  directory: "data" | "reports" = "data"
): Promise<StoredData<T> | null> {
  const dir = directory === "data" ? DATA_DIR : REPORTS_DIR;
  const filePath = path.join(dir, filename);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as StoredData<T>;
  } catch {
    return null;
  }
}

/**
 * Check if data file exists and get its age
 */
export async function getDataAge(
  filename: string,
  directory: "data" | "reports" = "data"
): Promise<{ exists: boolean; ageMs?: number; fetchedAt?: string }> {
  const stored = await loadData(filename, directory);

  if (!stored) {
    return { exists: false };
  }

  const fetchedAt = new Date(stored.fetchedAt);
  const ageMs = Date.now() - fetchedAt.getTime();

  return {
    exists: true,
    ageMs,
    fetchedAt: stored.fetchedAt,
  };
}

/**
 * Save a timestamped report file
 */
export async function saveReport<T>(
  baseFilename: string,
  data: T
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${baseFilename}-${timestamp}.json`;
  return saveData(filename, data, "reports");
}

/**
 * List all report files
 */
export async function listReports(): Promise<string[]> {
  await ensureDir(REPORTS_DIR);

  try {
    const files = await fs.readdir(REPORTS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Get the latest report file
 */
export async function getLatestReport(
  baseFilename: string
): Promise<string | null> {
  const reports = await listReports();
  const matching = reports.find((r) => r.startsWith(baseFilename));
  return matching || null;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human readable duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
