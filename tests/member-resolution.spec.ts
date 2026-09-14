import { test, expect } from "@playwright/test";
import { resolveLegislator } from "../src/services/committee-service.js";
import type { Legislator } from "../src/types/index.js";

const term = { type: "rep", start: "2025-01-03", end: "2027-01-03", state: "CA", party: "Democrat" };
const legislator = (bioguide: string, first: string, last: string, extra: Record<string, string> = {}) =>
  ({ id: { bioguide }, name: { first, last, ...extra }, terms: [term] }) as unknown as Legislator;

const legislators = [
  legislator("K000389", "Ro", "Khanna", { official_full: "Ro Khanna" }),
  legislator("L000590", "Susie", "Lee"),
  legislator("L000597", "Laurel", "Lee"),
];

test("a filer's full given name resolves to the legislator's short name", () => {
  // Rohit Khanna's scanned PTRs were OCR'd under "Rohit"; without this his trades had no party or member page
  expect(resolveLegislator("Rohit", "Khanna", legislators)?.id.bioguide).toBe("K000389");
  expect(resolveLegislator("Ro", "Khanna", legislators)?.id.bioguide).toBe("K000389");
});

test("different people who share a last name stay separate", () => {
  expect(resolveLegislator("Susie", "Lee", legislators)?.id.bioguide).toBe("L000590");
  expect(resolveLegislator("Laurel", "Lee", legislators)?.id.bioguide).toBe("L000597");
  expect(resolveLegislator("Robert", "Lee", legislators)).toBeNull();
});
