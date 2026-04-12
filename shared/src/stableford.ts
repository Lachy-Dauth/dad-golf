import type { Course, Player, Score, LeaderboardRow } from "./types.js";

/**
 * Convert a Golf Australia handicap (one decimal place) into the integer
 * Daily Handicap used for Stableford on a given course.
 *
 *   Daily Handicap = round(GA Handicap × Slope Rating ÷ 113)
 *
 * The slope of a "neutral" course is 113, so playing a tougher course
 * (higher slope) gives you more strokes and an easier course gives fewer.
 * Source: https://www.golf.org.au/handicapping
 */
export function calculateDailyHandicap(gaHandicap: number, slope: number): number {
  if (!Number.isFinite(gaHandicap) || !Number.isFinite(slope) || slope <= 0) {
    return 0;
  }
  return Math.round((gaHandicap * slope) / 113);
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
  const dailyHandicap = calculateDailyHandicap(player.handicap, course.slope);
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
  const rows = players.map((p) => {
    const holes = computePlayerHoles(course, p, scores);
    const played = holes.filter((h) => h.strokes != null);
    const totalPoints = played.reduce((sum, h) => sum + h.points, 0);
    const totalStrokes = played.reduce((sum, h) => sum + (h.strokes || 0), 0);
    const netStrokes = played.reduce((sum, h) => sum + ((h.strokes || 0) - h.strokesReceived), 0);
    return {
      playerId: p.id,
      name: p.name,
      handicap: p.handicap,
      dailyHandicap: calculateDailyHandicap(p.handicap, course.slope),
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
