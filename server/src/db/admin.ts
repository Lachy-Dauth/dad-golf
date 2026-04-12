import type { Hole } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";
import { getUserByUsername, hashPassword, type UserRow } from "./users.js";

export interface AdminStats {
  users: number;
  courses: number;
  groups: number;
  rounds: { total: number; waiting: number; inProgress: number; complete: number };
  scores: number;
  sessions: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const countQueries = {
    users: `SELECT COUNT(*) AS n FROM users`,
    courses: `SELECT COUNT(*) AS n FROM courses`,
    groups: `SELECT COUNT(*) AS n FROM groups`,
    scores: `SELECT COUNT(*) AS n FROM scores`,
    sessions: `SELECT COUNT(*) AS n FROM sessions`,
  } as const;
  const count = async (table: keyof typeof countQueries) => {
    const { rows } = await pool.query(countQueries[table]);
    return Number((rows[0] as { n: string }).n);
  };
  const { rows: roundsByStatus } = await pool.query(
    `SELECT status, COUNT(*) AS n FROM rounds GROUP BY status`,
  );
  const statusMap: Record<string, number> = {};
  for (const r of roundsByStatus as Array<{ status: string; n: string }>) {
    statusMap[r.status] = Number(r.n);
  }
  return {
    users: await count("users"),
    courses: await count("courses"),
    groups: await count("groups"),
    rounds: {
      total:
        (statusMap["waiting"] ?? 0) +
        (statusMap["in_progress"] ?? 0) +
        (statusMap["complete"] ?? 0),
      waiting: statusMap["waiting"] ?? 0,
      inProgress: statusMap["in_progress"] ?? 0,
      complete: statusMap["complete"] ?? 0,
    },
    scores: await count("scores"),
    sessions: await count("sessions"),
  };
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  handicap: number;
  isAdmin: boolean;
  createdAt: string;
  roundCount: number;
  courseCount: number;
}

export async function listAllUsers(): Promise<AdminUser[]> {
  const { rows } = await pool.query(
    `SELECT u.*,
            (SELECT COUNT(*) FROM players p WHERE p.user_id = u.id) AS round_count,
            (SELECT COUNT(*) FROM courses c WHERE c.created_by_user_id = u.id) AS course_count
       FROM users u
       ORDER BY u.created_at DESC`,
  );
  return (rows as Array<UserRow & { round_count: string; course_count: string }>).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    handicap: Number(r.handicap),
    isAdmin: Number(r.is_admin) > 0,
    createdAt: r.created_at,
    roundCount: Number(r.round_count),
    courseCount: Number(r.course_count),
  }));
}

export interface AdminRound {
  id: string;
  roomCode: string;
  courseName: string;
  leaderName: string | null;
  playerCount: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export async function listAllRounds(
  limit = 50,
  offset = 0,
): Promise<{ rounds: AdminRound[]; total: number }> {
  const { rows: countRows } = await pool.query(`SELECT COUNT(*) AS n FROM rounds`);
  const total = Number((countRows[0] as { n: string }).n);
  const { rows } = await pool.query(
    `SELECT r.id, r.room_code, r.status, r.created_at, r.started_at, r.completed_at,
            COALESCE(c.name, 'Unknown') AS course_name,
            u.display_name AS leader_name,
            (SELECT COUNT(*) FROM players p WHERE p.round_id = r.id) AS player_count
       FROM rounds r
       LEFT JOIN courses c ON c.id = r.course_id
       LEFT JOIN users u ON u.id = r.leader_user_id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return {
    rounds: (
      rows as Array<{
        id: string;
        room_code: string;
        status: string;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
        course_name: string;
        leader_name: string | null;
        player_count: string;
      }>
    ).map((r) => ({
      id: r.id,
      roomCode: r.room_code,
      courseName: r.course_name,
      leaderName: r.leader_name,
      playerCount: Number(r.player_count),
      status: r.status,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    })),
    total,
  };
}

export interface AdminCourse {
  id: string;
  name: string;
  location: string | null;
  holeCount: number;
  createdByName: string | null;
  favoriteCount: number;
  roundCount: number;
  createdAt: string;
}

export async function listAllCourses(): Promise<AdminCourse[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.location, c.holes_json, c.created_at,
            u.display_name AS created_by_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            (SELECT COUNT(*) FROM rounds r WHERE r.course_id = c.id) AS round_count
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id
       ORDER BY c.name ASC`,
  );
  return (
    rows as Array<{
      id: string;
      name: string;
      location: string | null;
      holes_json: string;
      created_at: string;
      created_by_name: string | null;
      favorite_count: string;
      round_count: string;
    }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    holeCount: (JSON.parse(r.holes_json) as Hole[]).length,
    createdByName: r.created_by_name,
    favoriteCount: Number(r.favorite_count),
    roundCount: Number(r.round_count),
    createdAt: r.created_at,
  }));
}

export interface AdminGroup {
  id: string;
  name: string;
  ownerName: string | null;
  memberCount: number;
  createdAt: string;
}

export async function listAllGroups(): Promise<AdminGroup[]> {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.created_at,
            u.display_name AS owner_name,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
       FROM groups g
       LEFT JOIN users u ON u.id = g.owner_user_id
       ORDER BY g.name ASC`,
  );
  return (
    rows as Array<{
      id: string;
      name: string;
      created_at: string;
      owner_name: string | null;
      member_count: string;
    }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    ownerName: r.owner_name,
    memberCount: Number(r.member_count),
    createdAt: r.created_at,
  }));
}

export interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
}

export async function getActivityFeed(limit = 50): Promise<ActivityEvent[]> {
  const { rows } = await pool.query(
    `SELECT type, description, timestamp FROM (
       SELECT 'user_registered' AS type,
              'New user: ' || display_name || ' (@' || username || ')' AS description,
              created_at AS timestamp
         FROM users
       UNION ALL
       SELECT 'round_created' AS type,
              'Round created: ' || r.room_code || ' on ' || COALESCE(c.name, 'Unknown') AS description,
              r.created_at AS timestamp
         FROM rounds r LEFT JOIN courses c ON c.id = r.course_id
       UNION ALL
       SELECT 'round_completed' AS type,
              'Round completed: ' || r.room_code || ' on ' || COALESCE(c.name, 'Unknown') AS description,
              r.completed_at AS timestamp
         FROM rounds r LEFT JOIN courses c ON c.id = r.course_id
         WHERE r.completed_at IS NOT NULL
     ) events
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit],
  );
  return rows as ActivityEvent[];
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await pool.query(`UPDATE users SET is_admin = $1 WHERE id = $2`, [isAdmin ? 1 : 0, userId]);
}

export async function deleteUserAsAdmin(userId: string): Promise<void> {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

export async function ensureAdminUser(password: string): Promise<void> {
  const existing = await getUserByUsername("admin");
  if (existing) {
    const newHash = hashPassword(password);
    await pool.query(`UPDATE users SET password_hash = $1, is_admin = 1 WHERE id = $2`, [
      newHash,
      existing.id,
    ]);
  } else {
    const id = newId();
    const createdAt = now();
    const passwordHash = hashPassword(password);
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, handicap, created_at, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, 1)`,
      [id, "admin", passwordHash, "Admin", 18, createdAt],
    );
  }
}
