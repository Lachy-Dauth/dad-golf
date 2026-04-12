import type { HandicapRound } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

interface HandicapRoundRow {
  id: string;
  user_id: string;
  round_id: string | null;
  date: string;
  course_name: string;
  adjusted_gross_score: number;
  course_rating: number;
  slope_rating: number;
  score_differential: number;
  sort_order: number;
  source: string;
  created_at: string;
}

function rowToHandicapRound(row: HandicapRoundRow): HandicapRound {
  return {
    id: row.id,
    userId: row.user_id,
    roundId: row.round_id,
    date: row.date,
    courseName: row.course_name,
    adjustedGrossScore: Number(row.adjusted_gross_score),
    courseRating: Number(row.course_rating),
    slopeRating: Number(row.slope_rating),
    scoreDifferential: Number(row.score_differential),
    sortOrder: Number(row.sort_order),
    source: row.source as "manual" | "auto",
    createdAt: row.created_at,
  };
}

export async function listHandicapRounds(userId: string): Promise<HandicapRound[]> {
  const { rows } = await pool.query(
    `SELECT * FROM handicap_rounds WHERE user_id = $1 ORDER BY sort_order ASC LIMIT 20`,
    [userId],
  );
  return (rows as HandicapRoundRow[]).map(rowToHandicapRound);
}

export async function getHandicapRound(id: string): Promise<HandicapRound | null> {
  const { rows } = await pool.query(`SELECT * FROM handicap_rounds WHERE id = $1`, [id]);
  const row = rows[0] as HandicapRoundRow | undefined;
  return row ? rowToHandicapRound(row) : null;
}

export async function createHandicapRound(
  userId: string,
  date: string,
  courseName: string,
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number,
  scoreDifferential: number,
  roundId: string | null,
  source: "manual" | "auto" = "manual",
): Promise<HandicapRound> {
  const id = newId();
  const createdAt = now();

  // Bump existing sort_orders to make room at position 0
  await pool.query(`UPDATE handicap_rounds SET sort_order = sort_order + 1 WHERE user_id = $1`, [
    userId,
  ]);

  await pool.query(
    `INSERT INTO handicap_rounds
       (id, user_id, round_id, date, course_name, adjusted_gross_score,
        course_rating, slope_rating, score_differential, sort_order, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11)`,
    [
      id,
      userId,
      roundId,
      date,
      courseName,
      adjustedGrossScore,
      courseRating,
      slopeRating,
      scoreDifferential,
      source,
      createdAt,
    ],
  );

  return {
    id,
    userId,
    roundId,
    date,
    courseName,
    adjustedGrossScore,
    courseRating,
    slopeRating,
    scoreDifferential,
    sortOrder: 0,
    source,
    createdAt,
  };
}

export async function updateHandicapRound(
  id: string,
  date: string,
  courseName: string,
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number,
  scoreDifferential: number,
): Promise<void> {
  await pool.query(
    `UPDATE handicap_rounds
     SET date = $1, course_name = $2, adjusted_gross_score = $3,
         course_rating = $4, slope_rating = $5, score_differential = $6
     WHERE id = $7`,
    [date, courseName, adjustedGrossScore, courseRating, slopeRating, scoreDifferential, id],
  );
}

export async function deleteHandicapRound(id: string): Promise<void> {
  await pool.query(`DELETE FROM handicap_rounds WHERE id = $1`, [id]);
}

export async function reorderHandicapRounds(userId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await pool.query(`UPDATE handicap_rounds SET sort_order = $1 WHERE id = $2 AND user_id = $3`, [
      i,
      orderedIds[i],
      userId,
    ]);
  }
}

export async function countHandicapRounds(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM handicap_rounds WHERE user_id = $1`,
    [userId],
  );
  return Number((rows[0] as { cnt: string }).cnt);
}

export async function findHandicapRoundByRoundId(
  userId: string,
  roundId: string,
): Promise<HandicapRound | null> {
  const { rows } = await pool.query(
    `SELECT * FROM handicap_rounds WHERE user_id = $1 AND round_id = $2`,
    [userId, roundId],
  );
  const row = rows[0] as HandicapRoundRow | undefined;
  return row ? rowToHandicapRound(row) : null;
}

export async function deleteOldestHandicapRound(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM handicap_rounds WHERE id = (
       SELECT id FROM handicap_rounds WHERE user_id = $1 ORDER BY sort_order DESC LIMIT 1
     )`,
    [userId],
  );
}
