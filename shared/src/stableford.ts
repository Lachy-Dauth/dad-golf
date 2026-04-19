import type { Course, Player, Score, LeaderboardRow, Gender, Tee } from "./types.js";

export function resolvePlayerTee(course: Course, player: Player): Tee {
  const byId = course.tees.find((t) => t.id === player.teeId);
  if (byId) return byId;
  const byDefault = course.tees.find((t) => t.id === course.defaultTeeId);
  if (byDefault) return byDefault;
  return course.tees[0];
}

export const CONSISTENCY_FACTOR_MALE = 0.9986;
export const CONSISTENCY_FACTOR_FEMALE = 1.0483;

export function consistencyFactor(gender: Gender): number {
  return gender === "F" ? CONSISTENCY_FACTOR_FEMALE : CONSISTENCY_FACTOR_MALE;
}

/**
 * Convert a Golf Australia handicap into the integer Daily Handicap used
 * for Stableford on a given course. Implements the Golf Australia WHS
 * Daily Handicap formula.
 *
 * 18-hole:
 *   ((GA × Slope ÷ 113) + (Scratch − Par)) × 0.93 × ConsistencyFactor
 *
 * 9-hole:
 *   (((GA ÷ 2) × Slope9 ÷ 113) + (Scratch9 − Par9)) × 0.93 × ConsistencyFactor
 *
 * Consistency Factor: Men/Boys = 0.9986, Women/Girls = 1.0483.
 * Source: https://www.golf.org.au/handicapping
 */
export function calculateDailyHandicap(
  gaHandicap: number,
  slope: number,
  scratchRating: number,
  par: number,
  gender: Gender,
  holeCount: number = 18,
): number {
  if (
    !Number.isFinite(gaHandicap) ||
    !Number.isFinite(slope) ||
    !Number.isFinite(scratchRating) ||
    !Number.isFinite(par) ||
    slope <= 0
  ) {
    return 0;
  }
  const effectiveGa = holeCount === 9 ? gaHandicap / 2 : gaHandicap;
  const raw =
    ((effectiveGa * slope) / 113 + (scratchRating - par)) * 0.93 * consistencyFactor(gender);
  return Math.round(raw);
}

/**
 * How many strokes a player receives on a hole given their (integer) daily
 * handicap and the hole's stroke index (1 = hardest, 18 = easiest).
 *
 * Daily handicap 18 → 1 shot on every hole.
 * Daily handicap 27 → 1 shot on every hole + an extra on stroke index 1-9.
 * Daily handicap 36+ → 2 shots on every hole + extras on the hardest holes.
 */
export function strokesReceived(dailyHandicap: number, strokeIndex: number): number {
  if (dailyHandicap < 0) return 0;
  const base = Math.floor(dailyHandicap / 18);
  const remainder = dailyHandicap - base * 18;
  const extra = remainder >= strokeIndex ? 1 : 0;
  return base + extra;
}

/**
 * Stableford points for a single hole. `dailyHandicap` is the integer daily
 * handicap (i.e. already adjusted from GA handicap by the course slope).
 * Returns 0 if strokes is undefined/0 (hole not played).
 */
export function stablefordPoints(
  strokes: number,
  par: number,
  dailyHandicap: number,
  strokeIndex: number,
): number {
  if (!strokes || strokes <= 0) return 0;
  const net = strokes - strokesReceived(dailyHandicap, strokeIndex);
  const diff = net - par;
  if (diff <= -3) return 5;
  if (diff === -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
}

export interface PlayerHoleResult {
  holeNumber: number;
  par: number;
  strokeIndex: number;
  strokes: number | null;
  strokesReceived: number;
  net: number | null;
  points: number;
}

export function computePlayerHoles(
  course: Course,
  player: Player,
  scores: Score[],
): PlayerHoleResult[] {
  const holes = [...course.holes].sort((a, b) => a.number - b.number);
  const byHole = new Map<number, Score>();
  for (const s of scores) {
    if (s.playerId === player.id) {
      byHole.set(s.holeNumber, s);
    }
  }
  const tee = resolvePlayerTee(course, player);
  const dailyHandicap = calculateDailyHandicap(
    player.handicap,
    tee.slope,
    tee.rating,
    totalPar(course),
    player.gender,
    course.holes.length,
  );
  return holes.map((h) => {
    const score = byHole.get(h.number);
    const strokes = score ? score.strokes : null;
    const received = strokesReceived(dailyHandicap, h.strokeIndex);
    const net = strokes != null ? strokes - received : null;
    const points =
      strokes != null ? stablefordPoints(strokes, h.par, dailyHandicap, h.strokeIndex) : 0;
    return {
      holeNumber: h.number,
      par: h.par,
      strokeIndex: h.strokeIndex,
      strokes,
      strokesReceived: received,
      net,
      points,
    };
  });
}

export function computeLeaderboard(
  course: Course,
  players: Player[],
  scores: Score[],
): LeaderboardRow[] {
  const coursePar = totalPar(course);
  const rows = players.map((p) => {
    const tee = resolvePlayerTee(course, p);
    const holes = computePlayerHoles(course, p, scores);
    const played = holes.filter((h) => h.strokes != null);
    const totalPoints = played.reduce((sum, h) => sum + h.points, 0);
    const totalStrokes = played.reduce((sum, h) => sum + (h.strokes || 0), 0);
    const netStrokes = played.reduce((sum, h) => sum + ((h.strokes || 0) - h.strokesReceived), 0);
    return {
      playerId: p.id,
      name: p.name,
      handicap: p.handicap,
      dailyHandicap: calculateDailyHandicap(
        p.handicap,
        tee.slope,
        tee.rating,
        coursePar,
        p.gender,
        course.holes.length,
      ),
      holesPlayed: played.length,
      totalPoints,
      totalStrokes,
      netStrokes,
      pointsBack: 0,
      position: 0,
    } as LeaderboardRow;
  });

  // Sort: most points first, then fewer net strokes, then name
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.netStrokes !== b.netStrokes) return a.netStrokes - b.netStrokes;
    return a.name.localeCompare(b.name);
  });

  const leader = rows[0]?.totalPoints ?? 0;
  let lastPoints: number | null = null;
  let lastPosition = 0;
  rows.forEach((row, i) => {
    row.pointsBack = leader - row.totalPoints;
    if (lastPoints === null || row.totalPoints !== lastPoints) {
      row.position = i + 1;
      lastPosition = i + 1;
      lastPoints = row.totalPoints;
    } else {
      row.position = lastPosition;
    }
  });
  return rows;
}

export function totalPar(course: Course): number {
  return course.holes.reduce((sum, h) => sum + h.par, 0);
}
