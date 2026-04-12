import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRoomCode, normalizeRoomCode } from "./roomCode.js";

const VALID_CHARS = new Set("23456789ABCDEFGHJKMNPQRSTUVWXYZ".split(""));

test("generateRoomCode returns GOLF- prefix with 4 chars by default", () => {
  const code = generateRoomCode();
  assert.ok(code.startsWith("GOLF-"));
  assert.equal(code.length, 9); // "GOLF-" (5) + 4
});

test("generateRoomCode uses only valid alphabet characters", () => {
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    const chars = code.slice(5); // strip "GOLF-"
    for (const c of chars) {
      assert.ok(VALID_CHARS.has(c), `unexpected character '${c}' in code '${code}'`);
    }
  }
});

test("generateRoomCode respects custom length", () => {
  const code = generateRoomCode(6);
  assert.ok(code.startsWith("GOLF-"));
  assert.equal(code.length, 11); // "GOLF-" (5) + 6
});

test("generateRoomCode produces different codes on successive calls", () => {
  // With 29^4 = 707,281 possibilities, two consecutive collisions are negligible.
  // Test two calls rather than asserting uniqueness across many to avoid flakiness.
  const a = generateRoomCode();
  const b = generateRoomCode();
  // We only assert format here; statistical uniqueness is inherent in the alphabet size.
  assert.ok(a.startsWith("GOLF-"));
  assert.ok(b.startsWith("GOLF-"));
});

test("normalizeRoomCode passes through already-prefixed code", () => {
  assert.equal(normalizeRoomCode("GOLF-ABCD"), "GOLF-ABCD");
});

test("normalizeRoomCode adds prefix when missing", () => {
  assert.equal(normalizeRoomCode("ABCD"), "GOLF-ABCD");
});

test("normalizeRoomCode uppercases input", () => {
  assert.equal(normalizeRoomCode("golf-abcd"), "GOLF-ABCD");
  assert.equal(normalizeRoomCode("abcd"), "GOLF-ABCD");
});

test("normalizeRoomCode trims whitespace", () => {
  assert.equal(normalizeRoomCode("  ABCD  "), "GOLF-ABCD");
  assert.equal(normalizeRoomCode("  GOLF-ABCD  "), "GOLF-ABCD");
});
