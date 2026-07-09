# FMP Migration Plan

## Why this exists

The current FMP Personal-plan TOS (§2.2.1 / §2.2.2 / §2.6.1) blocks:
- Any public display of FMP data or derived data on a multi-user site
- Any commercial use, including data analysis "to support commercial activities"
- Any redistribution of data "contained in or derived from" the Services

The existing public CloudFront site is already non-compliant on a strict reading, and the proposed paid newsletter (MONETIZE.md) cannot be launched on this tier.

This document maps the exact FMP dependencies in the codebase and lays out a migration path. The good news: most of what FMP provides isn't legally FMP's to begin with (the trade disclosures are public-domain government filings). The bad news, discovered during vendor research: the **market-data enrichment layer has no cheap "just works" replacement**. Polygon, Finnhub, Tiingo all have nearly identical "personal-only" terms on their retail tiers, with "Contact Us" commercial pricing. So the realistic options collapse to:

1. **Contact FMP sales** for commercial-tier pricing (zero code change, leverage as existing annual customer).
2. **Re-architect** so the public site uses only public-domain data, push licensed enrichment behind the paywall, and use any commercial-friendly vendor for the smaller paid-tier dataset.
3. **Get parallel quotes** from Polygon (Massive) Business and Finnhub Commercial to compare.

Migration mechanics are documented below regardless of which vendor wins — the code work is largely the same.

---

## FMP dependency map

There are exactly **two** concerns, hitting **six** endpoints across **two** modules.

### 1. Congressional trade disclosures

| File | Endpoint | Purpose |
|---|---|---|
| `src/services/fmp-client.ts` (`getSenateTrades`) | `/stable/senate-latest` | Paginated list of Senate PTR filings |
| `src/services/fmp-client.ts` (`getHouseTrades`) | `/stable/house-latest` | Paginated list of House PTR filings |

Consumers: `src/services/trade-service.ts` (`fetchTrades`), `src/commands/fetch-trades.ts`, `src/commands/run.ts`.

**Critical legal observation:** these are STOCK Act Periodic Transaction Reports — **public-domain U.S. government filings**, published by the Senate eFD and the House Clerk. FMP aggregates them but does not own them. Replacing this source removes FMP from the load-bearing path of the entire product.

### 2. Market data enrichment (per-symbol)

| File | Endpoint | Fields used |
|---|---|---|
| `src/data/fmp-provider.ts` (`fetchFromAPI`) | `/stable/profile` | `mktCap`, `sector`, `industry`, `volAvg`, `exchange` |
| `src/services/fmp-client.ts` (`getQuote`) — defined but **not invoked** by current pipeline | `/stable/quote` | (dead code — `MarketDataProvider` path took over) |
| `src/data/fmp-provider.ts` (`fetchAvailableSectors`) | `/stable/available-sectors` | Dev-only taxonomy validation (`fetch-taxonomy` command) |
| `src/data/fmp-provider.ts` (`fetchAvailableIndustries`) | `/stable/available-industries` | Dev-only taxonomy validation |

Consumers: `src/services/analysis-service.ts` calls `MarketDataProvider.getMarketDataBatch()`, which is implemented by `FMPMarketDataProvider`. The provider is already wired through a `MarketDataProvider` interface (`src/data/types.ts`) — **swap-ready by design**.

### What actually appears publicly

In `src/output/html.ts` the FMP-derived fields rendered to readers are:
- `marketCap` (and the bucket: micro/small/mid/large)
- `sector` and `industry` (for committee-overlap explanation)
- `exchange` (used only as a prefix for TradingView deep-links, not displayed as text)
- Trade fields from senate/house endpoints — but those originate with the U.S. government, not FMP

The uniqueness score, factor scores, and explanations are computed by `src/scoring/uniqueness-scorer.ts` from these inputs.

---

## Replacement sources

### Trade disclosures (replaces 2 endpoints)

Preferred: **house-stock-watcher + senate-stock-watcher** open datasets.
- URL: https://housestockwatcher.com and https://senatestockwatcher.com
- Format: bulk JSON, refreshed daily
- License: open data, attribution requested
- Pros: zero cost, already-parsed, includes all fields the current code reads (`firstName`, `lastName`, `transactionDate`, `symbol`, `type`, `amount`, `owner`, `assetType`, `assetDescription`, `dateRecieved`)
- Cons: third-party operator; if it ever shuts down, fall back to scraping the official sources

Fallback: **direct from government**
- Senate: https://efdsearch.senate.gov/search/ — has a click-through ToS; XML download available but the search itself is finicky for bots
- House: https://disclosures-clerk.house.gov/ — annual XML ZIPs of all PTRs are publicly downloadable, no click-through; PDFs for individual filings

Either way, the data is public domain. No license risk.

### Market data (replaces 4 endpoints; 2 of which are dev-only)

**This is the hard part.** Initial research suggested Polygon Stocks Starter at $29/mo was a clean swap. That was wrong. Polygon's published Market Data Terms forbid commercial display of Market Data "or any data, charts, analytics, research, or other works based on, referring to, or derived from the Market Data" — essentially the same restriction shape as FMP Personal. Their retail tier is licensed for "personal, non-business, and non-commercial purposes" only; commercial display requires a separate Business agreement with sales-quoted pricing.

The same pattern holds across the industry. Confirmed via published TOS / pricing pages:

| Vendor | Retail tier | Retail license | Commercial display |
|---|---|---|---|
| FMP | $22–$149/mo | Personal-only (§2.2.1) | "Contact Us" — third-party listings suggest $99/mo–$2,500/yr range |
| Polygon / Massive | $29/mo Starter | Personal-only per Market Data TOS | "Contact Us" Business tier |
| Finnhub | Free + $11.99–$99.99/mo | Personal-only on free tier | Modular ~$50/mo per data category; All-in-One $3,500/mo |
| Tiingo | Has cheap tiers | Commercial-org tier exists | Pricing not publicly listed |
| EODHD | Has commercial tiers | Documented commercial use | Get a quote — historically reasonable |

There is no $29/mo "just works" path. Every commercial-display option is a sales conversation.

**Practical implication:** the vendor decision is now a procurement problem, not a technical one. Email FMP, Polygon, and one of Finnhub/Tiingo/EODHD with the same three asks:
1. Permission to display marketCap, sector, industry on a public website
2. Permission to sell CSV export of derived/scored data to paid newsletter subscribers
3. Permission to include the data in a paid email newsletter

Then compare quotes. FMP has a built-in advantage: you're already an annual customer through ~Jan 27, 2027, which is retention leverage.

### Alternative architecture: public-domain-only public site

A separate option that may dominate either vendor choice: **restrict the public site to public-domain data**, and put licensed enrichment behind the paywall.

Public site (no vendor license needed):
- Trade disclosures (PTR filings — public domain)
- Score factors computed from public-domain inputs only: trade amount, frequency, committee membership, asset type, ownership relation
- Symbol → broad sector via SIC code from SEC EDGAR (free, public domain)

Paid tier (licensed under whatever vendor agreement you sign):
- Precise market cap and bucket
- Refined sector/industry taxonomy
- Average daily volume
- CSV exports of scored data

This collapses the licensing exposure. The public site can't be DMCA'd or TOS-violated because it touches no vendor data. The vendor footprint shrinks to "stuff served to paying subscribers" — a smaller surface that's easier to license cheaply.

Tradeoff: the public site loses market-cap-based scoring (currently a 20% weight in the overall score per `src/scoring/types.ts`). Score quality on the public side degrades but doesn't break — the committee-overlap factor (the actual differentiator vs Quiver/Capitol Trades) is fully preserved.

Dev-only taxonomy endpoints (`available-sectors`, `available-industries`) just feed `fetch-taxonomy` for diagnostics. After migration, either drop the command or point it at the new provider's taxonomy. The taxonomy data in `src/data/committee-sector-taxonomy.ts` would need a one-time refresh against whatever sector names the new provider uses (SIC-based for Polygon/EDGAR, GICS-ish for Finnhub, FMP-proprietary for FMP).

Not recommended in any scenario: **yfinance / Yahoo Finance** — Yahoo's TOS explicitly forbids redistribution. Widely violated, but you cannot build a paid product on it.

### TOS verification checklist (do before launch)

For each chosen vendor, confirm in writing:
1. Display of marketCap, sector, industry on a public website is permitted
2. Display of *derived* values (the uniqueness score) is permitted
3. CSV export of derived values to paying customers is permitted
4. Caching is permitted (we cache market data for 30 days; see `DEFAULT_CACHE_CONFIG`)
5. Attribution requirement, if any

---

## Migration approach

The existing `MarketDataProvider` abstraction makes the market-data swap nearly drop-in. The trade-fetching side needs a small refactor to introduce a similar abstraction.

### Step 1 — Introduce a `TradeSourceProvider` interface

New file `src/data/trade-source.ts`:
```ts
export interface TradeSourceProvider {
  fetchSenateTrades(sinceDate: Date): Promise<FMPTrade[]>;
  fetchHouseTrades(sinceDate: Date): Promise<FMPTrade[]>;
  getName(): string;
}
```
Note: the existing `FMPTrade` type can be renamed to `Trade` (just a shape — nothing FMP-specific about the fields). Keep the `dateRecieved` typo for now since the data files persist it; deprecate in a follow-up.

`src/services/trade-service.ts::fetchTrades` takes a `TradeSourceProvider` instead of an `FMPClient`. The merge/dedupe/incremental logic stays as-is — it's source-agnostic.

### Step 2 — Implement `HouseStockWatcherProvider`

New file `src/data/stock-watcher-provider.ts`:
- Fetches `https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json` and equivalent for senate
- Maps their schema to our `Trade` shape
- Caches in `data/trades-raw.json` with a TTL similar to current behavior

This replaces both `getSenateTrades` and `getHouseTrades`.

### Step 3 — Implement market-data provider for whichever vendor wins the quote race

New file `src/data/{vendor}-provider.ts` implementing the existing `MarketDataProvider`. Concrete endpoint mappings:

- **FMP Commercial** (if you stay): no code change — `fmp-provider.ts` already works. Just upgrade the plan.
- **Polygon/Massive Business**: `GET /v3/reference/tickers/{symbol}` → `results.market_cap`, `results.sic_description` (industry), `results.primary_exchange` (exchange). Sector via SIC-to-sector lookup.
- **Finnhub Commercial**: `GET /stock/profile2?symbol={symbol}` → `marketCapitalization`, `finnhubIndustry`, `exchange`.

Same caching pattern as `FMPMarketDataProvider` (the cache file `market-data-cache.json` keeps working; the shape of `MarketData` is unchanged). The `MarketDataProvider` interface in `src/data/types.ts` already abstracts this — just one new file per candidate vendor.

If pursuing the public-domain-only public site architecture, add a second provider: **`EdgarSicProvider`** that returns `{ marketCap: null, sector: sicToSector(sicCode), industry: sicDescription, averageVolume: null }` populated from SEC EDGAR submissions data (free, public domain, no rate limit issues for our volume). This provider runs on the public-site path; the licensed vendor runs only on the paid-tier path.

### Step 4 — Wire it up

- `src/commands/run.ts`, `analyze.ts`, `fetch-trades.ts`: swap construction of `FMPClient` / `FMPMarketDataProvider` for the new providers
- Drop `FMP_API_KEY` from `.env.example`; add `POLYGON_API_KEY`
- Add a `STOCK_WATCHER` toggle if you want both providers selectable, or just commit to the new one

### Step 5 — Update committee→sector taxonomy

`src/data/committee-sector-taxonomy.ts` uses FMP's sector names (e.g. "Consumer Defensive", "Financial Services", "Basic Materials"). Polygon's SIC-derived sectors use a different vocabulary (e.g. "Manufacturing", "Finance, Insurance, and Real Estate").

Two options:
1. **Keep FMP-style sectors as the internal vocabulary** and translate Polygon's output into them in `polygon-provider.ts`. Easiest — taxonomy file doesn't change.
2. Rewrite the taxonomy to Polygon vocabulary. Cleaner long-term but more churn.

Recommend option 1 for the migration; revisit later if Polygon's vocabulary turns out to be more useful for committee mapping.

### Step 6 — Delete FMP code and per-TOS purge cached data

Per FMP TOS §6.3 you must delete all FMP-sourced data including cached data on termination:
- `data/market-data-cache.json` — purge (was FMP `/stable/profile` payloads)
- `data/fmp-sectors.json`, `data/fmp-industries.json` — delete
- `data/trades.json` — **this one is tricky.** The bytes came through FMP's API, but the underlying facts are public-domain government filings. Safe play: re-fetch from house-stock-watcher and overwrite. Defensible play: keep, since the facts are public domain and FMP has no copyright claim over PTR data.
- Then cancel the FMP subscription. Delete `src/services/fmp-client.ts` and `src/data/fmp-provider.ts`.

---

## Effort and cost

Engineering effort (regardless of vendor):

| Item | Estimate |
|---|---|
| `TradeSourceProvider` interface + house-stock-watcher impl | 3–4 hrs |
| New market-data provider impl (vendor-dependent) | 3–4 hrs |
| Sector vocabulary translation layer | 1–2 hrs |
| Wiring + smoke test full pipeline + verify HTML output looks identical | 2–3 hrs |
| TOS / contract review on chosen vendor | 1–2 hrs |
| Data purge + FMP cancellation (if migrating away) | 30 min |
| **Total** | **~10–14 hrs** — one weekend |

If pursuing the public-domain-only public site architecture, add:

| Item | Estimate |
|---|---|
| `EdgarSicProvider` implementation (SEC company tickers + submissions) | 4–6 hrs |
| Wire two providers into the pipeline (public path vs paid path) | 2–3 hrs |
| Update scorer to gracefully degrade when marketCap/avgVolume are null | 1 hr |

Cost comparison (monthly), revised after vendor research:

- **Today (FMP Personal, $22–$59/mo equivalent):** product is not legally launchable as monetized
- **FMP Commercial (if quote comes in reasonable):** likely $99–$200/mo based on third-party listings — zero code change
- **Polygon Business (quote needed):** unknown; likely comparable to FMP Commercial
- **Finnhub Commercial:** $50/mo per data category modular, $3,500/mo All-in-One — likely too expensive unless they have a sub-$200 tier we haven't found
- **Public-domain public site + cheaper paid-tier license:** could land at $30–$100/mo depending on vendor, because the licensed surface shrinks
- **Trade data:** $0 in all scenarios (public-domain government filings)

**Updated bottom line:** the original document claimed migration was cheaper than upgrading FMP. With Polygon's actual TOS in hand, that claim doesn't hold. The realistic decision is between (a) upgrading FMP for zero code change at an unknown but plausibly competitive price, (b) migrating to a different commercial vendor at unknown price plus 10–14 hrs of work, or (c) re-architecting to shrink the licensed surface so any vendor becomes affordable.

---

## Risks during migration

| Risk | Mitigation |
|---|---|
| house-stock-watcher schema differs in subtle ways from FMP | Diff a single week of trades from both sources before cutover; reconcile field-by-field |
| Polygon's SIC-derived sectors don't map cleanly to existing committee taxonomy | Translation layer in provider (option 1 above); keep current sector names as canonical |
| Some symbols on Polygon return null where FMP returned data (or vice versa) | The pipeline already handles null gracefully (`scoreMarketCap` returns 0 for missing data — "not penalized, just not scored") |
| house-stock-watcher goes offline or stops updating | Fallback path: scrape House Clerk XML ZIPs directly; document the URL in the provider |
| Polygon rate limits on Starter tier are tighter than FMP | 30-day cache already in place; symbol set is small (hundreds, not thousands). Should not bind. |

---

## Decision path

1. **This week:** email FMP, Polygon (Massive) Business, and one of Finnhub/Tiingo/EODHD sales with the three permissions ask above. State clearly: existing FMP customer through Jan 2027, planning a paid newsletter at $10/mo with 50–200 subscribers in year one, need public website display + paid newsletter + CSV export rights.
2. **When quotes return:** if FMP comes in at ≤ $150/mo and grants the three permissions, take it — zero code change, fastest path to launch. If FMP comes in high, compare against the others. If all vendors come in expensive, fall back to the public-domain-only public site architecture and use the cheapest commercial-friendly vendor only on the paid-tier path.
3. **Cutover style:** one env var (`DATA_SOURCE=fmp` vs `DATA_SOURCE=open`) selects the trade source. If staying on FMP Commercial, no toggle needed. If migrating, run both in parallel for 1–2 weeks against the same input window to validate scoring stability before flipping the public site.
4. **FMP subscription:** runs through ~Jan 27, 2027 either way. If migrating, let it lapse silently — don't pay the cancellation tax of dual-billing.
