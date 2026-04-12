import { test } from "node:test";
import assert from "node:assert/strict";
import {
  strokesReceived,
  stablefordPoints,
  computeLeaderboard,
  computePlayerHoles,
  calculateDailyHandicap,
  totalPar,
} from "./stableford.js";
import type { Course, Player, Score } from "./types.js";

test("strokesReceived handicap 0", () => {
  for (let si = 1; si <= 18; si++) {
    assert.equal(strokesReceived(0, si), 0);
  }
});

test("strokesReceived handicap 9 - 9 hardest holes get a stroke", () => {
  assert.equal(strokesReceived(9, 1), 1);
  assert.equal(strokesReceived(9, 9), 1);
  assert.equal(strokesReceived(9, 10), 0);
  assert.equal(strokesReceived(9, 18), 0);
});

test("strokesReceived handicap 18 - every hole gets one stroke", () => {
  for (let si = 1; si <= 18; si++) {
    assert.equal(strokesReceived(18, si), 1);
  }
});

test("strokesReceived handicap 27 - nine hardest get two, rest get one", () => {
  for (let si = 1; si <= 9; si++) assert.equal(strokesReceived(27, si), 2);
  for (let si = 10; si <= 18; si++) assert.equal(strokesReceived(27, si), 1);
});

test("strokesReceived handicap 36 - every hole gets two strokes", () => {
  for (let si = 1; si <= 18; si++) {
    assert.equal(strokesReceived(36, si), 2);
  }
});

test("strokesReceived handicap 45 - nine hardest get three, rest get two", () => {
  for (let si = 1; si <= 9; si++) assert.equal(strokesReceived(45, si), 3);
  for (let si = 10; si <= 18; si++) assert.equal(strokesReceived(45, si), 2);
});

test("stableford points - par 4, scratch player", () => {
  assert.equal(stablefordPoints(1, 4, 0, 1), 5); // albatross
  assert.equal(stablefordPoints(2, 4, 0, 1), 4); // eagle
  assert.equal(stablefordPoints(3, 4, 0, 1), 3); // birdie
  assert.equal(stablefordPoints(4, 4, 0, 1), 2); // par
  assert.equal(stablefordPoints(5, 4, 0, 1), 1); // bogey
  assert.equal(stablefordPoints(6, 4, 0, 1), 0); // double
  assert.equal(stablefordPoints(7, 4, 0, 1), 0);
});

test("stableford points - handicap lifts par 5 → net eagle", () => {
  // Handicap 18, all holes get 1 stroke. Par 5, gross 4 → net 3 = eagle = 4 pts
  assert.equal(stablefordPoints(4, 5, 18, 10), 4);
});

test("stableford points - unplayed hole returns 0", () => {
  assert.equal(stablefordPoints(0, 4, 10, 1), 0);
});

test("stableford points - negative strokes returns 0", () => {
  assert.equal(stablefordPoints(-1, 4, 0, 1), 0);
});

test("strokesReceived negative handicap returns 0", () => {
  assert.equal(strokesReceived(-5, 1), 0);
});

function makeCourse(slope = 113): Course {
  const holes = Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3,
    strokeIndex: i + 1,
  }));
  return {
    id: "c1",
    name: "Test",
    location: null,
    rating: 72.0,
    slope,
    holes,
    createdAt: new Date().toISOString(),
    createdByUserId: null,
    createdByName: null,
    favoriteCount: 0,
    isFavorite: false,
  };
}

test("calculateDailyHandicap - neutral slope 113 returns rounded GA handicap", () => {
  assert.equal(calculateDailyHandicap(12.3, 113), 12);
  assert.equal(calculateDailyHandicap(12.5, 113), 13);
  assert.equal(calculateDailyHandicap(0, 113), 0);
  assert.equal(calculateDailyHandicap(18.0, 113), 18);
});

test("calculateDailyHandicap - higher slope adds strokes", () => {
  // 12.3 * 130 / 113 = 14.149… → 14
  assert.equal(calculateDailyHandicap(12.3, 130), 14);
  // 18.0 * 140 / 113 = 22.30… → 22
  assert.equal(calculateDailyHandicap(18.0, 140), 22);
});

test("calculateDailyHandicap - lower slope removes strokes", () => {
  // 18.0 * 100 / 113 = 15.929… → 16
  assert.equal(calculateDailyHandicap(18.0, 100), 16);
});

test("leaderboard sort - higher points first, tie-break by net strokes", () => {
  const course = makeCourse();
  const players: Player[] = [
    {
      id: "p1",
      roundId: "r1",
      name: "Alice",
      handicap: 0,
      joinedAt: "",
    },
    {
      id: "p2",
      roundId: "r1",
      name: "Bob",
      handicap: 18,
      joinedAt: "",
    },
  ];
  const scores: Score[] = [];
  for (let h = 1; h <= 9; h++) {
    const par = course.holes[h - 1].par;
    scores.push({
      id: `s-a-${h}`,
      roundId: "r1",
      playerId: "p1",
      holeNumber: h,
      strokes: par, // all pars, 2pts each = 18
      createdAt: "",
    });
    scores.push({
      id: `s-b-${h}`,
      roundId: "r1",
      playerId: "p2",
      holeNumber: h,
      strokes: par + 1, // bogey gross, but handicap gives stroke → net par = 2pts each = 18
      createdAt: "",
    });
  }
  const lb = computeLeaderboard(course, players, scores);
  assert.equal(lb.length, 2);
  assert.equal(lb[0].totalPoints, 18);
  assert.equal(lb[1].totalPoints, 18);
  // Tie-break: net strokes. Both should be net total equal, sorted by name.
  assert.equal(lb[0].name, "Alice");
  assert.equal(lb[0].position, 1);
  assert.equal(lb[1].position, 1);
});

test("calculateDailyHandicap - invalid inputs return 0", () => {
  assert.equal(calculateDailyHandicap(NaN, 113), 0);
  assert.equal(calculateDailyHandicap(18, NaN), 0);
  assert.equal(calculateDailyHandicap(18, 0), 0);
  assert.equal(calculateDailyHandicap(18, -1), 0);
});

test("computePlayerHoles returns correct results for each hole", () => {
  const course = makeCourse();
  const player: Player = { id: "p1", roundId: "r1", name: "Alice", handicap: 0, joinedAt: "" };
  const scores: Score[] = [
    { id: "s1", roundId: "r1", playerId: "p1", holeNumber: 1, strokes: 5, createdAt: "" },
    { id: "s2", roundId: "r1", playerId: "p1", holeNumber: 2, strokes: 4, createdAt: "" },
  ];
  const result = computePlayerHoles(course, player, scores);
  assert.equal(result.length, 18);
  // Hole 1: par 5, strokes 5, scratch → net 5, 2 pts (par)
  assert.equal(result[0].holeNumber, 1);
  assert.equal(result[0].strokes, 5);
  assert.equal(result[0].net, 5);
  assert.equal(result[0].points, 2);
  // Hole 2: par 4, strokes 4 → 2 pts
  assert.equal(result[1].strokes, 4);
  assert.equal(result[1].points, 2);
  // Hole 3: no score → null strokes, 0 points
  assert.equal(result[2].strokes, null);
  assert.equal(result[2].net, null);
  assert.equal(result[2].points, 0);
});

test("computePlayerHoles filters scores for the correct player", () => {
  const course = makeCourse();
  const player: Player = { id: "p1", roundId: "r1", name: "Alice", handicap: 0, joinedAt: "" };
  const scores: Score[] = [
    { id: "s1", roundId: "r1", playerId: "p1", holeNumber: 1, strokes: 5, createdAt: "" },
    { id: "s2", roundId: "r1", playerId: "p2", holeNumber: 1, strokes: 3, createdAt: "" },
  ];
  const result = computePlayerHoles(course, player, scores);
  assert.equal(result[0].strokes, 5); // only p1's score
});

test("computePlayerHoles with handicap receives strokes", () => {
  const course = makeCourse();
  // handicap 18 on slope 113 → daily handicap 18 → 1 stroke received per hole
  const player: Player = { id: "p1", roundId: "r1", name: "Bob", handicap: 18, joinedAt: "" };
  const scores: Score[] = [
    { id: "s1", roundId: "r1", playerId: "p1", holeNumber: 1, strokes: 6, createdAt: "" },
  ];
  const result = computePlayerHoles(course, player, scores);
  assert.equal(result[0].strokesReceived, 1);
  assert.equal(result[0].net, 5); // 6 - 1
});

test("totalPar sums all hole pars", () => {
  const course = makeCourse();
  const expected = course.holes.reduce((sum, h) => sum + h.par, 0);
  assert.equal(totalPar(course), expected);
});

test("totalPar for a par-72 course", () => {
  const holes = Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokeIndex: i + 1,
  }));
  const course: Course = {
    id: "c1",
    name: "Flat",
    location: null,
    rating: 72,
    slope: 113,
    holes,
    createdAt: "",
    createdByUserId: null,
    createdByName: null,
    favoriteCount: 0,
    isFavorite: false,
  };
  assert.equal(totalPar(course), 72);
});

test("leaderboard with empty players list", () => {
  const course = makeCourse();
  const lb = computeLeaderboard(course, [], []);
  assert.deepEqual(lb, []);
});

test("leaderboard position with gaps", () => {
  const course = makeCourse();
  const players: Player[] = [
    { id: "p1", roundId: "r1", name: "Alice", handicap: 0, joinedAt: "" },
    { id: "p2", roundId: "r1", name: "Bob", handicap: 0, joinedAt: "" },
    { id: "p3", roundId: "r1", name: "Carol", handicap: 0, joinedAt: "" },
  ];
  const scores: Score[] = [
    // Alice: par (2pts)
    {
      id: "1",
      roundId: "r1",
      playerId: "p1",
      holeNumber: 1,
      strokes: 5,
      createdAt: "",
    },
    // Bob: birdie (3pts)
    {
      id: "2",
      roundId: "r1",
      playerId: "p2",
      holeNumber: 1,
      strokes: 4,
      createdAt: "",
    },
    // Carol: double (0pts)
    {
      id: "3",
      roundId: "r1",
      playerId: "p3",
      holeNumber: 1,
      strokes: 7,
      createdAt: "",
    },
  ];
  const lb = computeLeaderboard(course, players, scores);
  assert.equal(lb[0].name, "Bob");
  assert.equal(lb[0].position, 1);
  assert.equal(lb[0].pointsBack, 0);
  assert.equal(lb[1].name, "Alice");
  assert.equal(lb[1].position, 2);
  assert.equal(lb[1].pointsBack, 1);
  assert.equal(lb[2].name, "Carol");
  assert.equal(lb[2].position, 3);
  assert.equal(lb[2].pointsBack, 3);
});
