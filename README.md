# Congress Trades CLI

A command-line tool for tracking and analyzing congressional stock trades to identify unique investment opportunities.

## Overview

This tool fetches congressional trading data from [Financial Modeling Prep (FMP)](https://financialmodelingprep.com/) and scores each trade based on multiple factors to help identify potentially interesting or unusual trades. The goal is to surface trades that might be worth investigating further, not to provide investment advice.

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file with your FMP API key:

```
FMP_API_KEY=your_api_key_here
```

### Global CLI Installation (Optional)

To use the CLI without `npm start --`, install it globally:

```bash
npm link
```

Then you can run commands directly:
```bash
congress-trades analyze --since 2026-01-01
congress-trades fetch:trades
congress-trades report:sales
```

## Commands

### Analyze Trades

The main command that fetches fresh trade data and scores purchases for uniqueness:

```bash
npm start -- analyze
```

**Analyze recent trades only:**
```bash
npm start -- analyze --since 2026-01-01
```

This analyzes the full dataset for accurate scoring but only displays trades from the specified date onwards.

**Options:**
- `--min-score <number>` - Minimum uniqueness score to show (default: 40)
- `--top <number>` - Limit to top N results, 0 = all (default: 0)
- `--type <type>` - Filter by trade type: `purchase` (default), `sale`, or `all`
- `--since <date>` - Only show trades from this date onwards (YYYY-MM-DD). Note: Full dataset is still analyzed for accurate rarity scoring
- `--no-fetch-trades` - Skip fetching fresh data, use cached
- `-r, --refresh` - Force full refresh instead of incremental update (only when fetching)
- `--no-market-data` - Skip fetching market data (faster, but no market cap scoring)
- `--market-data-ttl <days>` - Market data cache TTL in days (default: 30)
- `--json` - Output raw JSON instead of formatted text

### Fetch Trades

Fetch congressional trades with **incremental updates** (fetches only new trades by default):

```bash
npm start -- fetch:trades
```

**Incremental Mode (default):**
- Loads existing trade data
- Fetches only trades newer than the most recent trade in the database
- Merges new trades with existing data, avoiding duplicates
- Perfect for daily/weekly updates

**Refresh Mode:**
```bash
npm start -- fetch:trades --refresh
```
- Clears existing data and fetches all trades from the target date
- Use this for the initial fetch or when you want to rebuild the database

**Options:**
- `-r, --refresh` - Force full refresh from target date instead of incremental update
- `--since <date>` - Target date for refresh mode (YYYY-MM-DD). Default: 1 year ago
- `--limit <number>` - Trades per page (default: 100)

### Sales Report

Generate a simple formatted report of all sales (useful for checking against your holdings):

```bash
npm start -- report:sales
```

### Fetch Committee Data

Fetch committee membership data for committee relevance scoring:

```bash
npm start -- fetch:committees
```

## Data Sources

### Congressional Trade Data
**Source:** FMP REST API
**Endpoints:**
- `GET /stable/senate-latest?page={n}&limit={n}` - Senate trades
- `GET /stable/house-latest?page={n}&limit={n}` - House trades

**Fetching Behavior:**
- **Incremental mode (default):** Fetches only trades newer than the most recent trade in the local database, then merges with existing data
- **Refresh mode (`--refresh`):** Fetches all trades going back to the target date (default: 1 year ago), replacing existing data
- Duplicate detection uses: `firstName`, `lastName`, `transactionDate`, `symbol`, `type`, `amount`, `owner`

**Fields used:** `symbol`, `firstName`, `lastName`, `transactionDate`, `type`, `amount`, `owner`, `assetType`, `assetDescription`

**Storage:** Trade data is stored locally in `data/trades.json` with a timestamp, enabling fast incremental updates

## Caching Strategy

All data is cached locally in the `data/` directory to minimize API calls and speed up analysis:

| Data Type | Cache File | TTL | Behavior |
|-----------|-----------|-----|----------|
| **Trade Data** | `trades.json` | ∞ | Incremental: Fetches only new trades since last update |
| **Market Data** | `market-data-cache.json` | 30 days (configurable) | Per-symbol caching with expiration |
| **Committee Data** | `committee-data.json` | 24 hours | Full refresh when expired |
| **Legislators** | `legislators.json` | 24 hours | Full refresh when expired |
| **Sectors/Industries** | `fmp-sectors.json`, `fmp-industries.json` | 7 days | Taxonomy data, rarely changes |

**Customizing Market Data Cache:**
```bash
npm start -- analyze --market-data-ttl 7   # 7-day cache
npm start -- analyze --market-data-ttl 90  # 90-day cache
```

### Market Data (for scoring)
**Source:** FMP REST API
**Endpoint:** `GET /stable/profile?symbol={symbol}`

Fetched during analysis for each unique symbol in the trade data. Provides:
- `marketCap` - Company market capitalization in dollars
- `sector` - FMP sector classification (e.g., "Technology", "Healthcare")
- `industry` - FMP industry classification (e.g., "Software - Application", "Banks - Diversified")
- `averageVolume` - Average trading volume

**Caching:** Market data is cached for 30 days by default (configurable with `--market-data-ttl`). Since scoring uses thresholds (micro/small/mid/large cap), not exact values, a 30-day cache is reasonable as companies rarely change categories within that timeframe.

### Committee Membership Data
**Source:** GitHub raw files from [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators)

**Files fetched:**
- `legislators-current.yaml` - Current congress member info (name, party, terms)
- `committee-membership-current.yaml` - Which members sit on which committees
- `committees-current.yaml` - Committee metadata (names, IDs)

This data is used to:
1. Look up a trader's committee assignments by matching their name
2. Determine their party affiliation (R/D)

### Committee-to-Sector Mapping
**Source:** Local taxonomy file (`src/data/committee-sector-taxonomy.ts`)

A manually curated mapping from congressional committees to FMP sectors/industries. For example:
- `SSBK` (Senate Banking) → Financial Services sector, Banks/Insurance industries
- `HSAG` (House Agriculture) → Consumer Defensive sector, Agricultural Inputs industry
- `SSAS` (Senate Armed Services) → Industrials sector, Aerospace & Defense industry

## Uniqueness Scoring

Each trade is scored on a 0-100 scale based on six weighted factors. Higher scores indicate more "unique" or potentially interesting trades.

### Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Market Cap | 20% | Smaller companies are less followed by analysts |
| Conviction | 25% | Larger trades relative to trader's typical size |
| Rarity | 25% | Stocks rarely traded by congress members |
| Committee Relevance | 15% | Trading in sectors the member's committee oversees |
| Derivative | 10% | Options/warrants indicate timing sensitivity |
| Ownership | 5% | Indirect ownership (spouse/child) may indicate distancing |

### Factor Calculations

#### Market Cap Score (0-100)

**Data source:** FMP `/stable/profile` endpoint → `marketCap` field

**Calculation:**
1. Fetch the stock's profile from FMP
2. Read the `marketCap` value (in dollars)
3. Score based on thresholds:
   - **Micro cap** (< $300M): 100 points
   - **Small cap** (< $2B): 75 points
   - **Mid cap** (< $10B): 25 points
   - **Large cap** (≥ $10B): 0 points
   - **No data available**: 0 points

*Rationale: Smaller companies receive less analyst coverage, so congressional trades may represent unique information.*

#### Conviction Score (0-100)

**Data source:** Trade `amount` field from FMP trade endpoints, compared against trader's historical average

**Calculation:**
1. Parse the trade's amount range (e.g., "$15,001 - $50,000" → midpoint $32,500)
2. Calculate the trader's average trade size from all their trades in the dataset
3. Compute multiplier: `tradeSize / averageTradeSize`
4. Score based on multiplier:
   - **5x+ average**: 100 points (very high conviction)
   - **2x-5x average**: 75 points (high conviction)
   - **1.5x-2x average**: 50 points
   - **1x-1.5x average**: 25 points
   - **Below average**: 0 points

*Rationale: Unusually large trades may indicate stronger conviction about the position.*

#### Rarity Score (0-100)

**Data source:** Aggregated from all trades in the fetched dataset

**Calculation:**
1. Count total congressional trades for this symbol across the entire dataset
2. Count unique traders (congress members) who have traded this symbol
3. Score based on total trades:
   - **Unique** (≤1 trade): 100 points
   - **Rare** (≤3 trades): 75 points
   - **Uncommon** (≤10 trades): 50 points
   - **Common** (>10 trades): 0 points
4. Add bonus for concentrated interest:
   - Only 1 unique trader: +25 points
   - ≤3 unique traders: +10 points
5. Cap at 100 points

*Rationale: Stocks that congress members rarely trade may represent unique situations.*

#### Committee Relevance Score (0-100)

**Data sources:**
- Trader's committees: GitHub `committee-membership-current.yaml`
- Stock's sector/industry: FMP `/stable/profile` endpoint
- Committee-to-sector mapping: Local taxonomy file

**Calculation:**
1. Look up the trader's committee assignments from GitHub data
2. Fetch the stock's sector and industry from FMP
3. For each of the trader's committees, check if it has jurisdiction over the stock's sector or industry using the local taxonomy
4. Score based on overlaps:
   - **Multiple committee overlaps**: 100 points
   - **Single committee overlap**: 75 points
   - **No overlap**: 0 points

*Rationale: Members may have industry-specific knowledge from their committee work.*

**Example:** If Senator X sits on the Banking Committee (SSBK) and trades JPMorgan (sector: "Financial Services", industry: "Banks - Diversified"), this scores 75 points because SSBK has jurisdiction over financial services.

#### Derivative Score (0-100)

**Data source:** Trade `assetType` field from FMP trade endpoints

**Calculation:**
1. Read the `assetType` field from the trade
2. Check for derivative keywords:
   - Contains "option", "warrant", or "right": 100 points
   - Contains "future" or "derivative": 75 points
   - Regular stock or other: 0 points

*Rationale: Derivatives have expiration dates, suggesting timing-sensitive information.*

#### Ownership Score (0-100)

**Data source:** Trade `owner` field from FMP trade endpoints

**Calculation:**
1. Read the `owner` field from the trade
2. Score based on ownership type:
   - **Child/Dependent**: 100 points
   - **Spouse**: 75 points
   - **Joint**: 25 points
   - **Self**: 0 points

*Rationale: Indirect ownership may indicate an attempt to distance from the trade.*

### Overall Score Calculation

The overall score is a weighted average of all factor scores:

```
Overall = (MarketCap × 0.20) + (Conviction × 0.25) + (Rarity × 0.25) +
          (CommitteeRelevance × 0.15) + (Derivative × 0.10) + (Ownership × 0.05)
```

## Output

Reports are saved to the `formatted-reports/` directory with timestamps.

### Sample Output

**Trade without committee relevance:**
```
📊 FMAO - Farmers & Merchants Bancorp Inc
   Trader: Robert E. Latta (R) (house)
   Type: Purchase | Amount: $1,001 - $15,000
   Date: 2026-01-20
   Score: 50/100
   Factors:
     - Market Cap: $352M (small)
     - Rarity: unique (1 total congress trades)
     - Indirect Ownership: Spouse
```

**Trade with committee relevance (potential oversight concern):**
```
📊 PG - The Procter & Gamble Co
   Trader: David Taylor (R) (house)
   Type: Purchase | Amount: $1,001 - $15,000
   Date: 2026-01-09
   Score: 36/100
   Factors:
     - Market Cap: $345B (large)
     - Rarity: unique (1 total congress trades)
     ⚠️  Committee Relevance: House Committee on Agriculture
        Sector: Consumer Defensive | Industry: Household & Personal Products
```

The report includes:
- **Trader info**: Name, party (R/D), chamber
- **Trade details**: Type, amount range, transaction date
- **Scoring**: Overall score (0-100) and breakdown by factor
- **Committee relevance**: Only shown when a member's committee has jurisdiction over the stock's sector/industry, displaying:
  - Which committee(s) have oversight
  - The stock's sector and industry classification

## Disclaimer

This tool is for informational and educational purposes only. It does not constitute investment advice. Congressional trading data is publicly available but may be delayed. Always do your own research before making investment decisions.
