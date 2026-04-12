import { test } from "node:test";
import assert from "node:assert/strict";
import { now, newId } from "./helpers.js";

test("now returns valid ISO 8601 string", () => {
  const ts = now();
  const parsed = new Date(ts);
  assert.ok(!isNaN(parsed.getTime()), "should parse as valid date");
  assert.ok(ts.endsWith("Z"), "should end with Z (UTC)");
});

test("now returns timestamp close to current time", () => {
  const before = Date.now();
  const ts = now();
  const after = Date.now();
  const parsed = new Date(ts).getTime();
  assert.ok(parsed >= before - 1000, "timestamp should be near current time");
  assert.ok(parsed <= after + 1000, "timestamp should be near current time");
});

test("newId returns valid UUID v4 format", () => {
  const id = newId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("newId generates unique values", () => {
  const ids = new Set(Array.from({ length: 10 }, () => newId()));
  assert.equal(ids.size, 10, "all 10 IDs should be unique");
});
