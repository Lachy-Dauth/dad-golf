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

// ================================================================
// Group Stats
// ================================================================

export interface GroupMemberStats {
  playerId: string; // group_member id or player name key
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
  // Get all completed rounds for this group
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

  // Batch-fetch all players and scores
  const { rows: allPlayerRows } = await pool.query(
    `SELECT id, round_id, user_id, name, handicap FROM players WHERE round_id = ANY($1)`,
    [roundIds],
  );
  const { rows: allScoreRows } = await pool.query(
    `SELECT id, round_id, player_id, hole_number, strokes, created_at FROM scores WHERE round_id = ANY($1)`,
    [roundIds],
  );

  // Index by round
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

  // Accumulate per-member stats (keyed by userId for registered users, name for guests)
  const memberMap = new Map<
    string,
    GroupMemberStats & { _pointsList: number[]; _strokesList: number[] }
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
        _pointsList: [],
        _strokesList: [],
      };
      memberMap.set(key, m);
    }
    return m;
  }

  // Track records
  let recordBestPoints: GroupRecord | null = null;
  let recordMostEagles: {
    playerName: string;
    count: number;
    roomCode: string;
    courseName: string;
    date: string;
  } | null = null;
  let recordBestStrokes: GroupRecord | null = null;

  // Course aggregation
  const courseAgg = new Map<
    string,
    { courseId: string; courseName: string; points: number[]; strokes: number[] }
  >();

  const recentRounds: GroupStatsResult["recentRounds"] = [];
  let totalHolesPlayed = 0;

  for (const row of roundRows as Record<string, unknown>[]) {
    const roundId = row.round_id as string;
    const roomCode = row.room_code as string;
    const courseName = row.course_name as string;
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
    const coursePar = holes.reduce((sum, h) => sum + h.par, 0);

    const players = playersByRound.get(roundId) ?? [];
    const scores = scoresByRound.get(roundId) ?? [];

    // Compute each player's results
    let roundWinner: { name: string; points: number } | null = null;

    for (const player of players) {
      const playerHoles = computePlayerHoles(
        course,
        { ...player, joinedAt: "", isGuest: false },
        scores,
      );
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
        m.bestRoundCode = roomCode;
      }
      if (m.bestStrokes === 0 || (played.length === holes.length && strk < m.bestStrokes)) {
        m.bestStrokes = strk;
        m.bestStrokesRoundCode = roomCode;
      }

      // Score distribution (Stableford)
      let roundEagles = 0;
      for (const h of played) {
        if (h.points >= 4) {
          m.eagles++;
          roundEagles++;
        } else if (h.points === 3) m.birdies++;
        else if (h.points === 2) m.pars++;
        else if (h.points === 1) m.bogeys++;
        else m.doublePlus++;

        const grossDiff = (h.strokes ?? 0) - h.par;
        if (grossDiff < 0) m.strokesUnderPar++;
        else if (grossDiff === 0) m.strokesAtPar++;
        else if (grossDiff === 1) m.strokesOverOne++;
        else if (grossDiff === 2) m.strokesOverTwo++;
        else m.strokesOverThreePlus++;
      }

      totalHolesPlayed += played.length;

      if (!roundWinner || pts > roundWinner.points) {
        roundWinner = { name: player.name, points: pts };
      }

      // Track records
      if (!recordBestPoints || pts > recordBestPoints.value) {
        recordBestPoints = {
          type: "best_points",
          value: pts,
          playerName: player.name,
          courseName,
          roomCode,
          date: completedAt,
        };
      }
      if (
        played.length === holes.length &&
        (!recordBestStrokes || strk < recordBestStrokes.value)
      ) {
        recordBestStrokes = {
          type: "best_strokes",
          value: strk,
          playerName: player.name,
          courseName,
          roomCode,
          date: completedAt,
        };
      }
      if (!recordMostEagles || roundEagles > recordMostEagles.count) {
        recordMostEagles = {
          playerName: player.name,
          count: roundEagles,
          roomCode,
          courseName,
          date: completedAt,
        };
      }
    }

    // Mark winner
    if (roundWinner) {
      for (const player of players) {
        const playerHoles = computePlayerHoles(
          course,
          { ...player, joinedAt: "", isGuest: false },
          scores,
        );
        const played = playerHoles.filter((h) => h.strokes != null);
        const pts = played.reduce((sum, h) => sum + h.points, 0);
        if (pts === roundWinner.points) {
          const { key } = getMemberKey(player.userId, player.name);
          const m = memberMap.get(key);
          if (m) m.wins++;
        }
      }
    }

    // Course aggregation
    const courseEntry = courseAgg.get(courseId);
    const roundTotalPoints = roundWinner?.points ?? 0;
    if (courseEntry) {
      courseEntry.points.push(roundTotalPoints);
    } else {
      courseAgg.set(courseId, { courseId, courseName, points: [roundTotalPoints], strokes: [] });
    }

    recentRounds.push({
      roomCode,
      courseName,
      completedAt,
      winnerName: roundWinner?.name ?? null,
      winnerPoints: roundWinner?.points ?? null,
      playerCount,
      coursePar,
    });
  }

  // Finalize member stats
  const memberStats = Array.from(memberMap.values()).map((m) => {
    const { _pointsList, _strokesList, ...rest } = m;
    return {
      ...rest,
      avgPoints: m.roundsPlayed > 0 ? Math.round((m.totalPoints / m.roundsPlayed) * 10) / 10 : 0,
      avgStrokes: m.roundsPlayed > 0 ? Math.round((m.totalStrokes / m.roundsPlayed) * 10) / 10 : 0,
    };
  });
  // Sort by total points desc
  memberStats.sort((a, b) => {
    if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
    return b.wins - a.wins;
  });

  // Records
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

  // Course stats
  const courseStats = Array.from(courseAgg.values())
    .map((c) => ({
      courseId: c.courseId,
      courseName: c.courseName,
      timesPlayed: c.points.length,
      avgPoints: Math.round((c.points.reduce((a, b) => a + b, 0) / c.points.length) * 10) / 10,
      avgStrokes:
        c.strokes.length > 0
          ? Math.round((c.strokes.reduce((a, b) => a + b, 0) / c.strokes.length) * 10) / 10
          : 0,
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
