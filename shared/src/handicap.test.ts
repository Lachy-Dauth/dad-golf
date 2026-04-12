import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateScoreDifferential, calculateHandicapIndex } from "./handicap.js";

// --- calculateScoreDifferential ---

test("score differential - neutral slope 113", () => {
  // (113 / 113) * (90 - 72) = 18.0
  assert.equal(calculateScoreDifferential(90, 72.0, 113), 18.0);
});

test("score differential - higher slope gives lower differential", () => {
  // (113 / 130) * (95 - 72) = 0.8692... * 23 = 19.992... → 20.0
  assert.equal(calculateScoreDifferential(95, 72.0, 130), 20.0);
});

test("score differential - lower slope gives higher differential", () => {
  // (113 / 100) * (90 - 72) = 1.13 * 18 = 20.34 → 20.3
  assert.equal(calculateScoreDifferential(90, 72.0, 100), 20.3);
});

test("score differential - score below course rating gives negative", () => {
  // (113 / 113) * (68 - 72) = -4.0
  assert.equal(calculateScoreDifferential(68, 72.0, 113), -4.0);
});

test("score differential - non-finite inputs return 0", () => {
  assert.equal(calculateScoreDifferential(NaN, 72, 113), 0);
  assert.equal(calculateScoreDifferential(90, Infinity, 113), 0);
  assert.equal(calculateScoreDifferential(90, 72, NaN), 0);
});

test("score differential - slope zero returns 0", () => {
  assert.equal(calculateScoreDifferential(90, 72, 0), 0);
});

test("score differential - negative slope returns 0", () => {
  assert.equal(calculateScoreDifferential(90, 72, -10), 0);
});

// --- calculateHandicapIndex ---

function makeRounds(diffs: number[]) {
  return diffs.map((d, i) => ({ id: `r${i}`, differential: d }));
}

test("handicap index - fewer than 3 rounds returns null", () => {
  assert.equal(calculateHandicapIndex([]), null);
  assert.equal(calculateHandicapIndex(makeRounds([10])), null);
  assert.equal(calculateHandicapIndex(makeRounds([10, 12])), null);
});

test("handicap index - 3 rounds: lowest 1 minus 2.0", () => {
  const result = calculateHandicapIndex(makeRounds([15.0, 10.0, 20.0]));
  assert.ok(result);
  // Lowest = 10.0, minus 2.0 = 8.0
  assert.equal(result.handicapIndex, 8.0);
  assert.equal(result.roundsUsed, 1);
  assert.equal(result.totalRounds, 3);
  assert.equal(result.adjustment, 2.0);
  assert.deepEqual(result.usedRoundIds, ["r1"]);
});

test("handicap index - 4 rounds: lowest 1 minus 1.0", () => {
  const result = calculateHandicapIndex(makeRounds([15.0, 10.0, 20.0, 18.0]));
  assert.ok(result);
  // Lowest = 10.0, minus 1.0 = 9.0
  assert.equal(result.handicapIndex, 9.0);
  assert.equal(result.roundsUsed, 1);
  assert.equal(result.adjustment, 1.0);
});

test("handicap index - 5 rounds: lowest 1 no adjustment", () => {
  const result = calculateHandicapIndex(makeRounds([15.0, 10.0, 20.0, 18.0, 12.0]));
  assert.ok(result);
  assert.equal(result.handicapIndex, 10.0);
  assert.equal(result.roundsUsed, 1);
  assert.equal(result.adjustment, 0);
});

test("handicap index - 6 rounds: avg lowest 2 minus 1.0", () => {
  const result = calculateHandicapIndex(makeRounds([15.0, 10.0, 20.0, 18.0, 12.0, 25.0]));
  assert.ok(result);
  // Lowest 2: 10.0, 12.0 → avg = 11.0, minus 1.0 = 10.0
  assert.equal(result.handicapIndex, 10.0);
  assert.equal(result.roundsUsed, 2);
  assert.equal(result.adjustment, 1.0);
});

test("handicap index - 8 rounds: avg lowest 2 no adjustment", () => {
  const result = calculateHandicapIndex(
    makeRounds([15.0, 10.0, 20.0, 18.0, 12.0, 25.0, 22.0, 16.0]),
  );
  assert.ok(result);
  // Lowest 2: 10.0, 12.0 → avg = 11.0
  assert.equal(result.handicapIndex, 11.0);
  assert.equal(result.roundsUsed, 2);
});

test("handicap index - 10 rounds: avg lowest 3", () => {
  const result = calculateHandicapIndex(
    makeRounds([15.0, 10.0, 20.0, 18.0, 12.0, 25.0, 22.0, 16.0, 14.0, 11.0]),
  );
  assert.ok(result);
  // Lowest 3: 10.0, 11.0, 12.0 → avg = 11.0
  assert.equal(result.handicapIndex, 11.0);
  assert.equal(result.roundsUsed, 3);
});

test("handicap index - 20 rounds: avg lowest 8", () => {
  const diffs = [18, 15, 20, 12, 25, 10, 22, 16, 14, 11, 19, 23, 17, 13, 21, 24, 9, 26, 8, 27];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  // Sorted: 8, 9, 10, 11, 12, 13, 14, 15, ... → lowest 8 = 8,9,10,11,12,13,14,15
  // avg = (8+9+10+11+12+13+14+15) / 8 = 92/8 = 11.5
  assert.equal(result.handicapIndex, 11.5);
  assert.equal(result.roundsUsed, 8);
  assert.equal(result.totalRounds, 20);
  assert.equal(result.adjustment, 0);
});

test("handicap index - 7 rounds: avg lowest 2 no adjustment", () => {
  const result = calculateHandicapIndex(makeRounds([15, 10, 20, 18, 12, 25, 22]));
  assert.ok(result);
  // Lowest 2: 10, 12 → avg = 11.0
  assert.equal(result.handicapIndex, 11.0);
  assert.equal(result.roundsUsed, 2);
  assert.equal(result.adjustment, 0);
});

test("handicap index - 9 rounds: avg lowest 3", () => {
  const result = calculateHandicapIndex(makeRounds([15, 10, 20, 18, 12, 25, 22, 16, 14]));
  assert.ok(result);
  assert.equal(result.roundsUsed, 3);
});

test("handicap index - 11 rounds: avg lowest 3", () => {
  const result = calculateHandicapIndex(makeRounds([15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19]));
  assert.ok(result);
  assert.equal(result.roundsUsed, 3);
});

test("handicap index - 12 rounds: avg lowest 4", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 4);
});

test("handicap index - 14 rounds: avg lowest 4", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23, 17, 13];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 4);
});

test("handicap index - 15 rounds: avg lowest 5", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23, 17, 13, 21];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 5);
});

test("handicap index - 16 rounds: avg lowest 5", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23, 17, 13, 21, 24];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 5);
});

test("handicap index - 17 rounds: avg lowest 6", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23, 17, 13, 21, 24, 9];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 6);
});

test("handicap index - 18 rounds: avg lowest 6", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23, 17, 13, 21, 24, 9, 26];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 6);
});

test("handicap index - 19 rounds: avg lowest 7", () => {
  const diffs = [15, 10, 20, 18, 12, 25, 22, 16, 14, 11, 19, 23, 17, 13, 21, 24, 9, 26, 8];
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.roundsUsed, 7);
});

test("handicap index - clamped at 54.0", () => {
  // 3 rounds with very high differentials
  const result = calculateHandicapIndex(makeRounds([58.0, 60.0, 62.0]));
  assert.ok(result);
  // Lowest = 58.0, minus 2.0 = 56.0 → clamped to 54.0
  assert.equal(result.handicapIndex, 54.0);
});

test("handicap index - clamped at 0.0", () => {
  // 3 rounds where lowest minus adjustment goes negative
  const result = calculateHandicapIndex(makeRounds([1.0, 2.0, 3.0]));
  assert.ok(result);
  // Lowest = 1.0, minus 2.0 = -1.0 → clamped to 0.0
  assert.equal(result.handicapIndex, 0.0);
});

test("handicap index - more than 20 rounds only uses first 20", () => {
  const diffs = Array.from({ length: 25 }, (_, i) => 10.0 + i);
  const result = calculateHandicapIndex(makeRounds(diffs));
  assert.ok(result);
  assert.equal(result.totalRounds, 20);
  assert.equal(result.roundsUsed, 8);
});

test("handicap index - correct rounding to 1 decimal", () => {
  // 7 rounds: avg lowest 2
  const result = calculateHandicapIndex(makeRounds([10.3, 10.8, 15.0, 20.0, 18.0, 16.0, 14.0]));
  assert.ok(result);
  // Lowest 2: 10.3, 10.8 → avg = 10.55 → rounds to 10.6
  assert.equal(result.handicapIndex, 10.6);
});
