import { test } from "node:test";
import assert from "node:assert/strict";
import { hasStreamingAvailability, isAvailableOnServices } from "./streamingAvailability.ts";

test("hasStreamingAvailability is false with no services and nothing owned", () => {
  assert.equal(hasStreamingAvailability(new Set(), new Set()), false);
});

test("hasStreamingAvailability is true with services configured", () => {
  assert.equal(hasStreamingAvailability(new Set([8]), new Set()), true);
});

test("hasStreamingAvailability is true from owned movies alone, no services needed", () => {
  assert.equal(hasStreamingAvailability(new Set(), new Set([550])), true);
});

test("isAvailableOnServices is true when a provider overlaps the user's set", () => {
  const providers = [{ provider_id: 8 }, { provider_id: 337 }];
  assert.equal(isAvailableOnServices(providers, new Set([337])), true);
});

test("isAvailableOnServices is false when no provider overlaps", () => {
  const providers = [{ provider_id: 8 }, { provider_id: 337 }];
  assert.equal(isAvailableOnServices(providers, new Set([1899])), false);
});

test("isAvailableOnServices is false for an empty provider list", () => {
  assert.equal(isAvailableOnServices([], new Set([8])), false);
});
