import type { Gender, Player } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

interface PlayerRow {
  id: string;
  round_id: string;
  user_id: string | null;
  name: string;
  handicap: number;
  gender: string;
  joined_at: string;
}

function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    roundId: row.round_id,
    userId: row.user_id,
    name: row.name,
    handicap: Number(row.handicap),
    gender: row.gender === "F" ? "F" : "M",
    joinedAt: row.joined_at,
    isGuest: row.user_id === null,
  };
}

async function resolveGender(userId: string | null): Promise<Gender> {
  if (!userId) return "M";
  const { rows } = await pool.query(`SELECT gender FROM users WHERE id = $1`, [userId]);
  return rows[0]?.gender === "F" ? "F" : "M";
}

export async function addPlayer(
  roundId: string,
  name: string,
  handicap: number,
  userId: string | null = null,
): Promise<Player> {
  const id = newId();
  const joinedAt = now();
  const gender = await resolveGender(userId);
  await pool.query(
    `INSERT INTO players (id, round_id, user_id, name, handicap, gender, joined_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, roundId, userId, name, handicap, gender, joinedAt],
  );
  return {
    id,
    roundId,
    userId,
    name,
    handicap,
    gender,
    joinedAt,
    isGuest: userId === null,
  };
}

export async function findPlayerByName(roundId: string, name: string): Promise<Player | null> {
  const { rows } = await pool.query(`SELECT * FROM players WHERE round_id = $1 AND name = $2`, [
    roundId,
    name,
  ]);
  const row = rows[0] as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export async function findPlayerByUserId(roundId: string, userId: string): Promise<Player | null> {
  const { rows } = await pool.query(`SELECT * FROM players WHERE round_id = $1 AND user_id = $2`, [
    roundId,
    userId,
  ]);
  const row = rows[0] as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export async function getPlayer(playerId: string): Promise<Player | null> {
  const { rows } = await pool.query(`SELECT * FROM players WHERE id = $1`, [playerId]);
  const row = rows[0] as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export async function listPlayers(roundId: string): Promise<Player[]> {
  const { rows } = await pool.query(
    `SELECT * FROM players WHERE round_id = $1 ORDER BY joined_at ASC`,
    [roundId],
  );
  return (rows as PlayerRow[]).map(rowToPlayer);
}

export async function updatePlayer(
  playerId: string,
  name: string,
  handicap: number,
): Promise<void> {
  await pool.query(`UPDATE players SET name = $1, handicap = $2 WHERE id = $3`, [
    name,
    handicap,
    playerId,
  ]);
}

export async function removePlayer(playerId: string): Promise<void> {
  await pool.query(`DELETE FROM players WHERE id = $1`, [playerId]);
}
