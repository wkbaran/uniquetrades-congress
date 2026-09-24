# Scoring

Every trade gets a 0–100 uniqueness score: a weighted average of six factor scores, each also 0–100. A higher score means the trade looks less like routine congressional trading. It says nothing about whether the trade was a good investment.

```
Overall = MarketCap × 0.20 + Conviction × 0.25 + Rarity × 0.25
        + CommitteeRelevance × 0.15 + Derivative × 0.10 + Ownership × 0.05
```

| Factor | Weight | Asks |
|---|---|---|
| [Market cap](#market-cap) | 20% | Is it a small company that few analysts follow? |
| [Conviction](#conviction) | 25% | Is it much bigger than this member's usual trade? |
| [Rarity](#rarity) | 25% | Does Congress rarely trade this stock? |
| [Committee relevance](#committee-relevance) | 15% | Does the member's committee oversee this company's industry? |
| [Derivative](#derivative) | 10% | Is it an option or warrant, which expires? |
| [Ownership](#ownership) | 5% | Did it go through a spouse's or child's account? |

The report's tags come from the same factors: **Rare** means a rarity score of 50 or more, **Large** a conviction score of 50 or more (1.5× their usual trade), and **Small cap** a market cap score of 50 or more (under $2B).

The weights and thresholds live in `DEFAULT_SCORING_CONFIG` in `src/scoring/types.ts`. The scorer is `src/scoring/uniqueness-scorer.ts`, a pure function with no I/O.

## Market cap

Source: SEC EDGAR's `EntityPublicFloat` for the company, a slightly stale stand-in for market cap. With `DATA_SOURCE=fmp` it is FMP's `marketCap` instead.

| Company size | Score |
|---|---|
| Micro, under $300M | 100 |
| Small, under $2B | 75 |
| Mid, under $10B | 25 |
| Large, $10B and up | 0 |
| No data | 0 |

Smaller companies get less analyst coverage, so a member's trade in one is more likely to reflect information the market doesn't already have.

## Conviction

Compares the trade to the member's own history. Disclosures give a range, so the trade size is the range's midpoint ("$15,001 - $50,000" is $32,500), and the member's average is taken over all their trades on file.

| Trade size vs. their average | Score |
|---|---|
| 5× or more | 100 |
| 2× to 5× | 75 |
| 1.5× to 2× | 50 |
| 1× to 1.5× | 25 |
| Below average | 0 |

## Rarity

Counts how many times Congress has traded the stock across the whole dataset.

| Congressional trades in it | Score |
|---|---|
| 1 | 100 |
| 2 to 3 | 75 |
| 4 to 10 | 50 |
| More than 10 | 0 |
| No ticker to count by | 50 |

Plus a bonus when interest is concentrated: +25 if only one member has traded it, +10 if three or fewer have. The total is capped at 100.

## Committee relevance

Looks up the member's committees (from [congress-legislators](https://github.com/unitedstates/congress-legislators)) and the company's sector and industry (from EDGAR's SIC code), then checks each committee against the hand-built map in `src/data/committee-sector-taxonomy.ts`.

An industry match counts as a full overlap. A sector-only match counts as a fraction, divided by how many sectors that committee covers, so a committee that oversees a narrow slice of the economy counts for more than one with a broad mandate.

| Overlap | Score |
|---|---|
| At least one full overlap | 100 |
| Only partial overlaps | 75 |
| None | 0 |

For example, a member of the House Armed Services Committee (HSAS) buying Quanta Services (Industrials / Electrical Work) scores here. [Sector and industry mapping](sector-industry-mapping.md) explains the map.

## Derivative

From the trade's asset type.

| Asset type | Score |
|---|---|
| Option, warrant or right | 100 |
| Future or other derivative | 75 |
| Anything else | 0 |

Options expire, so buying one suggests the member expects something to happen soon.

## Ownership

From the trade's owner field. House filings often abbreviate it (SP, JT, DC).

| Owner | Score |
|---|---|
| Dependent child | 100 |
| Spouse | 75 |
| Joint | 25 |
| The member | 0 |
