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

## Commands

### Analyze Trades

The main command that fetches fresh trade data and scores purchases for uniqueness:

```bash
npm start -- analyze
```

**Options:**
- `--min-score <number>` - Minimum uniqueness score to show (default: 40)
- `--top <number>` - Limit to top N results, 0 = all (default: 0)
- `--type <type>` - Filter by trade type: `purchase` (default), `sale`, or `all`
- `--no-fetch-trades` - Skip fetching fresh data, use cached
- `--no-market-data` - Skip fetching market data (faster, but no market cap scoring)
- `--json` - Output raw JSON instead of formatted text

### Fetch Trades

Fetch congressional trades going back to a target date:

```bash
npm start -- fetch:trades
```

**Options:**
- `--since <date>` - Fetch trades since date (YYYY-MM-DD). Default: 3 months ago
- `--limit <number>` - Trades per page (default: 100)
- `-f, --force` - Force fetch even if data is recent

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
Based on the company's market capitalization:
- **Micro cap** (< $300M): 100 points
- **Small cap** (< $2B): 75 points
- **Mid cap** (< $10B): 25 points
- **Large cap** (≥ $10B): 0 points

*Rationale: Smaller companies receive less analyst coverage, so congressional trades may represent unique information.*

#### Conviction Score (0-100)
Based on trade size relative to the trader's average:
- **5x+ average**: 100 points (very high conviction)
- **2x-5x average**: 75 points (high conviction)
- **1.5x-2x average**: 50 points
- **1x-1.5x average**: 25 points
- **Below average**: 0 points

*Rationale: Unusually large trades may indicate stronger conviction about the position.*

#### Rarity Score (0-100)
Based on how often congress members have traded this stock:
- **Unique** (≤1 trade): 100 points
- **Rare** (≤3 trades): 75 points
- **Uncommon** (≤10 trades): 50 points
- **Common** (>10 trades): 0 points
- **Bonus**: +25 if only one trader, +10 if ≤3 traders

*Rationale: Stocks that congress members rarely trade may represent unique situations.*

#### Committee Relevance Score (0-100)
Based on overlap between the trader's committee assignments and the stock's sector/industry:
- **Multiple committee overlaps**: 100 points
- **Single committee overlap**: 75 points
- **No overlap**: 0 points

*Rationale: Members may have industry-specific knowledge from their committee work.*

The tool maps FMP's sector/industry taxonomy to congressional committees. For example:
- Senate Banking Committee → Financial Services sector
- House Energy & Commerce → Healthcare, Utilities sectors
- House Armed Services → Industrials sector (Aerospace & Defense)

#### Derivative Score (0-100)
Based on the type of asset traded:
- **Options/Warrants/Rights**: 100 points
- **Futures/Other derivatives**: 75 points
- **Regular stock**: 0 points

*Rationale: Derivatives have expiration dates, suggesting timing-sensitive information.*

#### Ownership Score (0-100)
Based on who owns the asset:
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

```
📊 IREN - Iris Energy Ltd
   Trader: Cleo Fields (D) (house)
   Type: Purchase | Amount: $15,001 - $50,000
   Date: 2025-12-26
   Score: 68/100
   Factors:
     - Market Cap: $2847M (mid)
     - Rarity: rare (2 total congress trades)
     - Indirect Ownership: Spouse
```

## Data Sources

- **Trade Data**: FMP Senate/House trading endpoints
- **Market Data**: FMP stock profile endpoint (sector, industry, market cap)
- **Committee Data**: [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) GitHub repository

## Disclaimer

This tool is for informational and educational purposes only. It does not constitute investment advice. Congressional trading data is publicly available but may be delayed. Always do your own research before making investment decisions.
