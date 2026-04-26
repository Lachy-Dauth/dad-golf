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
  latitude: number | null = null,
  longitude: number | null = null,
): Promise<Course> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO courses (id, name, location, latitude, longitude, rating, slope, holes_json, created_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      name,
      location,
      latitude,
      longitude,
      rating,
      slope,
      JSON.stringify(holes),
      createdAt,
      createdByUserId,
    ],
  );
  const creator = await getUser(createdByUserId);
  return {
    id,
    name,
    location,
    latitude,
    longitude,
    rating,
    slope,
    holes,
    createdAt,
    createdByUserId,
    createdByName: creator?.displayName ?? null,
    favoriteCount: 0,
    isFavorite: false,
    avgRating: null,
    ratingCount: 0,
    roundCount: 0,
  };
}

interface CourseRow {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
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
  avg_rating: string | null;
  rating_count: string;
  round_count: string;
}

const COURSE_SELECT = `SELECT c.*,
            u.display_name AS creator_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            CASE WHEN $1::text IS NULL THEN 0
                 ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = $1)
            END AS is_favorite,
            (SELECT AVG(cr.rating) FROM course_reviews cr WHERE cr.course_id = c.id) AS avg_rating,
            (SELECT COUNT(*) FROM course_reviews cr WHERE cr.course_id = c.id) AS rating_count,
            (SELECT COUNT(*) FROM rounds r WHERE r.course_id = c.id) AS round_count
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id`;

function rowToCourse(row: CourseListRow): Course {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    rating: Number(row.rating),
    slope: Number(row.slope),
    holes: JSON.parse(row.holes_json) as Hole[],
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    createdByName: row.creator_name,
    favoriteCount: Number(row.favorite_count) || 0,
    isFavorite: Number(row.is_favorite) > 0,
    avgRating: row.avg_rating != null ? Math.round(Number(row.avg_rating) * 10) / 10 : null,
    ratingCount: Number(row.rating_count) || 0,
    roundCount: Number(row.round_count) || 0,
  };
}

export async function listCourses(viewerUserId: string | null): Promise<Course[]> {
  const { rows } = await pool.query(`${COURSE_SELECT} ORDER BY favorite_count DESC, c.name ASC`, [
    viewerUserId,
  ]);
  return (rows as CourseListRow[]).map(rowToCourse);
}

export async function getCourse(
  id: string,
  viewerUserId: string | null = null,
): Promise<Course | null> {
  const { rows } = await pool.query(`${COURSE_SELECT} WHERE c.id = $2`, [viewerUserId, id]);
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
  latitude: number | null = null,
  longitude: number | null = null,
): Promise<void> {
  await pool.query(
    `UPDATE courses SET name = $1, location = $2, latitude = $3, longitude = $4, rating = $5, slope = $6, holes_json = $7 WHERE id = $8`,
    [name, location, latitude, longitude, rating, slope, JSON.stringify(holes), id],
  );
}

export async function updateCourseCoords(
  id: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await pool.query(`UPDATE courses SET latitude = $1, longitude = $2 WHERE id = $3`, [
    latitude,
    longitude,
    id,
  ]);
}

export async function deleteCourse(id: string): Promise<void> {
  await pool.query(`DELETE FROM courses WHERE id = $1`, [id]);
}

export async function getCourseRoundCount(courseId: string): Promise<number> {
  const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM rounds WHERE course_id = $1`, [
    courseId,
  ]);
  return Number((rows[0] as { n: string }).n);
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
