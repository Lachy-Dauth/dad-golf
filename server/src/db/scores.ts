import type { Score } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

interface ScoreRow {
  id: string;
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
  created_at: string;
}

function rowToScore(row: ScoreRow): Score {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    holeNumber: Number(row.hole_number),
    strokes: Number(row.strokes),
    createdAt: row.created_at,
  };
}

export async function upsertScore(
  roundId: string,
  playerId: string,
  holeNumber: number,
  strokes: number,
): Promise<Score> {
  const id = newId();
  const createdAt = now();
  const { rows } = await pool.query(
    `INSERT INTO scores (id, round_id, player_id, hole_number, strokes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (player_id, hole_number) DO UPDATE
       SET strokes = EXCLUDED.strokes, created_at = EXCLUDED.created_at
     RETURNING *`,
    [id, roundId, playerId, holeNumber, strokes, createdAt],
  );
  return rowToScore(rows[0] as ScoreRow);
}

export async function deleteScore(playerId: string, holeNumber: number): Promise<void> {
  await pool.query(`DELETE FROM scores WHERE player_id = $1 AND hole_number = $2`, [
    playerId,
    holeNumber,
  ]);
}

export async function listScores(roundId: string): Promise<Score[]> {
  const { rows } = await pool.query(
    `SELECT * FROM scores WHERE round_id = $1 ORDER BY hole_number ASC`,
    [roundId],
  );
  return (rows as ScoreRow[]).map(rowToScore);
}
