import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTimeLeft, parseYearParam, yearBounds } from "./dates.ts";

const now = new Date("2026-06-15T12:00:00.000Z");

test("shows 'Time's up' once the deadline has passed", () => {
  assert.equal(formatTimeLeft(new Date("2026-06-15T00:00:00.000Z"), now), "Time's up");
  assert.equal(formatTimeLeft(new Date("2026-06-01T00:00:00.000Z"), now), "Time's up");
});

test("singular vs plural day count just under two weeks out", () => {
  assert.equal(formatTimeLeft(new Date("2026-06-16T12:00:00.000Z"), now), "1 day left");
  assert.equal(formatTimeLeft(new Date("2026-06-20T12:00:00.000Z"), now), "5 days left");
});

test("switches to weeks between two and eight weeks out", () => {
  assert.equal(formatTimeLeft(new Date("2026-06-30T12:00:00.000Z"), now), "2 weeks left");
  assert.equal(formatTimeLeft(new Date("2026-08-01T12:00:00.000Z"), now), "7 weeks left");
});

test("switches to months beyond that", () => {
  assert.equal(formatTimeLeft(new Date("2026-08-20T12:00:00.000Z"), now), "2 months left");
});

// Regression coverage for the `?year=` parsing bug: both the diary and Year
// in Review pages validated with Number.isFinite, which accepts a fractional
// year that then crashes the page inside Prisma (WatchGoal.year is an Int)
// or produces an unparseable date string in yearBounds.
test("a plain four-digit year parses", () => {
  assert.equal(parseYearParam("2026"), 2026);
  assert.equal(parseYearParam("1998"), 1998);
});

test("a fractional year is rejected, not silently accepted", () => {
  assert.equal(parseYearParam("1.5"), null);
  assert.equal(parseYearParam("2026.5"), null);
});

test("integers outside the browsable range are rejected", () => {
  assert.equal(parseYearParam("1e21"), null);
  assert.equal(parseYearParam("1899"), null);
  assert.equal(parseYearParam("2101"), null);
  assert.equal(parseYearParam("-2026"), null);
});

test("range endpoints are inclusive", () => {
  assert.equal(parseYearParam("1900"), 1900);
  assert.equal(parseYearParam("2100"), 2100);
});

test("missing, blank, and non-numeric params read as no year", () => {
  assert.equal(parseYearParam(undefined), null);
  assert.equal(parseYearParam(null), null);
  assert.equal(parseYearParam(""), null);
  assert.equal(parseYearParam("   "), null);
  assert.equal(parseYearParam("abc"), null);
  // An array is what Next hands back for a repeated ?year=&year= param.
  assert.equal(parseYearParam(["2026"]), null);
});

test("yearBounds on a parsed year always produces valid dates", () => {
  for (const input of ["1900", "2026", "2100"]) {
    const year = parseYearParam(input) as number;
    const { start, end } = yearBounds(year);
    assert.ok(!Number.isNaN(start.getTime()), `start valid for ${input}`);
    assert.ok(!Number.isNaN(end.getTime()), `end valid for ${input}`);
  }
});
