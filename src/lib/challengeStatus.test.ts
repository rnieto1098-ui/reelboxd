import { test } from "node:test";
import assert from "node:assert/strict";
import { challengeStatus, goalPace, isReleased } from "./challengeStatus.ts";

const now = new Date("2026-07-02T12:00:00.000Z");

test("a met target is complete, even after a date range has closed", () => {
  assert.equal(challengeStatus({ type: "GENRE", percent: 100, endDate: null }, now), "complete");
  assert.equal(
    challengeStatus(
      { type: "TIMEFRAME", percent: 100, endDate: new Date("2026-06-01T00:00:00.000Z") },
      now
    ),
    "complete"
  );
});

test("a date range that closed short of its target has ended", () => {
  assert.equal(
    challengeStatus(
      { type: "TIMEFRAME", percent: 60, endDate: new Date("2026-06-30T23:59:59.999Z") },
      now
    ),
    "ended"
  );
});

test("anything else is still active", () => {
  assert.equal(challengeStatus({ type: "GENRE", percent: 40, endDate: null }, now), "active");
  assert.equal(challengeStatus({ type: "CREW", percent: null, endDate: null }, now), "active");
  assert.equal(
    challengeStatus(
      { type: "TIMEFRAME", percent: 10, endDate: new Date("2026-08-01T00:00:00.000Z") },
      now
    ),
    "active"
  );
});

test("isReleased treats today as released and blanks as unreleased", () => {
  assert.equal(isReleased("2026-07-02", "2026-07-02"), true);
  assert.equal(isReleased("2014-11-05", "2026-07-02"), true);
  assert.equal(isReleased("2027-01-01", "2026-07-02"), false);
  assert.equal(isReleased("", "2026-07-02"), false);
  assert.equal(isReleased(null, "2026-07-02"), false);
  assert.equal(isReleased(undefined, "2026-07-02"), false);
});

test("goalPace reports standing against an even pace and the rate to finish", () => {
  // 2 July is half way through the year: 50 of 100 expected.
  assert.equal(
    goalPace({ year: 2026, target: 100, count: 60 }, now),
    "40 to go, 10 ahead of pace. Finishing takes about 2 a week."
  );
  assert.equal(
    goalPace({ year: 2026, target: 100, count: 30 }, now),
    "70 to go, 20 behind pace. Finishing takes about 3 a week."
  );
  assert.equal(
    goalPace({ year: 2026, target: 100, count: 50 }, now),
    "50 to go, right on pace. Finishing takes about 2 a week."
  );
});

test("goalPace switches to days-per-film when under one a week is needed", () => {
  assert.equal(
    goalPace({ year: 2026, target: 12, count: 8 }, now),
    "4 to go, 2 ahead of pace. Finishing takes about one every 46 days."
  );
});

test("goalPace has nothing to say without a goal or for another year", () => {
  assert.equal(goalPace({ year: 2026, target: null, count: 5 }, now), null);
  assert.equal(goalPace({ year: 2025, target: 50, count: 5 }, now), null);
  assert.equal(
    goalPace({ year: 2026, target: 50, count: 50 }, now),
    "Goal reached. Everything from here is a bonus."
  );
});
