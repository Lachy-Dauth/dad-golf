import type { Course, Hole } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";
import { getUser } from "./users.js";

export async function createCourse(
  name: string,
  location: string | null,
  rating: number,
  slope: number,
  holes: Hole[],
  createdByUserId: string,
): Promise<Course> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO courses (id, name, location, rating, slope, holes_json, created_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, location, rating, slope, JSON.stringify(holes), createdAt, createdByUserId],
  );
  const creator = await getUser(createdByUserId);
  return {
    id,
    name,
    location,
    rating,
    slope,
    holes,
    createdAt,
    createdByUserId,
    createdByName: creator?.displayName ?? null,
    favoriteCount: 0,
    isFavorite: false,
  };
}

interface CourseRow {
  id: string;
  name: string;
  location: string | null;
  rating: number;
  slope: number;
  holes_json: string;
  created_at: string;
  created_by_user_id: string | null;
}

interface CourseListRow extends CourseRow {
  creator_name: string | null;
  favorite_count: string;
  is_favorite: string;
}

function rowToCourse(row: CourseListRow): Course {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    rating: Number(row.rating),
    slope: Number(row.slope),
    holes: JSON.parse(row.holes_json) as Hole[],
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    createdByName: row.creator_name,
    favoriteCount: Number(row.favorite_count) || 0,
    isFavorite: Number(row.is_favorite) > 0,
  };
}

export async function listCourses(viewerUserId: string | null): Promise<Course[]> {
  const { rows } = await pool.query(
    `SELECT c.*,
            u.display_name AS creator_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            CASE WHEN $1::text IS NULL THEN 0
                 ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = $1)
            END AS is_favorite
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id
       ORDER BY favorite_count DESC, c.name ASC`,
    [viewerUserId],
  );
  return (rows as CourseListRow[]).map(rowToCourse);
}

export async function getCourse(
  id: string,
  viewerUserId: string | null = null,
): Promise<Course | null> {
  const { rows } = await pool.query(
    `SELECT c.*,
            u.display_name AS creator_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            CASE WHEN $1::text IS NULL THEN 0
                 ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = $1)
            END AS is_favorite
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id
       WHERE c.id = $2`,
    [viewerUserId, id],
  );
  const row = rows[0] as CourseListRow | undefined;
  return row ? rowToCourse(row) : null;
}

export async function updateCourse(
  id: string,
  name: string,
  location: string | null,
  rating: number,
  slope: number,
  holes: Hole[],
): Promise<void> {
  await pool.query(
    `UPDATE courses SET name = $1, location = $2, rating = $3, slope = $4, holes_json = $5 WHERE id = $6`,
    [name, location, rating, slope, JSON.stringify(holes), id],
  );
}

export async function deleteCourse(id: string): Promise<void> {
  await pool.query(`DELETE FROM courses WHERE id = $1`, [id]);
}

export async function getCourseFavoriteCount(courseId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS n FROM course_favorites WHERE course_id = $1`,
    [courseId],
  );
  return Number((rows[0] as { n: string }).n);
}

export async function favoriteCourse(userId: string, courseId: string): Promise<void> {
  await pool.query(
    `INSERT INTO course_favorites (user_id, course_id, created_at) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, courseId, now()],
  );
}

export async function unfavoriteCourse(userId: string, courseId: string): Promise<void> {
  await pool.query(`DELETE FROM course_favorites WHERE user_id = $1 AND course_id = $2`, [
    userId,
    courseId,
  ]);
}
