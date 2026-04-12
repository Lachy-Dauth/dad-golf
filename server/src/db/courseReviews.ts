import type { CourseReview } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

interface ReviewRow {
  id: string;
  course_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
}

function rowToReview(row: ReviewRow): CourseReview {
  return {
    id: row.id,
    courseId: row.course_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: Number(row.rating),
    reviewText: row.review_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertCourseReview(
  courseId: string,
  userId: string,
  rating: number,
  reviewText: string | null,
): Promise<CourseReview> {
  const id = newId();
  const ts = now();
  const { rows } = await pool.query(
    `INSERT INTO course_reviews (id, course_id, user_id, rating, review_text, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (course_id, user_id) DO UPDATE
       SET rating = EXCLUDED.rating,
           review_text = EXCLUDED.review_text,
           updated_at = EXCLUDED.updated_at
     RETURNING id, course_id, user_id, rating, review_text, created_at, updated_at`,
    [id, courseId, userId, rating, reviewText, ts],
  );
  const row = rows[0] as ReviewRow & { user_name?: string };
  // Fetch the user name separately since RETURNING doesn't join
  const { rows: userRows } = await pool.query(`SELECT display_name FROM users WHERE id = $1`, [
    userId,
  ]);
  const userName = (userRows[0] as { display_name: string } | undefined)?.display_name ?? "Unknown";
  return rowToReview({ ...row, user_name: userName });
}

export async function deleteCourseReview(courseId: string, userId: string): Promise<void> {
  await pool.query(`DELETE FROM course_reviews WHERE course_id = $1 AND user_id = $2`, [
    courseId,
    userId,
  ]);
}

export async function getUserCourseReview(
  courseId: string,
  userId: string,
): Promise<CourseReview | null> {
  const { rows } = await pool.query(
    `SELECT cr.*, u.display_name AS user_name
       FROM course_reviews cr
       JOIN users u ON u.id = cr.user_id
       WHERE cr.course_id = $1 AND cr.user_id = $2`,
    [courseId, userId],
  );
  const row = rows[0] as ReviewRow | undefined;
  return row ? rowToReview(row) : null;
}

export async function listCourseReviews(
  courseId: string,
  limit = 20,
  offset = 0,
): Promise<{ reviews: CourseReview[]; total: number }> {
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS n FROM course_reviews WHERE course_id = $1`,
    [courseId],
  );
  const total = Number((countRows[0] as { n: string }).n);

  const { rows } = await pool.query(
    `SELECT cr.*, u.display_name AS user_name
       FROM course_reviews cr
       JOIN users u ON u.id = cr.user_id
       WHERE cr.course_id = $1
       ORDER BY cr.created_at DESC
       LIMIT $2 OFFSET $3`,
    [courseId, limit, offset],
  );
  return {
    reviews: (rows as ReviewRow[]).map(rowToReview),
    total,
  };
}
