/**
 * SIC → FMP-style sector translation
 *
 * Maps 4-digit SIC codes to the sector vocabulary used in
 * committee-sector-taxonomy.ts so committee-overlap scoring works
 * without FMP's /stable/profile endpoint.
 *
 * Sector names must exactly match the strings in committee-sector-taxonomy.ts:
 *   Basic Materials, Communication Services, Consumer Cyclical,
 *   Consumer Defensive, Energy, Financial Services, Healthcare,
 *   Industrials, Real Estate, Technology, Utilities
 */

export function sicToSector(sic: number): string | null {
  // Agriculture, Forestry, Fishing (0100–0999)
  if (sic >= 100 && sic <= 999) return "Consumer Defensive";

  // Mining (1000–1499)
  if (sic >= 1000 && sic <= 1099) return "Basic Materials";   // Metal mining
  if (sic >= 1300 && sic <= 1399) return "Energy";             // Oil & gas
  if (sic >= 1400 && sic <= 1499) return "Basic Materials";   // Non-metallic minerals

  // Construction (1500–1799)
  if (sic >= 1500 && sic <= 1799) return "Industrials";

  // Manufacturing (2000–3999)
  if (sic >= 2000 && sic <= 2199) return "Consumer Defensive"; // Food, tobacco
  if (sic >= 2200 && sic <= 2399) return "Consumer Cyclical";  // Textiles, apparel
  if (sic >= 2400 && sic <= 2599) return "Industrials";        // Wood, furniture
  if (sic >= 2600 && sic <= 2699) return "Basic Materials";   // Paper
  if (sic >= 2700 && sic <= 2799) return "Communication Services"; // Printing, publishing
  if (sic >= 2800 && sic <= 2829) return "Basic Materials";   // Industrial chemicals
  if (sic >= 2830 && sic <= 2836) return "Healthcare";         // Pharma, biotech
  if (sic >= 2840 && sic <= 2899) return "Consumer Defensive"; // Soap, cleaners
  if (sic >= 2900 && sic <= 2999) return "Energy";             // Petroleum refining
  if (sic >= 3000 && sic <= 3299) return "Basic Materials";   // Rubber, plastics, glass, metals
  if (sic >= 3300 && sic <= 3499) return "Industrials";        // Primary & fabricated metals
  if (sic >= 3500 && sic <= 3599) return "Industrials";        // Industrial machinery
  if (sic >= 3600 && sic <= 3699) return "Technology";         // Electronic equipment
  if (sic >= 3700 && sic <= 3711) return "Consumer Cyclical";  // Motor vehicles
  if (sic >= 3720 && sic <= 3812) return "Industrials";        // Aircraft, ships, defense
  if (sic >= 3813 && sic <= 3851) return "Healthcare";         // Medical instruments, devices
  if (sic >= 3852 && sic <= 3899) return "Technology";         // Optical, photo instruments
  if (sic >= 3900 && sic <= 3999) return "Industrials";        // Misc manufacturing

  // Transportation & Public Utilities (4000–4999)
  if (sic >= 4000 && sic <= 4799) return "Industrials";        // Transportation
  if (sic >= 4800 && sic <= 4899) return "Communication Services"; // Telecom, broadcasting
  if (sic >= 4900 && sic <= 4999) return "Utilities";          // Electric, gas, water

  // Wholesale Trade (5000–5199)
  if (sic >= 5000 && sic <= 5199) return "Industrials";

  // Retail Trade (5200–5999)
  if (sic >= 5300 && sic <= 5399) return "Consumer Defensive"; // General merchandise
  if (sic >= 5400 && sic <= 5499) return "Consumer Defensive"; // Food stores
  if (sic >= 5200 && sic <= 5299) return "Consumer Cyclical";  // Building materials retail
  if (sic >= 5500 && sic <= 5999) return "Consumer Cyclical";  // Auto, apparel, misc retail

  // Finance, Insurance, Real Estate (6000–6799)
  if (sic >= 6000 && sic <= 6499) return "Financial Services"; // Banking, credit, insurance
  if (sic >= 6500 && sic <= 6599) return "Real Estate";
  if (sic >= 6700 && sic <= 6799) return "Financial Services"; // Holding & investment offices

  // Services (7000–8999)
  if (sic >= 7000 && sic <= 7099) return "Consumer Cyclical";  // Hotels, lodging
  if (sic >= 7200 && sic <= 7299) return "Consumer Cyclical";  // Personal services
  if (sic >= 7300 && sic <= 7374) return "Technology";          // Computer & data services
  if (sic >= 7375 && sic <= 7389) return "Industrials";        // Misc business services
  if (sic >= 7500 && sic <= 7699) return "Consumer Cyclical";  // Auto & misc repair
  if (sic >= 7800 && sic <= 7999) return "Communication Services"; // Entertainment, recreation
  if (sic >= 8000 && sic <= 8099) return "Healthcare";         // Health services
  if (sic >= 8100 && sic <= 8199) return "Financial Services"; // Legal services
  if (sic >= 8200 && sic <= 8299) return "Consumer Defensive"; // Educational services
  if (sic >= 8300 && sic <= 8399) return "Healthcare";         // Social services
  if (sic >= 8700 && sic <= 8799) return "Industrials";        // Engineering, management consulting

  // Public Administration (9100–9999) — no equity sector
  return null;
}
