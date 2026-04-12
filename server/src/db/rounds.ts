import type { Round, RoundStatus, RoundSummary, Player, Score, Course } from "@dad-golf/shared";
import { computeLeaderboard } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";
import { getUser } from "./users.js";

export async function createRound(
  roomCode: string,
  courseId: string,
  groupId: string | null,
  leaderUserId: string,
): Promise<Round> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO rounds (id, room_code, course_id, group_id, status, current_hole, created_at, leader_user_id)
     VALUES ($1, $2, $3, $4, 'waiting', 1, $5, $6)`,
    [id, roomCode, courseId, groupId, createdAt, leaderUserId],
  );
  const leader = await getUser(leaderUserId);
  return {
    id,
    roomCode,
    courseId,
    groupId,
    status: "waiting",
    currentHole: 1,
    createdAt,
    startedAt: null,
    completedAt: null,
    leaderUserId,
    leaderName: leader?.displayName ?? null,
  };
}

interface RoundRow {
  id: string;
  room_code: string;
  course_id: string;
  group_id: string | null;
  status: RoundStatus;
  current_hole: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  leader_user_id: string | null;
}

interface RoundListRow extends RoundRow {
  leader_name: string | null;
}

function rowToRound(row: RoundListRow): Round {
  return {
    id: row.id,
    roomCode: row.room_code,
    courseId: row.course_id,
    groupId: row.group_id,
    status: row.status,
    currentHole: Number(row.current_hole),
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    leaderUserId: row.leader_user_id,
    leaderName: row.leader_name,
  };
}

export async function getRoundByRoomCode(roomCode: string): Promise<Round | null> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.leader_user_id
       WHERE r.room_code = $1`,
    [roomCode],
  );
  const row = rows[0] as RoundListRow | undefined;
  return row ? rowToRound(row) : null;
}

export async function getRound(id: string): Promise<Round | null> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.leader_user_id
       WHERE r.id = $1`,
    [id],
  );
  const row = rows[0] as RoundListRow | undefined;
  return row ? rowToRound(row) : null;
}

export async function updateRoundStatus(id: string, status: RoundStatus): Promise<void> {
  if (status === "in_progress") {
    await pool.query(
      `UPDATE rounds SET status = $1, started_at = COALESCE(started_at, $2) WHERE id = $3`,
      [status, now(), id],
    );
  } else if (status === "complete") {
    await pool.query(`UPDATE rounds SET status = $1, completed_at = $2 WHERE id = $3`, [
      status,
      now(),
      id,
    ]);
  } else {
    await pool.query(`UPDATE rounds SET status = $1 WHERE id = $2`, [status, id]);
  }
}

export async function updateRoundCurrentHole(id: string, holeNumber: number): Promise<void> {
  await pool.query(`UPDATE rounds SET current_hole = $1 WHERE id = $2`, [holeNumber, id]);
}

export async function deleteRound(id: string): Promise<void> {
  await pool.query(`DELETE FROM rounds WHERE id = $1`, [id]);
}

export async function listRecentRounds(limit = 20): Promise<Round[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.leader_user_id
       ORDER BY r.created_at DESC LIMIT $1`,
    [limit],
  );
  return (rows as RoundListRow[]).map(rowToRound);
}

// ---- Round history queries ----

interface RoundHistoryRow extends RoundRow {
  leader_name: string | null;
  course_name: string;
  course_location: string | null;
  course_rating: number;
  course_slope: number;
  holes_json: string;
  player_count: number;
}

async function buildRoundSummaries(
  historyRows: RoundHistoryRow[],
  viewerUserId: string | null,
): Promise<RoundSummary[]> {
  if (historyRows.length === 0) return [];

  const roundIds = historyRows.map((row) => row.id);

  // Batch-fetch all players and scores for the page of rounds (2 queries total)
  const { rows: allPlayerRows } = await pool.query(
    `SELECT * FROM players WHERE round_id = ANY($1) ORDER BY joined_at ASC`,
    [roundIds],
  );
  const playersByRound = new Map<string, Player[]>();
  for (const p of allPlayerRows as Record<string, unknown>[]) {
    const roundId = p.round_id as string;
    const player: Player = {
      id: p.id as string,
      roundId,
      userId: p.user_id as string | null,
      name: p.name as string,
      handicap: Number(p.handicap),
      joinedAt: p.joined_at as string,
      isGuest: p.user_id === null,
    };
    const list = playersByRound.get(roundId);
    if (list) list.push(player);
    else playersByRound.set(roundId, [player]);
  }

  const { rows: allScoreRows } = await pool.query(
    `SELECT * FROM scores WHERE round_id = ANY($1) ORDER BY hole_number ASC`,
    [roundIds],
  );
  const scoresByRound = new Map<string, Score[]>();
  for (const s of allScoreRows as Record<string, unknown>[]) {
    const roundId = s.round_id as string;
    const score: Score = {
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

  const summaries: RoundSummary[] = [];
  for (const row of historyRows) {
    const round = rowToRound(row as unknown as RoundListRow);
    const holes = JSON.parse(row.holes_json) as {
      number: number;
      par: number;
      strokeIndex: number;
    }[];
    const course = {
      holes,
      slope: Number(row.course_slope),
      rating: Number(row.course_rating),
    } as Pick<Course, "holes" | "slope" | "rating"> as Course;

    const players = playersByRound.get(round.id) ?? [];
    const scores = scoresByRound.get(round.id) ?? [];

    const leaderboard = computeLeaderboard(course, players, scores);
    const winner = leaderboard[0] ?? null;

    let viewerPosition: number | null = null;
    let viewerPoints: number | null = null;
    if (viewerUserId) {
      const viewerPlayer = players.find((p) => p.userId === viewerUserId);
      if (viewerPlayer) {
        const viewerRow = leaderboard.find((r) => r.playerId === viewerPlayer.id);
        if (viewerRow) {
          viewerPosition = viewerRow.position;
          viewerPoints = viewerRow.totalPoints;
        }
      }
    }

    summaries.push({
      roomCode: round.roomCode,
      courseName: row.course_name,
      courseLocation: row.course_location,
      date: round.completedAt ?? round.startedAt ?? round.createdAt,
      playerCount: Number(row.player_count),
      winnerName: winner?.name ?? null,
      viewerPosition,
      viewerPoints,
    });
  }
  return summaries;
}

export async function listUserCompletedRounds(
  userId: string,
  viewerUserId: string | null,
  limit: number,
  offset: number,
): Promise<{ rounds: RoundSummary[]; total: number }> {
  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT r.id)::int AS total
     FROM rounds r
     JOIN players p ON p.round_id = r.id
     WHERE r.status = 'complete' AND p.user_id = $1`,
    [userId],
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name,
            c.name AS course_name, c.location AS course_location,
            c.rating AS course_rating, c.slope AS course_slope, c.holes_json,
            (SELECT COUNT(*)::int FROM players p2 WHERE p2.round_id = r.id) AS player_count
     FROM rounds r
     LEFT JOIN users u ON u.id = r.leader_user_id
     JOIN courses c ON c.id = r.course_id
     WHERE r.status = 'complete'
       AND EXISTS (SELECT 1 FROM players p WHERE p.round_id = r.id AND p.user_id = $1)
     ORDER BY r.completed_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  const rounds = await buildRoundSummaries(rows as RoundHistoryRow[], viewerUserId);
  return { rounds, total };
}

export async function listGroupCompletedRounds(
  groupId: string,
  viewerUserId: string | null,
  limit: number,
  offset: number,
): Promise<{ rounds: RoundSummary[]; total: number }> {
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM rounds WHERE status = 'complete' AND group_id = $1`,
    [groupId],
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name,
            c.name AS course_name, c.location AS course_location,
            c.rating AS course_rating, c.slope AS course_slope, c.holes_json,
            (SELECT COUNT(*)::int FROM players p2 WHERE p2.round_id = r.id) AS player_count
     FROM rounds r
     LEFT JOIN users u ON u.id = r.leader_user_id
     JOIN courses c ON c.id = r.course_id
     WHERE r.status = 'complete' AND r.group_id = $1
     ORDER BY r.completed_at DESC
     LIMIT $2 OFFSET $3`,
    [groupId, limit, offset],
  );

  const rounds = await buildRoundSummaries(rows as RoundHistoryRow[], viewerUserId);
  return { rounds, total };
}
