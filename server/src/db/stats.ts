import type { Course } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";
import { pool } from "./pool.js";

export interface UserStatsResult {
  totalRounds: number;
  wins: number;
  totalHolesPlayed: number;
  // Stableford scoring distribution (net-based points)
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  // Raw strokes distribution (gross vs par)
  strokesUnderPar: number; // hole scored under par (gross)
  strokesAtPar: number;
  strokesOverOne: number; // bogey (gross)
  strokesOverTwo: number; // double bogey (gross)
  strokesOverThreePlus: number; // triple+ (gross)
  // Per-par-type averages (points + strokes)
  par3AvgPoints: number | null;
  par4AvgPoints: number | null;
  par5AvgPoints: number | null;
  par3AvgStrokes: number | null;
  par4AvgStrokes: number | null;
  par5AvgStrokes: number | null;
  // Best round
  bestRoundPoints: number | null;
  bestRoundCourse: string | null;
  bestRoundCode: string | null;
  bestRoundStrokes: number | null;
  bestStrokesRoundStrokes: number | null;
  bestStrokesRoundCourse: string | null;
  bestStrokesRoundCode: string | null;
  // Averages
  avgPointsPerRound: number | null;
  avgStrokesPerRound: number | null;
  // Per-course stats
  courseStats: Array<{
    courseId: string;
    courseName: string;
    courseLocation: string | null;
    timesPlayed: number;
    avgPoints: number;
    bestPoints: number;
    avgStrokes: number;
    bestStrokes: number;
    coursePar: number;
  }>;
  // Recent rounds for trend chart + table
  recentRounds: Array<{
    roomCode: string;
    courseName: string;
    completedAt: string;
    totalPoints: number;
    totalStrokes: number;
    position: number;
    playerCount: number;
    coursePar: number;
  }>;
}

export async function getUserStats(userId: string): Promise<UserStatsResult> {
  // Get all completed rounds this user participated in
  const { rows: roundRows } = await pool.query(
    `SELECT r.id AS round_id, r.room_code, r.course_id,
            c.name AS course_name, c.location AS course_location,
            c.rating AS course_rating, c.slope AS course_slope, c.holes_json,
            r.completed_at,
            (SELECT COUNT(*)::int FROM players p2 WHERE p2.round_id = r.id) AS player_count
     FROM rounds r
     JOIN players p ON p.round_id = r.id AND p.user_id = $1
     JOIN courses c ON c.id = r.course_id
     WHERE r.status = 'complete'
     ORDER BY r.completed_at DESC`,
    [userId],
  );

  if (roundRows.length === 0) {
    return {
      totalRounds: 0,
      wins: 0,
      totalHolesPlayed: 0,
      eagles: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doublePlus: 0,
      strokesUnderPar: 0,
      strokesAtPar: 0,
      strokesOverOne: 0,
      strokesOverTwo: 0,
      strokesOverThreePlus: 0,
      par3AvgPoints: null,
      par4AvgPoints: null,
      par5AvgPoints: null,
      par3AvgStrokes: null,
      par4AvgStrokes: null,
      par5AvgStrokes: null,
      bestRoundPoints: null,
      bestRoundCourse: null,
      bestRoundCode: null,
      bestRoundStrokes: null,
      bestStrokesRoundStrokes: null,
      bestStrokesRoundCourse: null,
      bestStrokesRoundCode: null,
      avgPointsPerRound: null,
      avgStrokesPerRound: null,
      courseStats: [],
      recentRounds: [],
    };
  }

  const roundIds = roundRows.map((r) => (r as Record<string, unknown>).round_id as string);

  // Batch-fetch all players and scores
  const { rows: allPlayerRows } = await pool.query(
    `SELECT id, round_id, user_id, name, handicap FROM players WHERE round_id = ANY($1)`,
    [roundIds],
  );
  const { rows: allScoreRows } = await pool.query(
    `SELECT id, round_id, player_id, hole_number, strokes, created_at FROM scores WHERE round_id = ANY($1)`,
    [roundIds],
  );

  // Index players and scores by round
  const playersByRound = new Map<
    string,
    Array<{ id: string; roundId: string; userId: string | null; name: string; handicap: number }>
  >();
  for (const p of allPlayerRows as Record<string, unknown>[]) {
    const roundId = p.round_id as string;
    const player = {
      id: p.id as string,
      roundId,
      userId: p.user_id as string | null,
      name: p.name as string,
      handicap: Number(p.handicap),
    };
    const list = playersByRound.get(roundId);
    if (list) list.push(player);
    else playersByRound.set(roundId, [player]);
  }

  const scoresByRound = new Map<
    string,
    Array<{
      id: string;
      roundId: string;
      playerId: string;
      holeNumber: number;
      strokes: number;
      createdAt: string;
    }>
  >();
  for (const s of allScoreRows as Record<string, unknown>[]) {
    const roundId = s.round_id as string;
    const score = {
      id: s.id as string,
      roundId,
      playerId: s.player_id as string,
      holeNumber: Number(s.hole_number),
      strokes: Number(s.strokes),
      createdAt: s.created_at as string,
    };
    const list = scoresByRound.get(roundId);
    if (list) list.push(score);
    else scoresByRound.set(roundId, [score]);
  }

  // Accumulate stats
  let wins = 0;
  let totalHolesPlayed = 0;
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doublePlus = 0;
  let strokesUnderPar = 0;
  let strokesAtPar = 0;
  let strokesOverOne = 0;
  let strokesOverTwo = 0;
  let strokesOverThreePlus = 0;
  let par3PointsTotal = 0;
  let par3StrokesTotal = 0;
  let par3Count = 0;
  let par4PointsTotal = 0;
  let par4StrokesTotal = 0;
  let par4Count = 0;
  let par5PointsTotal = 0;
  let par5StrokesTotal = 0;
  let par5Count = 0;
  let bestRoundPoints: number | null = null;
  let bestRoundCourse: string | null = null;
  let bestRoundCode: string | null = null;
  let bestRoundStrokes: number | null = null;
  let bestStrokesRoundStrokes: number | null = null;
  let bestStrokesRoundCourse: string | null = null;
  let bestStrokesRoundCode: string | null = null;
  let totalPointsAll = 0;
  let totalStrokesAll = 0;

  const courseMap = new Map<
    string,
    {
      courseId: string;
      courseName: string;
      courseLocation: string | null;
      points: number[];
      strokes: number[];
      coursePar: number;
    }
  >();

  const recentRounds: UserStatsResult["recentRounds"] = [];

  for (const row of roundRows as Record<string, unknown>[]) {
    const roundId = row.round_id as string;
    const roomCode = row.room_code as string;
    const courseName = row.course_name as string;
    const courseLocation = row.course_location as string | null;
    const courseId = row.course_id as string;
    const completedAt = row.completed_at as string;
    const playerCount = Number(row.player_count);
    const holes = JSON.parse(row.holes_json as string) as Array<{
      number: number;
      par: number;
      strokeIndex: number;
    }>;
    const course = {
      holes,
      slope: Number(row.course_slope),
      rating: Number(row.course_rating),
    } as Course;

    const players = playersByRound.get(roundId) ?? [];
    const scores = scoresByRound.get(roundId) ?? [];

    // Find the viewer's player record
    const viewerPlayer = players.find((p) => p.userId === userId);
    if (!viewerPlayer) continue;

    // Compute player holes for the viewer
    const playerHoles = computePlayerHoles(
      course,
      { ...viewerPlayer, joinedAt: "", isGuest: false },
      scores,
    );
    const played = playerHoles.filter((h) => h.strokes != null);
    const viewerPoints = played.reduce((sum, h) => sum + h.points, 0);
    const viewerStrokes = played.reduce((sum, h) => sum + (h.strokes || 0), 0);

    // Compute all players' points for position
    const allPlayerPoints = players.map((p) => {
      const ph = computePlayerHoles(course, { ...p, joinedAt: "", isGuest: false }, scores);
      const pp = ph.filter((h) => h.strokes != null);
      return { playerId: p.id, points: pp.reduce((sum, h) => sum + h.points, 0) };
    });
    allPlayerPoints.sort((a, b) => b.points - a.points);

    let position = 1;
    for (let i = 0; i < allPlayerPoints.length; i++) {
      if (i > 0 && allPlayerPoints[i].points < allPlayerPoints[i - 1].points) {
        position = i + 1;
      }
      if (allPlayerPoints[i].playerId === viewerPlayer.id) {
        position =
          i > 0 && allPlayerPoints[i].points === allPlayerPoints[i - 1].points ? position : i + 1;
        break;
      }
    }

    if (position === 1) wins++;

    totalHolesPlayed += played.length;
    totalPointsAll += viewerPoints;
    totalStrokesAll += viewerStrokes;
    const coursePar = holes.reduce((sum, h) => sum + h.par, 0);

    // Score distribution (Stableford points-based)
    for (const h of played) {
      if (h.points >= 4) eagles++;
      else if (h.points === 3) birdies++;
      else if (h.points === 2) pars++;
      else if (h.points === 1) bogeys++;
      else doublePlus++;

      // Raw strokes vs par (gross)
      const grossDiff = (h.strokes ?? 0) - h.par;
      if (grossDiff < 0) strokesUnderPar++;
      else if (grossDiff === 0) strokesAtPar++;
      else if (grossDiff === 1) strokesOverOne++;
      else if (grossDiff === 2) strokesOverTwo++;
      else strokesOverThreePlus++;

      // Per-par-type averages
      if (h.par === 3) {
        par3PointsTotal += h.points;
        par3StrokesTotal += h.strokes ?? 0;
        par3Count++;
      } else if (h.par === 4) {
        par4PointsTotal += h.points;
        par4StrokesTotal += h.strokes ?? 0;
        par4Count++;
      } else if (h.par >= 5) {
        par5PointsTotal += h.points;
        par5StrokesTotal += h.strokes ?? 0;
        par5Count++;
      }
    }

    // Best round (by points)
    if (bestRoundPoints === null || viewerPoints > bestRoundPoints) {
      bestRoundPoints = viewerPoints;
      bestRoundCourse = courseName;
      bestRoundCode = roomCode;
      bestRoundStrokes = viewerStrokes;
    }

    // Best round (by fewest strokes, only full rounds)
    if (played.length === holes.length) {
      if (bestStrokesRoundStrokes === null || viewerStrokes < bestStrokesRoundStrokes) {
        bestStrokesRoundStrokes = viewerStrokes;
        bestStrokesRoundCourse = courseName;
        bestStrokesRoundCode = roomCode;
      }
    }

    // Course stats
    const existing = courseMap.get(courseId);
    if (existing) {
      existing.points.push(viewerPoints);
      existing.strokes.push(viewerStrokes);
    } else {
      courseMap.set(courseId, {
        courseId,
        courseName,
        courseLocation,
        points: [viewerPoints],
        strokes: [viewerStrokes],
        coursePar,
      });
    }

    // Recent rounds (all of them, sorted desc already)
    recentRounds.push({
      roomCode,
      courseName,
      completedAt,
      totalPoints: viewerPoints,
      totalStrokes: viewerStrokes,
      position,
      playerCount,
      coursePar,
    });
  }

  // Build course stats
  const courseStats = Array.from(courseMap.values())
    .map((c) => ({
      courseId: c.courseId,
      courseName: c.courseName,
      courseLocation: c.courseLocation,
      timesPlayed: c.points.length,
      avgPoints: Math.round((c.points.reduce((a, b) => a + b, 0) / c.points.length) * 10) / 10,
      bestPoints: Math.max(...c.points),
      avgStrokes: Math.round((c.strokes.reduce((a, b) => a + b, 0) / c.strokes.length) * 10) / 10,
      bestStrokes: Math.min(...c.strokes),
      coursePar: c.coursePar,
    }))
    .sort((a, b) => b.timesPlayed - a.timesPlayed);

  const totalRounds = roundRows.length;

  return {
    totalRounds,
    wins,
    totalHolesPlayed,
    eagles,
    birdies,
    pars,
    bogeys,
    doublePlus,
    strokesUnderPar,
    strokesAtPar,
    strokesOverOne,
    strokesOverTwo,
    strokesOverThreePlus,
    par3AvgPoints: par3Count > 0 ? Math.round((par3PointsTotal / par3Count) * 10) / 10 : null,
    par4AvgPoints: par4Count > 0 ? Math.round((par4PointsTotal / par4Count) * 10) / 10 : null,
    par5AvgPoints: par5Count > 0 ? Math.round((par5PointsTotal / par5Count) * 10) / 10 : null,
    par3AvgStrokes: par3Count > 0 ? Math.round((par3StrokesTotal / par3Count) * 10) / 10 : null,
    par4AvgStrokes: par4Count > 0 ? Math.round((par4StrokesTotal / par4Count) * 10) / 10 : null,
    par5AvgStrokes: par5Count > 0 ? Math.round((par5StrokesTotal / par5Count) * 10) / 10 : null,
    bestRoundPoints,
    bestRoundCourse,
    bestRoundCode,
    bestRoundStrokes,
    bestStrokesRoundStrokes,
    bestStrokesRoundCourse,
    bestStrokesRoundCode,
    avgPointsPerRound:
      totalRounds > 0 ? Math.round((totalPointsAll / totalRounds) * 10) / 10 : null,
    avgStrokesPerRound:
      totalRounds > 0 ? Math.round((totalStrokesAll / totalRounds) * 10) / 10 : null,
    courseStats,
    recentRounds: recentRounds.slice(0, 20),
  };
}
