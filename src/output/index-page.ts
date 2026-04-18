import * as fs from "fs/promises";
import * as path from "path";

export interface ReportManifestEntry {
  date: string;        // ISO date string, e.g. "2026-04-18"
  dateLabel: string;   // Human-readable, e.g. "Week of April 13, 2026"
  file: string;        // Relative filename, e.g. "report-2026-04-18.html"
  totalTrades: number;
  topSymbols: string[]; // Up to 8 top symbols as preview
}

const MANIFEST_FILE = "manifest.json";

// ─────────────────────────────────────────────────────────────────────────────
// Manifest helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function loadManifest(webDir: string): Promise<ReportManifestEntry[]> {
  const manifestPath = path.join(webDir, MANIFEST_FILE);
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(raw) as ReportManifestEntry[];
  } catch {
    return [];
  }
}

async function writeManifest(webDir: string, entries: ReportManifestEntry[]): Promise<void> {
  await fs.writeFile(
    path.join(webDir, MANIFEST_FILE),
    JSON.stringify(entries, null, 2)
  );
}

/**
 * Remove manifest entries whose HTML files no longer exist on disk.
 */
async function pruneManifest(
  webDir: string,
  manifest: ReportManifestEntry[]
): Promise<ReportManifestEntry[]> {
  const live: ReportManifestEntry[] = [];
  for (const entry of manifest) {
    try {
      await fs.access(path.join(webDir, entry.file));
      live.push(entry);
    } catch {
      console.log(`   Pruned stale manifest entry: ${entry.file}`);
    }
  }
  return live;
}

/**
 * Insert or update a manifest entry, prune deleted files, sort newest first.
 * Returns the updated manifest.
 */
export async function upsertManifest(
  webDir: string,
  entry: ReportManifestEntry
): Promise<ReportManifestEntry[]> {
  let manifest = await loadManifest(webDir);

  // Upsert
  const idx = manifest.findIndex((e) => e.date === entry.date);
  if (idx >= 0) manifest[idx] = entry;
  else manifest.unshift(entry);

  // Prune then sort
  manifest = await pruneManifest(webDir, manifest);
  manifest.sort((a, b) => b.date.localeCompare(a.date));

  await writeManifest(webDir, manifest);
  return manifest;
}

/**
 * Rebuild the manifest by scanning for existing report HTML files.
 * Removes entries whose files are gone; keeps metadata for those that remain.
 */
export async function rebuildManifest(webDir: string): Promise<ReportManifestEntry[]> {
  const manifest = await loadManifest(webDir);
  const pruned = await pruneManifest(webDir, manifest);
  pruned.sort((a, b) => b.date.localeCompare(a.date));
  await writeManifest(webDir, pruned);
  return pruned;
}

// ─────────────────────────────────────────────────────────────────────────────
// Index page CSS (self-contained)
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_CSS = `
  :root {
    --bg: #1e1e2e; --surface: #313244; --surface2: #45475a;
    --border: #585b70; --text: #cdd6f4; --subtext: #a6adc8;
    --muted: #6c7086; --accent: #89b4fa; --radius: 10px;
  }
  [data-theme="light"] {
    --bg: #eff1f5; --surface: #e6e9ef; --surface2: #dce0e8;
    --border: #bcc0cc; --text: #4c4f69; --subtext: #5c5f77;
    --muted: #9ca0b0; --accent: #1e66f5;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: 'Inter', system-ui, sans-serif;
    line-height: 1.5; min-height: 100vh;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .site-header {
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem; display: flex; align-items: center;
    justify-content: space-between; gap: 1rem;
  }
  .site-title { font-size: 1.1rem; font-weight: 700; color: var(--accent); }
  .site-subtitle { font-size: 0.8rem; color: var(--subtext); margin-top: 0.15rem; }
  .theme-btn {
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); padding: 0.35rem 0.75rem; border-radius: 6px;
    cursor: pointer; font-size: 0.8rem;
  }
  main { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
  h1 { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; color: var(--text); }
  .report-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .report-item {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem 1.25rem;
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 1rem; transition: background 0.1s;
  }
  .report-item:hover { background: var(--surface2); }
  .report-meta { flex: 1; min-width: 0; }
  .report-date { font-size: 0.88rem; font-weight: 600; }
  .report-count { font-size: 0.78rem; color: var(--subtext); margin-top: 0.15rem; }
  .report-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .chip {
    font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.5rem;
    border-radius: 4px; background: rgba(137,180,250,0.12);
    color: var(--accent); border: 1px solid rgba(137,180,250,0.25);
  }
  .report-link { white-space: nowrap; font-size: 0.83rem; align-self: center; }
  footer {
    text-align: center; font-size: 0.75rem; color: var(--muted);
    padding: 2rem 1rem; border-top: 1px solid var(--border); margin-top: 2rem;
  }
  @media (max-width: 600px) {
    .report-item { flex-direction: column; }
    .report-link { align-self: flex-start; }
  }
`;

const INDEX_JS = `
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme-btn');
  const saved = localStorage.getItem('congress-theme');
  if (saved === 'light') root.setAttribute('data-theme', 'light');
  function updateLabel() {
    const current = root.getAttribute('data-theme');
    if (btn) btn.textContent = current === 'light' ? '\u{1F319} Dark' : '\u2600\uFE0F Light';
  }
  updateLabel();
  if (btn) {
    btn.addEventListener('click', function () {
      const current = root.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('congress-theme', next);
      updateLabel();
    });
  }
})();
`;

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// Index page builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildIndexPage(entries: ReportManifestEntry[]): string {
  const rows = entries.map((e) => {
    const chips = e.topSymbols
      .slice(0, 6)
      .map((s) => `<span class="chip">${escHtml(s)}</span>`)
      .join("");

    return `
    <div class="report-item">
      <div class="report-meta">
        <div class="report-date">${escHtml(e.dateLabel)}</div>
        <div class="report-count">${e.totalTrades} trades</div>
        ${chips ? `<div class="report-chips">${chips}</div>` : ""}
      </div>
      <span class="report-link"><a href="${escHtml(e.file)}">View report \u2192</a></span>
    </div>`;
  });

  const emptyMsg = `<p style="color:var(--muted);font-size:0.88rem;">No reports yet. Run <code>congress-trades report:html</code> to generate the first one.</p>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Congress Trades \u2014 Report Archive</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>${INDEX_CSS}</style>
</head>
<body>

<header class="site-header">
  <div>
    <div class="site-title">Congress Trades</div>
    <div class="site-subtitle">Weekly analysis of unique congressional stock trades</div>
  </div>
  <button class="theme-btn" id="theme-btn">\u2600\uFE0F Light</button>
</header>

<main>
  <h1>Report Archive</h1>
  <div class="report-list">
    ${entries.length ? rows.join("\n") : emptyMsg}
  </div>
</main>

<footer>
  Data sourced from Financial Modeling Prep API and congress-legislators.
  Not investment advice.
</footer>

<script>${INDEX_JS}</script>
</body>
</html>`;
}
