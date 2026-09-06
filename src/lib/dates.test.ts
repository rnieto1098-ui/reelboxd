import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTimeLeft } from "./dates.ts";

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
