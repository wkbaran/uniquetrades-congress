# Future Enhancements

This document captures planned features and improvements for future implementation.

---

## Committee Activity Integration

**Status:** Planned
**Priority:** Medium-High
**Complexity:** Medium

### Goal

Enhance committee relevance scoring by incorporating **real-time legislative activity** from Congress.gov API. This would identify when trades occur around significant committee actions (hearings, bill markups, investigations).

### Why This Matters

Currently, committee relevance is based on **static jurisdiction** - if a senator sits on Banking Committee and trades bank stocks, it gets flagged. But this misses the temporal dimension:
- Did the trade happen right before/after a hearing?
- Was there an active bill being marked up?
- Had the committee just issued a report on that sector?

These timing patterns are much more interesting than general jurisdiction overlap.

### Data Source: Congress.gov API

**Official Library of Congress API**

- **Status:** Active (ProPublica Congress API was discontinued in 2024)
- **Cost:** Free with API key from [api.data.gov](https://api.data.gov/signup/)
- **Rate Limit:** 5,000 requests/hour
- **Format:** JSON or XML
- **Version:** v3

**Documentation:**
- GitHub: https://github.com/LibraryOfCongress/api.congress.gov
- Official: https://www.loc.gov/apis/additional-apis/congress-dot-gov-api/
- Interactive: https://documenter.getpostman.com/view/6803158/VV56LCkZ

### Available Data

**Committee Activity:**
```
GET /v3/committee/{chamber}/{committeeCode}/reports
GET /v3/committee/{chamber}/{committeeCode}/bills
GET /v3/committee/{chamber}/{committeeCode}/nominations
GET /v3/hearing?api_key={KEY}
```

**Bill Activity:**
```
GET /v3/bill/{congress}/{type}/{number}/actions
GET /v3/bill/{congress}/{type}/{number}/subjects
GET /v3/bill/{congress}/{type}/{number}/cosponsors
```

**What We Can Track:**
- Committee hearings (scheduled, held, transcripts)
- Bills reported out of committee
- Markup sessions
- Committee reports published
- Subpoenas/investigations (if public)

---

## Implementation Options

### Option 1: Simple (Recommended Starting Point)

**What:**
- Fetch recent committee activity once per day
- Cache it alongside committee data (24-hour TTL)
- Display "Recent Activity" badge when trade overlaps with activity

**Scoring:**
- No score changes
- Just add contextual information to output

**Benefits:**
- Minimal API usage (~50 calls/day)
- Simple to implement
- Low maintenance
- Adds value without complexity

**Example Output:**
```
⚠️  Committee Relevance: Senate Banking Committee
   Sector: Financials | Industry: Banks - Regional
   📅 Recent Activity: Hearing on bank regulation (3 days before trade)
```

**Implementation Sketch:**
```typescript
interface CommitteeActivity {
  committeeId: string;
  date: string;
  type: 'hearing' | 'report' | 'markup';
  title: string;
  relatedSectors?: string[];  // Inferred from title/description
}

// Fetch once daily during committee data refresh
async function fetchRecentCommitteeActivity(
  committeeId: string
): Promise<CommitteeActivity[]> {
  // Get hearings from past 60 days
  const hearings = await congressGovApi.getCommitteeHearings(committeeId, 60);

  // Get bills reported out in past 60 days
  const bills = await congressGovApi.getCommitteeBills(committeeId, 60);

  return [...hearings, ...bills];
}

// During scoring, check for activity
function checkRecentActivity(
  trade: FMPTrade,
  committeeIds: string[],
  activityCache: Map<string, CommitteeActivity[]>
): CommitteeActivity[] {
  const tradeDate = new Date(trade.transactionDate);
  const relevantActivity: CommitteeActivity[] = [];

  for (const committeeId of committeeIds) {
    const activities = activityCache.get(committeeId) || [];

    for (const activity of activities) {
      const activityDate = new Date(activity.date);
      const daysDiff = Math.abs(
        (tradeDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Activity within 30 days of trade
      if (daysDiff <= 30) {
        relevantActivity.push(activity);
      }
    }
  }

  return relevantActivity;
}
```

---

### Option 2: Moderate (Activity-Based Scoring)

**What:**
- Everything from Option 1
- Plus: Boost committee relevance score based on recency/type of activity
- Track different activity types with different weights

**Scoring Modifiers:**
- Hearing within 7 days: +30 points
- Hearing within 30 days: +15 points
- Bill reported out within 30 days: +25 points
- Committee report published within 30 days: +20 points
- Investigation announced: +40 points

**Benefits:**
- More nuanced scoring
- Catches suspicious timing patterns
- Quantifies activity relevance

**Challenges:**
- Score inflation (need to rebalance weights)
- More complex logic
- Need to tune thresholds

**Implementation:**
```typescript
interface ActivityScore {
  baseScore: number;
  activityBonus: number;
  activities: CommitteeActivity[];
}

function scoreCommitteeActivity(
  trade: FMPTrade,
  activities: CommitteeActivity[]
): ActivityScore {
  let bonus = 0;
  const tradeDate = new Date(trade.transactionDate);

  for (const activity of activities) {
    const activityDate = new Date(activity.date);
    const daysDiff = Math.abs(
      (tradeDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Apply time-decayed bonuses
    if (daysDiff <= 7) {
      bonus += activity.type === 'hearing' ? 30 : 25;
    } else if (daysDiff <= 30) {
      bonus += activity.type === 'hearing' ? 15 : 12;
    }
  }

  return {
    baseScore: 0, // From existing committee relevance
    activityBonus: Math.min(bonus, 50), // Cap at +50
    activities
  };
}
```

---

### Option 3: Advanced (Full Integration)

**What:**
- Real-time API checks during analysis
- NLP matching of bill subjects to stock sectors
- Track individual member's hearing attendance
- Timeline visualization

**Benefits:**
- Most accurate
- Catches complex patterns
- Detailed insights

**Challenges:**
- High API usage (could hit rate limits)
- Complex NLP for subject matching
- Requires member-specific tracking
- Much more code to maintain

**Defer This:** Too complex for initial implementation

---

## Data Matching Challenges

### Challenge 1: Bill/Hearing Subjects → Stock Sectors

**Problem:** Congress.gov provides bill subjects (tags) and hearing titles, but they don't map directly to FMP sectors.

**Example:**
- Bill subject: "Banking and financial institutions regulation"
- Stock sector: "Financials"
- Stock industry: "Banks - Regional"

**Solution Options:**

**A. Keyword Matching (Simple)**
```typescript
const SUBJECT_TO_SECTOR: Record<string, string[]> = {
  'banking': ['Financials'],
  'pharmaceutical': ['Healthcare', 'Pharmaceuticals'],
  'telecommunications': ['Telecommunications', 'Technology'],
  'defense': ['Defense', 'Aerospace'],
  // etc.
};

function matchSubjectToSectors(subject: string): string[] {
  const normalized = subject.toLowerCase();
  const matches: string[] = [];

  for (const [keyword, sectors] of Object.entries(SUBJECT_TO_SECTOR)) {
    if (normalized.includes(keyword)) {
      matches.push(...sectors);
    }
  }

  return [...new Set(matches)];
}
```

**B. Use Congress.gov Policy Areas (Better)**
Congress.gov bills have policy area tags that are more structured:
```
GET /v3/bill/{congress}/{type}/{number}
Response includes:
{
  "policyArea": {
    "name": "Finance and Financial Sector"
  }
}
```

These map more cleanly to sectors.

**C. Manual Mapping (Most Accurate)**
Create a curated mapping of common bill titles → sectors based on historical data.

---

### Challenge 2: Rate Limiting

**Problem:** 5,000 requests/hour sounds like a lot, but:
- ~250 committees + subcommittees
- Checking hearings + bills for each
- Could be 500+ requests per analysis run

**Solution:**
1. **Cache aggressively** - Fetch once per day, not per analysis
2. **Batch requests** - Get all hearings in one call when possible
3. **Prioritize** - Only check committees the member actually sits on
4. **Use bulk endpoints** - `/hearing` instead of individual committee calls

**Recommended Strategy:**
```typescript
// Daily background job (not during analysis)
async function dailyCommitteeActivityUpdate() {
  const committeeData = await loadCommitteeData();
  const activityCache = new Map<string, CommitteeActivity[]>();

  // For each committee, fetch recent activity
  for (const committee of committeeData.committees) {
    const activities = await fetchRecentCommitteeActivity(committee.thomas_id);
    activityCache.set(committee.thomas_id, activities);

    // Rate limit: 500ms between requests
    await sleep(500);
  }

  // Save cache
  await saveData('committee-activity-cache.json', {
    fetchedAt: new Date().toISOString(),
    data: Object.fromEntries(activityCache)
  });
}
```

This uses ~250 requests once per day, well under the 5,000/hour limit.

---

## Storage Schema

**New File:** `data/committee-activity-cache.json`

```typescript
interface CommitteeActivityCache {
  fetchedAt: string;  // ISO timestamp
  data: {
    [committeeId: string]: CommitteeActivity[];
  };
}

interface CommitteeActivity {
  committeeId: string;
  date: string;  // ISO date of activity
  type: 'hearing' | 'markup' | 'report' | 'bill_reported';
  title: string;
  description?: string;
  url?: string;  // Link to Congress.gov
  relatedBills?: string[];  // Bill numbers
  subjects?: string[];  // Policy areas or keywords
  inferredSectors?: string[];  // Auto-matched sectors
}
```

**TTL:** 24 hours (refresh daily)

---

## Implementation Phases

### Phase 1: Setup & Basic Fetching
**Tasks:**
1. Get Congress.gov API key
2. Create `src/services/congress-gov-client.ts`
3. Implement basic API calls (hearings, bills)
4. Add caching infrastructure
5. Test API integration

**Deliverable:** Can fetch committee activity and cache it

---

### Phase 2: Matching & Display
**Tasks:**
1. Implement subject → sector matching
2. Add activity checking during scoring
3. Update report formatting to show activity
4. Test with real trade data

**Deliverable:** Reports show "Recent Activity" badges

---

### Phase 3: Scoring Enhancement (Optional)
**Tasks:**
1. Implement activity-based score modifiers
2. Rebalance scoring weights
3. Add configuration options
4. Update documentation

**Deliverable:** Scores reflect timing of trades vs. activity

---

## Configuration Options

Add to analyze command:

```bash
npm start -- analyze --with-committee-activity
npm start -- analyze --activity-window-days 30
npm start -- analyze --no-activity-scoring  # Display only, no score changes
```

---

## Testing Strategy

**Unit Tests:**
- API client mocking
- Subject → sector matching logic
- Date range calculations
- Activity scoring formulas

**Integration Tests:**
- Real API calls (with test key)
- Cache loading/saving
- End-to-end analysis with activity data

**Manual Testing:**
- Find known suspicious trades (e.g., trades right before hearings)
- Verify they get flagged correctly
- Check false positive rate

---

## API Cost/Performance

**Estimated Daily Usage:**
- ~250 committees
- 1 hearing request per committee
- 1 bill request per committee
- **Total:** ~500 requests/day

**Well under the 5,000/hour limit**

**Performance Impact:**
- Daily fetch: ~5 minutes (with 500ms delays)
- Analysis time: Negligible (reading from cache)
- Storage: ~500KB-1MB for activity cache

---

## Example Output (Option 1)

**Before:**
```
📊 JPM - JPMorgan Chase & Co
   Trader: Sherrod Brown (D) (senate)
   Type: Sale | Amount: $50,001 - $100,000
   Date: 2026-01-15
   Score: 42/100
   Factors:
     - Market Cap: $500B (large)
     - Rarity: uncommon (8 total congress trades)
     ⚠️  Committee Relevance: Senate Committee on Banking, Housing, and Urban Affairs
        Sector: Financials | Industry: Banks - Diversified
```

**After:**
```
📊 JPM - JPMorgan Chase & Co
   Trader: Sherrod Brown (D) (senate)
   Type: Sale | Amount: $50,001 - $100,000
   Date: 2026-01-15
   Score: 42/100
   Factors:
     - Market Cap: $500B (large)
     - Rarity: uncommon (8 total congress trades)
     ⚠️  Committee Relevance: Senate Committee on Banking, Housing, and Urban Affairs
        Sector: Financials | Industry: Banks - Diversified
        📅 Recent Activity:
           • Hearing: "Bank Mergers and Competition" (Jan 10, 5 days before trade)
           • Report: "Financial Stability Review 2025" (Jan 8, 7 days before trade)
```

---

## References

- **Congress.gov API Docs:** https://github.com/LibraryOfCongress/api.congress.gov
- **Bill Endpoint Docs:** https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/BillEndpoint.md
- **Committee Endpoint Docs:** https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/CommitteeEndpoint.md
- **Hearing Endpoint Docs:** https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/HearingEndpoint.md

---

## Decision Log

**2026-01-29:** Plan documented for future implementation. Agreed on Option 1 (Simple) as starting point. ProPublica Congress API confirmed discontinued, Congress.gov API is the official replacement.

---

## Next Steps When Ready to Implement

1. Sign up for Congress.gov API key at https://api.data.gov/signup/
2. Review API documentation and rate limits
3. Start with Phase 1 (Setup & Basic Fetching)
4. Test with small dataset first
5. Iterate based on findings
