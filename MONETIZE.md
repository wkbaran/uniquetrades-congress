# Monetization Plan — Congress Trades

## Context

You have a polished, production-grade Congress-trading analyzer that already runs weekly and publishes to S3+CloudFront. The product works; what's missing is a revenue layer. Goal: **$500–2k/month** within 12 months, on **~5 hrs/week**, with **moderate** content effort. That profile rules out VC-scale plays (data licensing, B2B sales) and full-time SaaS, and points squarely at a **freemium-content + paid-newsletter** model layered on top of what you already publish.

This space has validated demand (Quiver Quantitative ~$10/mo, Capitol Trades free-tier, Unusual Whales ~$48/mo, several Substacks), and your scoring engine is a real differentiator vs. the "raw feed" competitors — none of them publish a transparent multi-factor uniqueness score.

---

## Recommended approach: Freemium site + paid newsletter

A two-surface product that reuses your existing weekly pipeline:

### Free tier (lead gen)
- Current S3/CloudFront site stays public and free.
- Add an **email capture** to the index page ("Get the weekly digest"). This is the only required code change.
- Free weekly digest email = a stripped-down version of your existing report (top 10 trades, no commentary).
- Function: SEO + audience funnel. Goal is 2k–5k free subscribers in year 1.

### Paid tier — "Congress Trades Pro" — $10/mo or $96/yr
Bundled via Substack or beehiiv (no custom auth/billing infra):
- **Mid-week update** (Wednesday) with any new high-score trades since Monday.
- **Weekly written commentary** on the top 3–5 trades — 300–500 words, your take on conviction/committee overlap. ~1–2 hrs/week of writing.
- **Member watchlist alerts** — paid subs get email when a flagged member trades (e.g., committee chairs, prolific traders). Reuses your existing scoring + a small filter.
- **CSV export** of the full scored dataset.
- **Archive access** beyond 3 weeks.

Pricing benchmark: Quiver Pro is $10/mo and that's the price point readers in this niche expect. $96/yr gives a ~20% annual discount, standard for newsletters.

**Path to $500–2k/mo:** 50–200 paid subscribers at $10/mo. Realistic via SEO + a moderate Twitter/X presence posting your top weekly trade.

### Secondary revenue (additive, low effort)
- **Affiliate links** to brokerages with congress-trading features (Public.com runs an affiliate program; Autopilot pays per signup). Each report can footer-link "Copy this trade on Public." Expected: $50–300/mo passive once traffic is meaningful.
- **Sponsored slot** in newsletter once you have 1k+ subs. Skip until then.

### Explicitly NOT recommended for your profile
- **Custom SaaS with own auth/billing.** Multi-week build for the same revenue ceiling Substack delivers in a weekend.
- **Data/API licensing.** Real revenue but requires B2B sales motion you don't have time for.
- **Ads on the static site.** Won't hit minimum thresholds at projected traffic; clutters the polished UI.
- **Discord community.** High support burden, doesn't fit 5 hrs/week.

---

## Dependencies / prerequisites

**Legal & compliance (do first, blocks launch):**
- **Re-read FMP terms of service.** Most market-data vendors prohibit redistribution of raw quotes. Your reports show derived/aggregated data (sector, market cap context, scoring) — likely fine, but verify before charging. If FMP forbids it, switch the public-facing data to a redistributable source for displayed fields (Yahoo Finance via yfinance, Polygon's free tier for company info) and keep FMP only for internal scoring inputs.
- **Disclaimer page.** You already have language in the README; promote it to a footer link on every HTML page and the newsletter footer: "Educational, not investment advice. Not a registered investment advisor."
- **Privacy policy + terms** for the email list (CAN-SPAM, GDPR if any EU subs). Substack/beehiiv provide templates.
- **Business entity** — single-member LLC ($50–500 depending on state) recommended once you take payments, but not required to start. Substack will pay you as a sole proprietor.

**Technical prerequisites (small):**
- Email capture form on `index.html` posting to Substack/beehiiv signup endpoint (~30 min).
- A second CLI command that emits the "premium subset" (CSV + member-alert filter) so the paid newsletter has gated content (~3–4 hrs).
- Custom domain on the CloudFront distribution if you don't have one (better trust signal). ACM cert is already in your CloudFormation.
- Optional: simple paywall isn't needed — Substack handles it.

---

## Budget

| Item | Setup | Monthly |
|---|---|---|
| Substack | $0 | 10% rev share (no flat fee) |
| beehiiv (alternative, better for >1k subs) | $0 | $0 free tier → $42 Scale tier at 1k subs → $99 at 10k |
| FMP API | already paid | likely $30–100/mo at current usage; check your tier |
| AWS S3 + CloudFront | already running | ~$5–20/mo (you cited $20–50, will trend low at static traffic) |
| Domain | $12/yr | — |
| LLC formation (optional) | $50–500 one-time | $0–50/mo registered agent |
| Stripe fees (via Substack) | — | bundled in 10% |
| **Total** | **~$100 one-time** | **~$50–150/mo + 10% rev** |

**Break-even:** ~15–20 paid subs covers infra. Everything above that is profit.

**beehiiv vs Substack:** Start on Substack (zero fixed cost, instant). Migrate to beehiiv around 1k free subs — flat fee beats 10% rev share once paid revenue exceeds ~$500/mo, and beehiiv's referral/ad-network tooling is better.

---

## Maintenance & support burden (~5 hrs/week target)

| Activity | Frequency | Time |
|---|---|---|
| Weekly run (already automated) | Mon 7am | 0 (Task Scheduler) |
| Sanity-check the report before publishing | Mon | 15 min |
| Write commentary for paid edition | Mon/Tue | 60–90 min |
| Mid-week update | Wed | 30 min (mostly automated diff) |
| Social post (1 trade highlight on X) | 1–2x/wk | 15 min |
| Customer support (refunds, billing q's) | as needed | ~30 min/wk |
| Bug fixes, FMP schema changes | monthly | 1–2 hrs/mo amortized |
| **Weekly total** | | **~3–4 hrs** |

Headroom of 1–2 hrs/week for occasional feature work, SEO, or a one-off post.

---

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Single-operator dependency** — illness/travel kills the Monday send | High | Medium | Pre-write a "we're off this week" template; free site keeps publishing via Task Scheduler so paid subs aren't dark. Build a 2-week content buffer once you have 50+ paid subs. |
| **FMP API outage or pricing hike** | Medium | High | Graceful degradation: if Monday fetch fails, send prior-week archive link. Aggressive caching already in place. Have Polygon free tier wired as a fallback before launch. |
| **FMP TOS forbids redistribution of derived data** | Medium | Critical (blocker) | Verify in writing before charging. If blocked, switch displayed market-cap/sector fields to a redistributable source (Yahoo via yfinance, Polygon free) and keep FMP for internal scoring only. |
| **Regulatory scrutiny (SEC/FINRA)** as content shifts toward "picks" | Low | High | Keep framing strictly educational. Never use words like "recommend," "buy," "should." Disclaimer on every page and email. If you ever add a model portfolio or alert-to-trade integration, get securities counsel first. |
| **Competitor response** — Quiver/Capitol Trades replicate the uniqueness score | Medium | Medium | Your moat is the *transparent methodology* + commentary voice, not the algorithm. Document the score publicly to build authority; ship sector deep-dives competitors won't bother with. |
| **STOCK Act amendments** — pending bills would ban or reshape congressional trading disclosures | Low–Medium | Existential | Diversify the dataset over year 1: state legislators (followthemoney.org), executive branch (OGE Form 278), Federal Reserve trades. Don't be a single-feed product by month 12. |
| **Newsletter churn / seasonality** — Congress recesses Aug + late Dec; trade volume drops | High | Medium | Annual prepay discount (~$96/yr) front-loads revenue and absorbs slow weeks. During recess weeks, ship retrospectives ("most-traded sectors of summer recess") instead of skipping. |
| **Email deliverability** — financial keywords trigger spam filters | Medium | High | Use Substack/beehiiv (their domain reputation > yours). Authenticate any custom domain (SPF/DKIM/DMARC). Avoid words like "guaranteed returns" in subject lines. |
| **Platform deplatforming** — Substack/beehiiv terminates the account | Low | High | Export the email list weekly; never store it only on the platform. Keep the static site as your owned channel. Beehiiv allows full export; Substack does too. |
| **Tax/payments complexity** — 1099 from Substack, sales tax on digital subs | Certain | Low | Track Substack income separately for Schedule C. US digital-goods sales tax is per-state; Substack does not collect/remit, so monitor thresholds (most states: $100k revenue or 200 transactions before nexus). Revisit at $5k MRR. |
| **Trademark conflict** — "Congress Trades Pro" or similar name in use | Low | Medium | Run a USPTO TESS search before launch (free, 15 min). Domain availability ≠ trademark clearance. |

---

## Critical files to modify (when implementation starts)

- `src/output/index-page.ts` — add email capture form to index HTML.
- `src/output/html.ts` — add footer disclaimer + affiliate links to each report.
- `src/cli.ts` (or wherever commands register) — new `report:premium` command emitting CSV + filtered alerts JSON.
- `run-and-publish.ps1` — extend to also POST the premium content to Substack/beehiiv via their API, or to email it via a hook.
- `README.md` — productize: turn the educational framing into landing-page copy.

Do **not** rebuild the publishing pipeline; the existing S3+CloudFront setup is well-suited for the free tier as-is.

---

## Verification (how you'll know it's working)

- **Month 1:** site has email capture; 50+ free signups; legal pages live; FMP TOS confirmed.
- **Month 3:** Substack live; first 10 paid subs (friends + early SEO); $100 MRR.
- **Month 6:** 500 free / 50 paid subs; $500 MRR; covering all infra cost.
- **Month 12:** 2k free / 100–200 paid; $1k–2k MRR; target hit.

Leading indicators to watch weekly: free-list growth rate, free→paid conversion (target 3–8%), unsubscribe rate (<0.5% per send is healthy).

---

## Optional 12-month-plus expansions (only if hitting targets)

- Sector-specific sub-newsletters (Healthcare Congress Trades, etc.) — easy fork of your scoring with a sector filter.
- Public API at $50–200/mo for retail quants — only worth building once you have 200+ paid newsletter subs validating demand.
- Annual deep-dive PDF report ("Year in Congressional Trading") sold for $50–100, written once, sold all year.
