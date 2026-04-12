import type { CourseReportReason } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

export interface CourseReportRow {
  id: string;
  courseId: string;
  courseName: string;
  courseLocation: string | null;
  userId: string;
  userName: string;
  reason: CourseReportReason;
  createdAt: string;
}

export interface AdminCourseReport {
  courseId: string;
  courseName: string;
  courseLocation: string | null;
  reportCount: number;
  reasons: CourseReportReason[];
}

export async function createCourseReport(
  courseId: string,
  userId: string,
  reason: CourseReportReason,
): Promise<void> {
  await pool.query(
    `INSERT INTO course_reports (id, course_id, user_id, reason, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (course_id, user_id) DO NOTHING`,
    [newId(), courseId, userId, reason, now()],
  );
}

export async function getUserCourseReport(courseId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM course_reports WHERE course_id = $1 AND user_id = $2`,
    [courseId, userId],
  );
  return rows.length > 0;
}

export async function listCourseReports(): Promise<AdminCourseReport[]> {
  const { rows } = await pool.query(
    `SELECT cr.course_id,
            c.name AS course_name,
            c.location AS course_location,
            COUNT(*) AS report_count,
            array_agg(DISTINCT cr.reason) AS reasons
       FROM course_reports cr
       JOIN courses c ON c.id = cr.course_id
       GROUP BY cr.course_id, c.name, c.location
       ORDER BY report_count DESC`,
  );
  return (
    rows as Array<{
      course_id: string;
      course_name: string;
      course_location: string | null;
      report_count: string;
      reasons: CourseReportReason[];
    }>
  ).map((r) => ({
    courseId: r.course_id,
    courseName: r.course_name,
    courseLocation: r.course_location,
    reportCount: Number(r.report_count),
    reasons: r.reasons,
  }));
}

export async function dismissCourseReports(courseId: string): Promise<void> {
  await pool.query(`DELETE FROM course_reports WHERE course_id = $1`, [courseId]);
}
