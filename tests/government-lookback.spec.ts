import { test, expect } from "@playwright/test";
import { lookbackSince, houseIndexYears, LOOKBACK_DAYS } from "../src/data/government-provider.js";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("lookback widens a recent incremental start date to the fixed window", () => {
  // Incremental watermark is 2026-08-27, but a filing indexed late with an
  // earlier filing date must still be picked up.
  const since = lookbackSince(new Date(2026, 7, 27), new Date(2026, 8, 13, 7, 0));
  expect(LOOKBACK_DAYS).toBe(30);
  expect(ymd(since)).toBe("2026-08-14");
});

test("an incremental start date older than the window is kept as-is", () => {
  const catchUp = new Date(2026, 3, 8); // e.g. Senate catching up after an outage
  expect(lookbackSince(catchUp, new Date(2026, 8, 13))).toBe(catchUp);
});

test("early-January lookback spans last year's House index", () => {
  const now = new Date(2027, 0, 10);
  const since = lookbackSince(new Date(2027, 0, 9), now);
  expect(ymd(since)).toBe("2026-12-11");
  expect(houseIndexYears(since, now)).toEqual([2026, 2027]);
});

test("mid-year lookback needs only the current House index", () => {
  const now = new Date(2026, 8, 13);
  expect(houseIndexYears(lookbackSince(new Date(2026, 7, 27), now), now)).toEqual([2026]);
});
