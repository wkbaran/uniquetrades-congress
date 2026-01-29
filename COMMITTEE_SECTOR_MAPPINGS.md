# Committee-to-Sector Mapping Rationale

This document explains the logic behind mapping congressional committees to market sectors and industries. These mappings are used to identify when members trade stocks in sectors where their committees have jurisdiction or oversight authority.

## Mapping Philosophy

**Core Principle:** A committee is mapped to a sector if the committee has **legislative jurisdiction, oversight authority, or budgetary control** over companies in that sector.

**Three Types of Relevance:**
1. **Direct Jurisdiction** - Committee writes laws that directly regulate the sector
2. **Oversight Authority** - Committee holds hearings and investigations affecting the sector
3. **Budgetary Control** - Committee controls funding that impacts the sector (mainly Appropriations)

**Conservative Approach:** Mappings err on the side of flagging potential relevance. It's better to flag a trade for review than to miss a potential oversight concern.

---

## Senate Committee Mappings

### SSAF - Agriculture, Nutrition, and Forestry
**Sectors:** `Agriculture`, `Consumer Staples`

**Rationale:**
- **Direct Jurisdiction:** Farm bills, agricultural subsidies, crop insurance
- **Oversight:** USDA, FDA food safety regulations
- **Impact:** Agricultural companies (ADM, Bunge), food processors (General Mills, Kraft)
- **Budget:** Farm subsidies, food assistance programs

---

### SSAP - Appropriations
**Sectors:** `Defense`, `Healthcare`, `Energy`, `Transportation`, `Aerospace`

**Rationale:**
- **Budgetary Control:** Controls discretionary spending for entire federal government
- **Impact:** Defense contractors (Lockheed, Raytheon), healthcare (NIH funding), energy (DOE), transportation (infrastructure)
- **Unique Position:** Can influence any company receiving federal contracts or grants
- **Note:** One of the broadest mappings due to comprehensive budgetary authority

---

### SSAS - Armed Services
**Sectors:** `Defense`, `Aerospace`, `Cybersecurity`

**Rationale:**
- **Direct Jurisdiction:** Department of Defense authorization, military procurement
- **Oversight:** Pentagon operations, defense contractors
- **Impact:** Major defense primes (Boeing, Lockheed Martin, Northrop Grumman, Raytheon)
- **Budget:** Defense spending authorization (~$800B annually)
- **Cybersecurity:** Military cyber operations, defense contractor security requirements

---

### SSBK - Banking, Housing, and Urban Affairs
**Sectors:** `Financials`, `Real Estate`, `Cryptocurrency`

**Rationale:**
- **Direct Jurisdiction:** Banking regulation, securities law, housing policy
- **Oversight:** Federal Reserve, SEC, FDIC, CFTC, HUD
- **Impact:**
  - Banks (JPMorgan, Bank of America)
  - Insurance (AIG, MetLife)
  - REITs (real estate investment trusts)
  - Crypto exchanges (Coinbase)
- **Key Issues:** Bank capital requirements, crypto regulation, GSEs (Fannie/Freddie)

---

### SSBU - Budget
**Sectors:** `Financials`

**Rationale:**
- **Direct Jurisdiction:** Federal budget resolution, deficit policy
- **Oversight:** CBO, federal spending levels
- **Impact:** Fiscal policy affects financial markets broadly
- **Note:** More indirect than other committees, focuses on macroeconomic policy

---

### SSCM - Commerce, Science, and Transportation
**Sectors:** `Technology`, `Telecommunications`, `Transportation`, `Aerospace`, `Cybersecurity`

**Rationale:**
- **Direct Jurisdiction:** Interstate commerce, telecom regulation, transportation safety, space policy
- **Oversight:** FCC, FTC, FAA, NASA, NIST
- **Impact:**
  - Tech: Internet regulation, data privacy, Section 230
  - Telecom: Spectrum auctions, net neutrality, carrier mergers (AT&T, Verizon)
  - Transportation: Airlines (Delta, United), railroads, shipping
  - Aerospace: Commercial space (SpaceX, Blue Origin), aviation (Boeing)
- **Cybersecurity:** NIST cybersecurity standards, private sector cyber coordination

---

### SSEG - Energy and Natural Resources
**Sectors:** `Energy`, `Materials`, `Utilities`

**Rationale:**
- **Direct Jurisdiction:** Energy policy, federal lands, mining, public utilities
- **Oversight:** DOE, BLM, Forest Service, national parks
- **Impact:**
  - Energy: Oil/gas companies (ExxonMobil, Chevron), renewables (NextEra Energy)
  - Materials: Mining companies, timber, minerals
  - Utilities: Electric utilities on federal lands or interstate projects
- **Key Issues:** Fossil fuel leasing, renewable energy incentives, pipeline approvals

---

### SSEV - Environment and Public Works
**Sectors:** `Industrials`, `Materials`, `Utilities`, `Transportation`

**Rationale:**
- **Direct Jurisdiction:** Environmental law (Clean Air Act, Clean Water Act), highways, infrastructure
- **Oversight:** EPA, Army Corps of Engineers
- **Impact:**
  - Industrials: Manufacturing subject to EPA regulations
  - Materials: Chemical companies (Dow, DuPont), cement, construction materials
  - Utilities: Water/wastewater utilities, regulated emissions
  - Transportation: Highway construction, public transit infrastructure
- **Key Issues:** Pollution controls, infrastructure spending, climate regulations

---

### SSFI - Finance
**Sectors:** `Financials`

**Rationale:**
- **Direct Jurisdiction:** Tax policy, tariffs, trade, Medicare/Social Security financing
- **Oversight:** IRS, Treasury Department, international trade
- **Impact:** Tax law affects all sectors but especially financial services
- **Key Issues:** Corporate tax rates, tax incentives, trade agreements

---

### SSGA - Homeland Security and Governmental Affairs
**Sectors:** `Technology`, `Cybersecurity`

**Rationale:**
- **Direct Jurisdiction:** Homeland security, federal IT systems, cybersecurity policy
- **Oversight:** DHS, CISA, federal procurement
- **Impact:**
  - Cybersecurity firms (Palo Alto Networks, CrowdStrike)
  - Government IT contractors (Palantir, Leidos)
- **Key Issues:** Critical infrastructure protection, supply chain security, federal IT modernization

---

### SSHR - Health, Education, Labor, and Pensions
**Sectors:** `Healthcare`, `Pharmaceuticals`, `Biotechnology`

**Rationale:**
- **Direct Jurisdiction:** Healthcare policy, FDA, drug pricing, medical research
- **Oversight:** FDA, NIH, CDC, CMS (Medicare/Medicaid)
- **Impact:**
  - Pharmaceuticals: Drug manufacturers (Pfizer, Merck, J&J)
  - Biotechnology: Biotech companies (Moderna, Regeneron)
  - Healthcare: Hospitals, insurance (UnitedHealth, Cigna)
- **Key Issues:** Drug approval process, pricing negotiations, research funding, ACA

---

### SSIA - Intelligence
**Sectors:** `Technology`, `Cybersecurity`, `Defense`

**Rationale:**
- **Direct Jurisdiction:** Intelligence agencies, signals intelligence, cyber warfare
- **Oversight:** CIA, NSA, DIA, intelligence contractors
- **Impact:**
  - Defense contractors with intelligence contracts (Booz Allen, SAIC)
  - Cybersecurity firms working with intelligence community
  - Tech companies cooperating with surveillance programs
- **Key Issues:** Data collection authorities, encryption policy, contractor oversight

---

### SSJU - Judiciary
**Sectors:** `Technology`, `Telecommunications`

**Rationale:**
- **Direct Jurisdiction:** Antitrust law, intellectual property, privacy law, civil rights
- **Oversight:** DOJ Antitrust Division, FTC, federal courts, FBI
- **Impact:**
  - Tech: Big tech antitrust (Google, Meta, Amazon, Apple)
  - Telecommunications: Merger reviews (T-Mobile/Sprint)
  - Content platforms: Section 230, content moderation policy
- **Key Issues:**
  - Antitrust enforcement and breakup proposals
  - Copyright/patent law affecting software and content
  - Privacy legislation (GDPR-equivalent proposals)
  - Platform liability and speech regulation
  - Data protection and biometric privacy

---

### SSRA - Rules and Administration
**Sectors:** `Financials`

**Rationale:**
- **Direct Jurisdiction:** Senate rules, federal elections, campaign finance
- **Oversight:** FEC, Library of Congress
- **Impact:** Campaign finance law affects political spending (minimal direct sector impact)
- **Note:** Weakest mapping, mainly procedural committee

---

### SSSB - Small Business and Entrepreneurship
**Sectors:** `Financials`, `Consumer Discretionary`

**Rationale:**
- **Direct Jurisdiction:** Small business policy, SBA oversight
- **Oversight:** Small Business Administration, small business lending
- **Impact:**
  - Small business lenders
  - Startup ecosystem policies
- **Note:** Broad but indirect impact across sectors

---

### SSVA - Veterans' Affairs
**Sectors:** `Healthcare`, `Pharmaceuticals`

**Rationale:**
- **Direct Jurisdiction:** Veterans healthcare (VA system)
- **Oversight:** Department of Veterans Affairs, VA hospitals
- **Impact:** Healthcare providers contracting with VA, pharmaceutical companies selling to VA
- **Budget:** VA healthcare budget (~$100B+)

---

## House Committee Mappings

### HSAG - Agriculture
**Sectors:** `Agriculture`, `Consumer Staples`

**Rationale:** Same as Senate Agriculture (SSAF)
- Farm policy, USDA oversight, food safety, crop insurance

---

### HSAP - Appropriations
**Sectors:** `Defense`, `Energy`, `Healthcare`, `Transportation`

**Rationale:** Same as Senate Appropriations (SSAP)
- Controls discretionary spending, impacts all sectors receiving federal funding

---

### HSAS - Armed Services
**Sectors:** `Defense`, `Aerospace`, `Cybersecurity`

**Rationale:** Same as Senate Armed Services (SSAS)
- Defense authorization, military procurement, defense contractors

---

### HSBU - Budget
**Sectors:** `Financials`

**Rationale:** Same as Senate Budget (SSBU)
- Federal budget resolution, macroeconomic policy

---

### HSED - Education and the Workforce
**Sectors:** `Healthcare`, `Consumer Discretionary`

**Rationale:**
- **Direct Jurisdiction:** Education policy, labor law, worker protections, pensions
- **Oversight:** Department of Education, NLRB, ERISA (pension regulation)
- **Impact:**
  - Education companies (Pearson, Chegg)
  - Companies with large workforces (labor law)
  - Healthcare via ERISA (employer health plans)
  - Consumer Discretionary via minimum wage impact
- **Key Issues:** Student loans, pension fund regulation, labor relations

---

### HSIF - Energy and Commerce
**Sectors:** `Energy`, `Healthcare`, `Telecommunications`, `Technology`

**Rationale:**
- **Direct Jurisdiction:** Energy policy, healthcare, communications, internet, consumer protection
- **Oversight:** DOE, FCC, FDA, FTC, EPA (shared)
- **Impact:**
  - Energy: Utilities, oil/gas, renewables
  - Healthcare: Drug approval, health insurance
  - Telecom/Tech: Internet regulation, data privacy, spectrum
- **Note:** Extremely broad jurisdiction, one of House's most powerful committees
- **Key Issues:** Net neutrality, drug pricing, energy grid, data privacy

---

### HSHA - House Administration
**Sectors:** `Financials`

**Rationale:** Same as Senate Rules (SSRA)
- House operations, campaign finance (minimal sector impact)

---

### HSFA - Foreign Affairs
**Sectors:** `Defense`, `Aerospace`

**Rationale:**
- **Direct Jurisdiction:** Foreign policy, international relations, foreign aid
- **Oversight:** State Department, USAID, foreign military sales
- **Impact:**
  - Defense: Foreign military sales (FMS) of weapons systems
  - Aerospace: Export controls on aircraft/satellites
- **Key Issues:** Arms sales approvals, export controls, sanctions

---

### HSGO - Oversight and Accountability
**Sectors:** `Technology`, `Cybersecurity`

**Rationale:**
- **Direct Jurisdiction:** Federal government operations, IT systems, procurement
- **Oversight:** All federal agencies, contracting, cybersecurity
- **Impact:**
  - Government IT contractors
  - Cybersecurity firms
  - Federal cloud providers (AWS, Azure, Google Cloud)
- **Key Issues:** Data breaches, federal IT security, procurement fraud

---

### HSHM - Homeland Security
**Sectors:** `Cybersecurity`, `Defense`, `Transportation`

**Rationale:** Same as Senate Homeland Security (SSGA)
- DHS oversight, border security, TSA, CISA, critical infrastructure
- Cybersecurity contractors, defense technology, transportation security

---

### HSJU - Judiciary
**Sectors:** `Technology`, `Telecommunications`

**Rationale:** Same as Senate Judiciary (SSJU)
- Antitrust, intellectual property, privacy, content moderation, Section 230

---

### HSPW - Transportation and Infrastructure
**Sectors:** `Transportation`, `Industrials`, `Real Estate`

**Rationale:**
- **Direct Jurisdiction:** Surface transportation, aviation, water infrastructure, federal buildings
- **Oversight:** DOT, FAA, Coast Guard, Army Corps of Engineers
- **Impact:**
  - Transportation: Airlines, railroads, trucking, shipping
  - Industrials: Construction companies, engineering firms
  - Real Estate: Federal building leases, infrastructure projects
- **Key Issues:** Highway funding, aviation safety, infrastructure bills

---

### HSBA - Financial Services
**Sectors:** `Financials`, `Real Estate`, `Cryptocurrency`

**Rationale:** Same as Senate Banking (SSBK)
- Banking regulation, securities, housing, insurance, crypto
- Fed, SEC, FDIC, FTC oversight

---

### HLIG - Intelligence
**Sectors:** `Technology`, `Cybersecurity`, `Defense`

**Rationale:** Same as Senate Intelligence (SSIA)
- Intelligence agencies, NSA, CIA, surveillance, intelligence contractors

---

### HSII - Natural Resources
**Sectors:** `Energy`, `Materials`, `Agriculture`

**Rationale:** Similar to Senate Energy and Natural Resources (SSEG)
- Public lands, mining, forestry, national parks, tribal affairs
- Energy leasing, mining permits, timber

---

### HSRU - Rules
**Sectors:** `Financials`

**Rationale:** Same as Senate Rules (SSRA)
- House procedures, minimal sector impact

---

### HSSM - Small Business
**Sectors:** `Financials`, `Consumer Discretionary`

**Rationale:** Same as Senate Small Business (SSSB)
- Small business policy, SBA oversight

---

### HSSY - Science, Space, and Technology
**Sectors:** `Technology`, `Aerospace`, `Cybersecurity`

**Rationale:**
- **Direct Jurisdiction:** Scientific research, space exploration, technology R&D
- **Oversight:** NASA, NSF, NIST, DOE labs, NOAA
- **Impact:**
  - Aerospace: Commercial space (SpaceX, Blue Origin), satellite companies
  - Technology: Research funding, tech standards, quantum computing
  - Cybersecurity: NIST cybersecurity framework
- **Key Issues:** NASA funding, research grants, tech competitiveness, space policy

---

### HSVR - Veterans' Affairs
**Sectors:** `Healthcare`, `Pharmaceuticals`

**Rationale:** Same as Senate Veterans' Affairs (SSVA)
- VA healthcare system, veterans benefits

---

### HSWM - Ways and Means
**Sectors:** `Financials`, `Healthcare`

**Rationale:** Same as Senate Finance (SSFI)
- Tax policy, trade, Medicare/Medicaid
- Impact on financial sector via tax law, healthcare via entitlement programs

---

## Industry-Level Mappings

In addition to broad sector mappings, the system matches committee jurisdiction to specific industries within sectors:

### Examples:

**Judiciary → Internet Content & Information**
- Section 230 liability
- Content moderation regulation
- Antitrust (Google, Meta)

**Armed Services → Aerospace & Defense**
- Defense procurement
- Military aircraft contracts

**Energy and Commerce → Biotechnology**
- FDA drug approval
- Clinical trial regulation

**Agriculture → Food Distribution**
- USDA oversight
- Food safety regulation

---

## Special Cases & Notes

### Broad Committees
**Appropriations** (both chambers) has the widest mapping because it controls funding across government. A member on Appropriations could influence nearly any sector through budget decisions.

**Energy and Commerce** (House) and **Commerce, Science, and Transportation** (Senate) have very broad jurisdiction over modern economy sectors (tech, telecom, healthcare).

### Overlapping Jurisdiction
Many sectors fall under multiple committees:
- **Healthcare:** HELP/Education, Finance/Ways and Means (Medicare), Appropriations (NIH)
- **Technology:** Commerce, Judiciary, Homeland Security, Intelligence
- **Defense:** Armed Services (authorization), Appropriations (funding)

This is intentional - it reflects the reality that multiple committees can influence the same companies.

### Excluded Mappings
Some sectors are intentionally not mapped to any committee:
- **Media** - While Judiciary and Commerce have some oversight (FCC), traditional media companies receive minimal regulatory focus
- **Luxury Goods** - No specific committee oversight
- **Gaming/Gambling** - State-level regulation primarily

### Dynamic Matching
Beyond static mappings, the system uses **keyword matching** to catch edge cases:
- Committee name contains "technology" → Technology sector
- Committee name contains "health" → Healthcare sector
- Etc.

This ensures even obscure subcommittees get appropriate mappings.

---

## Maintenance & Updates

**When to Update Mappings:**
1. **Committee Jurisdiction Changes** - Rare but happens (e.g., Homeland Security created after 9/11)
2. **New Sectors Emerge** - Cryptocurrency added recently
3. **Regulatory Changes** - New agencies or major policy shifts
4. **Feedback** - If analysis consistently mis-flags or under-flags trades

**Review Schedule:**
- **Annually** - Review all mappings for accuracy
- **After Elections** - Committee structures sometimes reorganize
- **Ad Hoc** - When specific trades seem incorrectly flagged or missed

---

## File Location

The actual mappings are implemented in:
```
/src/mappings/committee-sectors.ts
```

This document explains the **why**, while that file contains the **what**.
