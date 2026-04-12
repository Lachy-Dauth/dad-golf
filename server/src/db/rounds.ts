import type { Round, RoundStatus } from "@dad-golf/shared";
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
