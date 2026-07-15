import { test, expect } from "@playwright/test";
import { splitMemberName } from "../src/data/government-provider.js";

// splitMemberName is only ever a fallback -- both scrapers prefer a source's
// own pre-split first/last fields -- but real PTR filings hit this fallback
// often enough (whenever the PDF's header text is used) that its handling of
// generational suffixes matters. A naive "last token = surname" split was
// silently discarding the real surname for every one of these real members.

test("keeps a plain two-part name intact", () => {
  expect(splitMemberName("William Keating")).toEqual({ firstName: "William", lastName: "Keating" });
});

test("keeps a middle initial without treating it as the surname", () => {
  expect(splitMemberName("William R. Keating")).toEqual({ firstName: "William", lastName: "Keating" });
});

test("strips a trailing 'III' rather than treating it as the surname", () => {
  expect(splitMemberName("Rudy Yakym III")).toEqual({ firstName: "Rudy", lastName: "Yakym" });
});

test("strips a trailing 'Jr.' rather than treating it as the surname", () => {
  expect(splitMemberName("Donald Sternoff Beyer Jr.")).toEqual({ firstName: "Donald", lastName: "Beyer" });
});

test("strips a trailing 'II' rather than treating it as the surname", () => {
  expect(splitMemberName("August Lee Pfluger II")).toEqual({ firstName: "August", lastName: "Pfluger" });
});

test("strips a leading 'Hon.' honorific", () => {
  expect(splitMemberName("Hon. Nancy Pelosi")).toEqual({ firstName: "Nancy", lastName: "Pelosi" });
});
