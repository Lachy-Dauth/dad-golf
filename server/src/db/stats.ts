import type { Course } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";
import { pool } from "./pool.js";
import {
  indexPlayersByRound,
  indexScoresByRound,
  accumulateHoleStats,
  emptyDistribution,
  emptyParAccumulator,
  parAvg,
  round1,
  type IndexedPlayer,
  type ScoringDistribution,
  type ParTypeAccumulator,
} from "./statsHelpers.js";

export interface UserStatsResult {
  totalRounds: number;
  wins: number;
  totalHolesPlayed: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
  par3AvgPoints: number | null;
  par4AvgPoints: number | null;
  par5AvgPoints: number | null;
  par3AvgStrokes: number | null;
  par4AvgStrokes: number | null;
  par5AvgStrokes: number | null;
  bestRoundPoints: number | null;
  bestRoundCourse: string | null;
  bestRoundCode: string | null;
  bestRoundStrokes: number | null;
  bestStrokesRoundStrokes: number | null;
  bestStrokesRoundCourse: string | null;
  bestStrokesRoundCode: string | null;
  avgPointsPerRound: number | null;
  avgStrokesPerRound: number | null;
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

function emptyUserStats(): UserStatsResult {
  return {
    totalRounds: 0,
    wins: 0,
    totalHolesPlayed: 0,
    ...emptyDistribution(),
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

function parseRoundRow(row: Record<string, unknown>) {
  const holes = JSON.parse(row.holes_json as string) as Array<{
    number: number;
    par: number;
    strokeIndex: number;
  }>;
  return {
    roundId: row.round_id as string,
    roomCode: row.room_code as string,
    courseName: row.course_name as string,
    courseLocation: (row.course_location as string | null) ?? null,
    courseId: row.course_id as string,
    completedAt: row.completed_at as string,
    playerCount: Number(row.player_count ?? 0),
    holes,
    course: {
      holes,
      slope: Number(row.course_slope),
      rating: Number(row.course_rating),
    } as Course,
    coursePar: holes.reduce((sum, h) => sum + h.par, 0),
  };
}

function asPlayer(p: IndexedPlayer) {
  return { ...p, joinedAt: "", isGuest: false };
}

async function fetchRoundData(roundIds: string[]) {
  const { rows: allPlayerRows } = await pool.query(
    `SELECT id, round_id, user_id, name, handicap, gender FROM players WHERE round_id = ANY($1)`,
    [roundIds],
  );
  const { rows: allScoreRows } = await pool.query(
    `SELECT id, round_id, player_id, hole_number, strokes, created_at FROM scores WHERE round_id = ANY($1)`,
    [roundIds],
  );
  return {
    playersByRound: indexPlayersByRound(allPlayerRows as Record<string, unknown>[]),
    scoresByRound: indexScoresByRound(allScoreRows as Record<string, unknown>[]),
  };
}

export async function getUserStats(userId: string): Promise<UserStatsResult> {
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

  if (roundRows.length === 0) return emptyUserStats();

  const roundIds = roundRows.map((r) => (r as Record<string, unknown>).round_id as string);
  const { playersByRound, scoresByRound } = await fetchRoundData(roundIds);

  const dist: ScoringDistribution = emptyDistribution();
  const parAcc: ParTypeAccumulator = emptyParAccumulator();

  let wins = 0;
  let totalHolesPlayed = 0;
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

  for (const rawRow of roundRows as Record<string, unknown>[]) {
    const row = parseRoundRow(rawRow);
    const players = playersByRound.get(row.roundId) ?? [];
    const scores = scoresByRound.get(row.roundId) ?? [];

    const viewerPlayer = players.find((p) => p.userId === userId);
    if (!viewerPlayer) continue;

    const playerHoles = computePlayerHoles(row.course, asPlayer(viewerPlayer), scores);
    const played = playerHoles.filter((h) => h.strokes != null);
    const viewerPoints = played.reduce((sum, h) => sum + h.points, 0);
    const viewerStrokes = played.reduce((sum, h) => sum + (h.strokes || 0), 0);

    const allPlayerPoints = players.map((p) => {
      const ph = computePlayerHoles(row.course, asPlayer(p), scores);
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

    accumulateHoleStats(played, dist, parAcc);

    if (bestRoundPoints === null || viewerPoints > bestRoundPoints) {
      bestRoundPoints = viewerPoints;
      bestRoundCourse = row.courseName;
      bestRoundCode = row.roomCode;
      bestRoundStrokes = viewerStrokes;
    }

    if (played.length === row.holes.length) {
      if (bestStrokesRoundStrokes === null || viewerStrokes < bestStrokesRoundStrokes) {
        bestStrokesRoundStrokes = viewerStrokes;
        bestStrokesRoundCourse = row.courseName;
        bestStrokesRoundCode = row.roomCode;
      }
    }

    const existing = courseMap.get(row.courseId);
    if (existing) {
      existing.points.push(viewerPoints);
      existing.strokes.push(viewerStrokes);
    } else {
      courseMap.set(row.courseId, {
        courseId: row.courseId,
        courseName: row.courseName,
        courseLocation: row.courseLocation,
        points: [viewerPoints],
        strokes: [viewerStrokes],
        coursePar: row.coursePar,
      });
    }

    recentRounds.push({
      roomCode: row.roomCode,
      courseName: row.courseName,
      completedAt: row.completedAt,
      totalPoints: viewerPoints,
      totalStrokes: viewerStrokes,
      position,
      playerCount: row.playerCount,
      coursePar: row.coursePar,
    });
  }

  const courseStats = Array.from(courseMap.values())
    .map((c) => ({
      courseId: c.courseId,
      courseName: c.courseName,
      courseLocation: c.courseLocation,
      timesPlayed: c.points.length,
      avgPoints: round1(c.points.reduce((a, b) => a + b, 0) / c.points.length),
      bestPoints: Math.max(...c.points),
      avgStrokes: round1(c.strokes.reduce((a, b) => a + b, 0) / c.strokes.length),
      bestStrokes: Math.min(...c.strokes),
      coursePar: c.coursePar,
    }))
    .sort((a, b) => b.timesPlayed - a.timesPlayed);

  const totalRounds = roundRows.length;

  return {
    totalRounds,
    wins,
    totalHolesPlayed,
    ...dist,
    par3AvgPoints: parAvg(parAcc.par3Pts, parAcc.par3Count),
    par4AvgPoints: parAvg(parAcc.par4Pts, parAcc.par4Count),
    par5AvgPoints: parAvg(parAcc.par5Pts, parAcc.par5Count),
    par3AvgStrokes: parAvg(parAcc.par3Strk, parAcc.par3Count),
    par4AvgStrokes: parAvg(parAcc.par4Strk, parAcc.par4Count),
    par5AvgStrokes: parAvg(parAcc.par5Strk, parAcc.par5Count),
    bestRoundPoints,
    bestRoundCourse,
    bestRoundCode,
    bestRoundStrokes,
    bestStrokesRoundStrokes,
    bestStrokesRoundCourse,
    bestStrokesRoundCode,
    avgPointsPerRound: totalRounds > 0 ? round1(totalPointsAll / totalRounds) : null,
    avgStrokesPerRound: totalRounds > 0 ? round1(totalStrokesAll / totalRounds) : null,
    courseStats,
    recentRounds: recentRounds.slice(0, 20),
  };
}

// ================================================================
// Group Stats
// ================================================================

export interface GroupMemberStats {
  playerId: string;
  playerName: string;
  userId: string | null;
  roundsPlayed: number;
  wins: number;
  totalPoints: number;
  avgPoints: number;
  bestPoints: number;
  bestRoundCode: string | null;
  totalStrokes: number;
  avgStrokes: number;
  bestStrokes: number;
  bestStrokesRoundCode: string | null;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
}

export interface GroupRecord {
  type: string;
  value: number;
  playerName: string;
  courseName: string;
  roomCode: string;
  date: string;
}

export interface GroupStatsResult {
  totalRounds: number;
  totalHolesPlayed: number;
  memberStats: GroupMemberStats[];
  records: GroupRecord[];
  courseStats: Array<{
    courseId: string;
    courseName: string;
    timesPlayed: number;
    avgPoints: number;
    avgStrokes: number;
  }>;
  recentRounds: Array<{
    roomCode: string;
    courseName: string;
    completedAt: string;
    winnerName: string | null;
    winnerPoints: number | null;
    playerCount: number;
    coursePar: number;
  }>;
}

export async function getGroupStats(groupId: string): Promise<GroupStatsResult> {
  const { rows: roundRows } = await pool.query(
    `SELECT r.id AS round_id, r.room_code,
            c.name AS course_name, c.id AS course_id,
            c.rating AS course_rating, c.slope AS course_slope, c.holes_json,
            r.completed_at,
            (SELECT COUNT(*)::int FROM players p2 WHERE p2.round_id = r.id) AS player_count
     FROM rounds r
     JOIN courses c ON c.id = r.course_id
     WHERE r.status = 'complete' AND r.group_id = $1
     ORDER BY r.completed_at DESC`,
    [groupId],
  );

  if (roundRows.length === 0) {
    return {
      totalRounds: 0,
      totalHolesPlayed: 0,
      memberStats: [],
      records: [],
      courseStats: [],
      recentRounds: [],
    };
  }

  const roundIds = roundRows.map((r) => (r as Record<string, unknown>).round_id as string);
  const { playersByRound, scoresByRound } = await fetchRoundData(roundIds);

  const memberMap = new Map<
    string,
    GroupMemberStats & { _dist: ScoringDistribution; _pointsList: number[]; _strokesList: number[] }
  >();

  function getMemberKey(
    userId: string | null,
    name: string,
  ): { key: string; userId: string | null } {
    if (userId) return { key: `user:${userId}`, userId };
    return { key: `guest:${name}`, userId: null };
  }

  function getOrCreateMember(key: string, name: string, userId: string | null) {
    let m = memberMap.get(key);
    if (!m) {
      m = {
        playerId: key,
        playerName: name,
        userId,
        roundsPlayed: 0,
        wins: 0,
        totalPoints: 0,
        avgPoints: 0,
        bestPoints: 0,
        bestRoundCode: null,
        totalStrokes: 0,
        avgStrokes: 0,
        bestStrokes: 0,
        bestStrokesRoundCode: null,
        ...emptyDistribution(),
        _dist: emptyDistribution(),
        _pointsList: [],
        _strokesList: [],
      };
      memberMap.set(key, m);
    }
    return m;
  }

  let recordBestPoints: GroupRecord | null = null;
  let recordMostEagles: {
    playerName: string;
    count: number;
    roomCode: string;
    courseName: string;
    date: string;
  } | null = null;
  let recordBestStrokes: GroupRecord | null = null;

  const courseAgg = new Map<
    string,
    { courseId: string; courseName: string; points: number[]; strokes: number[] }
  >();

  const recentRounds: GroupStatsResult["recentRounds"] = [];
  let totalHolesPlayed = 0;

  for (const rawRow of roundRows as Record<string, unknown>[]) {
    const row = parseRoundRow(rawRow);
    const players = playersByRound.get(row.roundId) ?? [];
    const scores = scoresByRound.get(row.roundId) ?? [];

    let roundWinner: { name: string; points: number } | null = null;

    for (const player of players) {
      const playerHoles = computePlayerHoles(row.course, asPlayer(player), scores);
      const played = playerHoles.filter((h) => h.strokes != null);
      if (played.length === 0) continue;

      const pts = played.reduce((sum, h) => sum + h.points, 0);
      const strk = played.reduce((sum, h) => sum + (h.strokes || 0), 0);

      const { key, userId } = getMemberKey(player.userId, player.name);
      const m = getOrCreateMember(key, player.name, userId);
      m.roundsPlayed++;
      m.totalPoints += pts;
      m.totalStrokes += strk;
      m._pointsList.push(pts);
      m._strokesList.push(strk);

      if (pts > m.bestPoints) {
        m.bestPoints = pts;
        m.bestRoundCode = row.roomCode;
      }
      if (m.bestStrokes === 0 || (played.length === row.holes.length && strk < m.bestStrokes)) {
        m.bestStrokes = strk;
        m.bestStrokesRoundCode = row.roomCode;
      }

      let roundEagles = 0;
      const parAcc = emptyParAccumulator();
      accumulateHoleStats(played, m._dist, parAcc);
      roundEagles = played.filter((h) => h.points >= 4).length;

      totalHolesPlayed += played.length;

      if (!roundWinner || pts > roundWinner.points) {
        roundWinner = { name: player.name, points: pts };
      }

      if (!recordBestPoints || pts > recordBestPoints.value) {
        recordBestPoints = {
          type: "best_points",
          value: pts,
          playerName: player.name,
          courseName: row.courseName,
          roomCode: row.roomCode,
          date: row.completedAt,
        };
      }
      if (
        played.length === row.holes.length &&
        (!recordBestStrokes || strk < recordBestStrokes.value)
      ) {
        recordBestStrokes = {
          type: "best_strokes",
          value: strk,
          playerName: player.name,
          courseName: row.courseName,
          roomCode: row.roomCode,
          date: row.completedAt,
        };
      }
      if (!recordMostEagles || roundEagles > recordMostEagles.count) {
        recordMostEagles = {
          playerName: player.name,
          count: roundEagles,
          roomCode: row.roomCode,
          courseName: row.courseName,
          date: row.completedAt,
        };
      }
    }

    if (roundWinner) {
      for (const player of players) {
        const playerHoles = computePlayerHoles(row.course, asPlayer(player), scores);
        const played = playerHoles.filter((h) => h.strokes != null);
        const pts = played.reduce((sum, h) => sum + h.points, 0);
        if (pts === roundWinner.points) {
          const { key } = getMemberKey(player.userId, player.name);
          const m = memberMap.get(key);
          if (m) m.wins++;
        }
      }
    }

    const courseEntry = courseAgg.get(row.courseId);
    const roundTotalPoints = roundWinner?.points ?? 0;
    if (courseEntry) {
      courseEntry.points.push(roundTotalPoints);
    } else {
      courseAgg.set(row.courseId, {
        courseId: row.courseId,
        courseName: row.courseName,
        points: [roundTotalPoints],
        strokes: [],
      });
    }

    recentRounds.push({
      roomCode: row.roomCode,
      courseName: row.courseName,
      completedAt: row.completedAt,
      winnerName: roundWinner?.name ?? null,
      winnerPoints: roundWinner?.points ?? null,
      playerCount: row.playerCount,
      coursePar: row.coursePar,
    });
  }

  const memberStats = Array.from(memberMap.values()).map((m) => {
    const { _dist, _pointsList, _strokesList, ...rest } = m;
    return {
      ...rest,
      ..._dist,
      avgPoints: m.roundsPlayed > 0 ? round1(m.totalPoints / m.roundsPlayed) : 0,
      avgStrokes: m.roundsPlayed > 0 ? round1(m.totalStrokes / m.roundsPlayed) : 0,
    };
  });
  memberStats.sort((a, b) => {
    if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
    return b.wins - a.wins;
  });

  const records: GroupRecord[] = [];
  if (recordBestPoints) records.push(recordBestPoints);
  if (recordBestStrokes) records.push(recordBestStrokes);
  if (recordMostEagles && recordMostEagles.count > 0) {
    records.push({
      type: "most_eagles_round",
      value: recordMostEagles.count,
      playerName: recordMostEagles.playerName,
      courseName: recordMostEagles.courseName,
      roomCode: recordMostEagles.roomCode,
      date: recordMostEagles.date,
    });
  }

  const courseStats = Array.from(courseAgg.values())
    .map((c) => ({
      courseId: c.courseId,
      courseName: c.courseName,
      timesPlayed: c.points.length,
      avgPoints: round1(c.points.reduce((a, b) => a + b, 0) / c.points.length),
      avgStrokes:
        c.strokes.length > 0 ? round1(c.strokes.reduce((a, b) => a + b, 0) / c.strokes.length) : 0,
    }))
    .sort((a, b) => b.timesPlayed - a.timesPlayed);

  return {
    totalRounds: roundRows.length,
    totalHolesPlayed,
    memberStats,
    records,
    courseStats,
    recentRounds: recentRounds.slice(0, 20),
  };
}

// ================================================================
// Head-to-Head Comparison
// ================================================================

interface H2HPlayerStats {
  userId: string;
  displayName: string;
  wins: number;
  totalPoints: number;
  avgPoints: number;
  bestPoints: number;
  totalStrokes: number;
  avgStrokes: number;
  bestStrokes: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
  par3AvgPoints: number | null;
  par4AvgPoints: number | null;
  par5AvgPoints: number | null;
  par3AvgStrokes: number | null;
  par4AvgStrokes: number | null;
  par5AvgStrokes: number | null;
}

export interface HeadToHeadResult {
  sharedRounds: number;
  draws: number;
  player1: H2HPlayerStats;
  player2: H2HPlayerStats;
  rounds: Array<{
    roomCode: string;
    courseName: string;
    completedAt: string;
    coursePar: number;
    p1Points: number;
    p1Strokes: number;
    p2Points: number;
    p2Strokes: number;
    winnerId: string | null;
  }>;
}

export async function getHeadToHead(
  userId1: string,
  displayName1: string,
  userId2: string,
  displayName2: string,
): Promise<HeadToHeadResult> {
  const { rows: roundRows } = await pool.query(
    `SELECT r.id AS round_id, r.room_code,
            c.name AS course_name, c.id AS course_id,
            c.rating AS course_rating, c.slope AS course_slope, c.holes_json,
            r.completed_at
     FROM rounds r
     JOIN courses c ON c.id = r.course_id
     WHERE r.status = 'complete'
       AND EXISTS (SELECT 1 FROM players p1 WHERE p1.round_id = r.id AND p1.user_id = $1)
       AND EXISTS (SELECT 1 FROM players p2 WHERE p2.round_id = r.id AND p2.user_id = $2)
     ORDER BY r.completed_at DESC`,
    [userId1, userId2],
  );

  const emptyStats = (userId: string, displayName: string): H2HPlayerStats => ({
    userId,
    displayName,
    wins: 0,
    totalPoints: 0,
    avgPoints: 0,
    bestPoints: 0,
    totalStrokes: 0,
    avgStrokes: 0,
    bestStrokes: 0,
    ...emptyDistribution(),
    par3AvgPoints: null,
    par4AvgPoints: null,
    par5AvgPoints: null,
    par3AvgStrokes: null,
    par4AvgStrokes: null,
    par5AvgStrokes: null,
  });

  if (roundRows.length === 0) {
    return {
      sharedRounds: 0,
      draws: 0,
      player1: emptyStats(userId1, displayName1),
      player2: emptyStats(userId2, displayName2),
      rounds: [],
    };
  }

  const roundIds = roundRows.map((r) => (r as Record<string, unknown>).round_id as string);
  const { playersByRound, scoresByRound } = await fetchRoundData(roundIds);

  const p1 = emptyStats(userId1, displayName1);
  const p2 = emptyStats(userId2, displayName2);
  let draws = 0;

  const p1ParAcc = emptyParAccumulator();
  const p2ParAcc = emptyParAccumulator();

  const roundHistory: HeadToHeadResult["rounds"] = [];

  for (const rawRow of roundRows as Record<string, unknown>[]) {
    const row = parseRoundRow(rawRow);
    const players = playersByRound.get(row.roundId) ?? [];
    const scores = scoresByRound.get(row.roundId) ?? [];

    const player1Rec = players.find((p) => p.userId === userId1);
    const player2Rec = players.find((p) => p.userId === userId2);
    if (!player1Rec || !player2Rec) continue;

    const p1Holes = computePlayerHoles(row.course, asPlayer(player1Rec), scores);
    const p2Holes = computePlayerHoles(row.course, asPlayer(player2Rec), scores);

    const p1Played = p1Holes.filter((h) => h.strokes != null);
    const p2Played = p2Holes.filter((h) => h.strokes != null);

    const p1Pts = p1Played.reduce((sum, h) => sum + h.points, 0);
    const p1Strk = p1Played.reduce((sum, h) => sum + (h.strokes || 0), 0);
    const p2Pts = p2Played.reduce((sum, h) => sum + h.points, 0);
    const p2Strk = p2Played.reduce((sum, h) => sum + (h.strokes || 0), 0);

    let winnerId: string | null = null;
    if (p1Pts > p2Pts) {
      p1.wins++;
      winnerId = userId1;
    } else if (p2Pts > p1Pts) {
      p2.wins++;
      winnerId = userId2;
    } else {
      draws++;
    }

    p1.totalPoints += p1Pts;
    p1.totalStrokes += p1Strk;
    if (p1Pts > p1.bestPoints) p1.bestPoints = p1Pts;
    if (p1.bestStrokes === 0 || (p1Played.length === row.holes.length && p1Strk < p1.bestStrokes)) {
      p1.bestStrokes = p1Strk;
    }

    p2.totalPoints += p2Pts;
    p2.totalStrokes += p2Strk;
    if (p2Pts > p2.bestPoints) p2.bestPoints = p2Pts;
    if (p2.bestStrokes === 0 || (p2Played.length === row.holes.length && p2Strk < p2.bestStrokes)) {
      p2.bestStrokes = p2Strk;
    }

    accumulateHoleStats(p1Played, p1, p1ParAcc);
    accumulateHoleStats(p2Played, p2, p2ParAcc);

    roundHistory.push({
      roomCode: row.roomCode,
      courseName: row.courseName,
      completedAt: row.completedAt,
      coursePar: row.coursePar,
      p1Points: p1Pts,
      p1Strokes: p1Strk,
      p2Points: p2Pts,
      p2Strokes: p2Strk,
      winnerId,
    });
  }

  const sharedRounds = roundHistory.length;

  p1.avgPoints = sharedRounds > 0 ? round1(p1.totalPoints / sharedRounds) : 0;
  p1.avgStrokes = sharedRounds > 0 ? round1(p1.totalStrokes / sharedRounds) : 0;
  p1.par3AvgPoints = parAvg(p1ParAcc.par3Pts, p1ParAcc.par3Count);
  p1.par4AvgPoints = parAvg(p1ParAcc.par4Pts, p1ParAcc.par4Count);
  p1.par5AvgPoints = parAvg(p1ParAcc.par5Pts, p1ParAcc.par5Count);
  p1.par3AvgStrokes = parAvg(p1ParAcc.par3Strk, p1ParAcc.par3Count);
  p1.par4AvgStrokes = parAvg(p1ParAcc.par4Strk, p1ParAcc.par4Count);
  p1.par5AvgStrokes = parAvg(p1ParAcc.par5Strk, p1ParAcc.par5Count);

  p2.avgPoints = sharedRounds > 0 ? round1(p2.totalPoints / sharedRounds) : 0;
  p2.avgStrokes = sharedRounds > 0 ? round1(p2.totalStrokes / sharedRounds) : 0;
  p2.par3AvgPoints = parAvg(p2ParAcc.par3Pts, p2ParAcc.par3Count);
  p2.par4AvgPoints = parAvg(p2ParAcc.par4Pts, p2ParAcc.par4Count);
  p2.par5AvgPoints = parAvg(p2ParAcc.par5Pts, p2ParAcc.par5Count);
  p2.par3AvgStrokes = parAvg(p2ParAcc.par3Strk, p2ParAcc.par3Count);
  p2.par4AvgStrokes = parAvg(p2ParAcc.par4Strk, p2ParAcc.par4Count);
  p2.par5AvgStrokes = parAvg(p2ParAcc.par5Strk, p2ParAcc.par5Count);

  return {
    sharedRounds,
    draws,
    player1: p1,
    player2: p2,
    rounds: roundHistory,
  };
}

export async function getOpponents(
  userId: string,
): Promise<Array<{ userId: string; displayName: string; username: string; sharedRounds: number }>> {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.display_name, u.username, COUNT(DISTINCT r.id)::int AS shared_rounds
     FROM players p1
     JOIN rounds r ON r.id = p1.round_id AND r.status = 'complete'
     JOIN players p2 ON p2.round_id = r.id AND p2.user_id IS NOT NULL AND p2.user_id != $1
     JOIN users u ON u.id = p2.user_id
     WHERE p1.user_id = $1
     GROUP BY u.id, u.display_name, u.username
     ORDER BY shared_rounds DESC, u.display_name ASC`,
    [userId],
  );
  return (
    rows as Array<{
      user_id: string;
      display_name: string;
      username: string;
      shared_rounds: number;
    }>
  ).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    username: r.username,
    sharedRounds: r.shared_rounds,
  }));
}
