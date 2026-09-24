# Scanned filings (OCR)

Some members file on paper. The House publishes those as image-only PDFs, and the Senate as "paper filings" made of scanned GIF pages. Neither has text to parse, so each fetch records them in `data/unparseable-filings.json`, and an OCR step reads them with a local [Ollama](https://ollama.com) vision model. The default model, `qwen3.6:27b`, read the test pages with every field correct.

OCR is optional. Without a reachable Ollama the daily run logs a warning and carries on, and those filings just stay out of the report.

## How a filing is read

1. Each page is rendered to PNG with MuPDF. Pages scanned sideways (portrait for the landscape House form, or the reverse for the Senate form) are rotated first, because the model reads a sideways page into confident but wrong rows.
2. The model returns rows as JSON. A row becomes a trade only if its transaction date, amount range and purchase/sale type all normalize to known values. Account header rows, form boilerplate and implausible dates are dropped.
3. Every valid row is kept. A page where fewer than 80% of rows are valid is flagged for review in the log, but its readable rows still go in: a slightly wrong row is easier to notice in the report than a missing trade.
4. Rows are stored with `source: "ocr"` and shown with a **Scanned** tag in the report. A cleanly read filing replaces any rows stored for it. A filing with pages needing review only adds rows when nothing is stored for it yet.

Structured output is deliberately not used: constraining the model with Ollama's JSON-schema `format` made it misread the amount column on 10 of 25 rows of a test page.

## Accuracy

House and Senate scans are both read by default (`OCR_CHAMBERS=house,senate`), but they aren't equally reliable. Hand-checked House pages came out with every field correct (71 of 71 rows). A Senate paper page had 3 of 10 rows wrong, with the amount column and purchase/sale misread. When a Senate paper filer's numbers look off, check the linked filing.

## Settings

| Variable | Default | |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | The Ollama server |
| `OLLAMA_API_KEY` | unset | Sent as a bearer token, for an Ollama behind an authenticating proxy |
| `OCR_MODEL` | `qwen3.6:27b` | Vision model to use |
| `OCR_CHAMBERS` | `house,senate` | Which chambers' scans to read |
| `OCR_DAILY_MAX_PAGES` | `60` | Page budget for each daily run |
| `OCR_TIMEOUT_MS` | `600000` | Per-page timeout |

## Daily run

`report:html` runs OCR after fetching, for scanned filings not yet attempted, up to `OCR_DAILY_MAX_PAGES` pages. Larger filings wait for the catch-up command. Pass `--no-ocr` to skip it.

## Catch-up and review

A page takes about 100 seconds, so a backlog is worked through with `ocr:catchup` (or `ocr-catchup.ps1`, which wraps it and logs to a file):

```powershell
.\ocr-catchup.ps1 --list                 # what would be processed
.\ocr-catchup.ps1                        # everything not yet read
.\ocr-catchup.ps1 --limit 5              # a few filings at a time
.\ocr-catchup.ps1 --filing 9115726       # one filing
.\ocr-catchup.ps1 --retry                # re-run filings that failed or have pages needing review
```

Each run writes `logs\ocr-catchup-<timestamp>.log`: one line per page (status, rotation, valid and rejected rows, time), every rejected row and why, and a closing list of pages to review. For every page, `logs\ocr\<chamber>-<id>\page-N.json` holds the raw model output and validation, and pages needing review also get `page-N.png`. Per-filing outcomes are kept in `data/ocr-results.json`.

After a catch-up, regenerate and publish to include the new rows:

```bash
node dist/index.js report:html --no-fetch-trades --publish
```
