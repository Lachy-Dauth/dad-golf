import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGE_DEFINITIONS, BADGE_MAP } from "./badges.js";

const VALID_CATEGORIES = new Set(["milestones", "scoring", "social", "competitions"]);

test("BADGE_DEFINITIONS is non-empty", () => {
  assert.ok(BADGE_DEFINITIONS.length > 0);
});

test("every badge has required fields", () => {
  for (const badge of BADGE_DEFINITIONS) {
    assert.ok(typeof badge.id === "string" && badge.id.length > 0, `missing id`);
    assert.ok(
      typeof badge.name === "string" && badge.name.length > 0,
      `missing name on ${badge.id}`,
    );
    assert.ok(
      typeof badge.description === "string" && badge.description.length > 0,
      `missing description on ${badge.id}`,
    );
    assert.ok(
      typeof badge.icon === "string" && badge.icon.length > 0,
      `missing icon on ${badge.id}`,
    );
    assert.ok(typeof badge.category === "string", `missing category on ${badge.id}`);
  }
});

test("all badge IDs are unique", () => {
  const ids = BADGE_DEFINITIONS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate badge IDs found");
});

test("all categories are valid", () => {
  for (const badge of BADGE_DEFINITIONS) {
    assert.ok(
      VALID_CATEGORIES.has(badge.category),
      `invalid category '${badge.category}' on ${badge.id}`,
    );
  }
});

test("BADGE_MAP contains all definitions", () => {
  assert.equal(BADGE_MAP.size, BADGE_DEFINITIONS.length);
  for (const badge of BADGE_DEFINITIONS) {
    assert.equal(BADGE_MAP.get(badge.id), badge);
  }
});

test("BADGE_MAP returns undefined for unknown ID", () => {
  assert.equal(BADGE_MAP.get("nonexistent"), undefined);
});
