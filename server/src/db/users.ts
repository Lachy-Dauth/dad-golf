import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { ActivityVisibility, Gender, User } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  handicap: number;
  gender: string;
  handicap_auto_adjust: number;
  google_calendar_connected: number;
  activity_visibility: string;
  created_at: string;
  is_admin: number;
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    handicap: Number(row.handicap),
    gender: row.gender === "F" ? "F" : "M",
    handicapAutoAdjust: Boolean(row.handicap_auto_adjust),
    googleCalendarConnected: Boolean(row.google_calendar_connected),
    activityVisibility: (row.activity_visibility || "public") as ActivityVisibility,
    createdAt: row.created_at,
    isAdmin: Boolean(row.is_admin),
  };
}

export async function createUser(
  username: string,
  password: string,
  displayName: string,
  handicap: number,
  gender: Gender = "M",
): Promise<User> {
  const id = newId();
  const createdAt = now();
  const passwordHash = hashPassword(password);
  await pool.query(
    `INSERT INTO users (id, username, password_hash, display_name, handicap, gender, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, username.toLowerCase(), passwordHash, displayName, handicap, gender, createdAt],
  );
  return {
    id,
    username: username.toLowerCase(),
    displayName,
    handicap,
    gender,
    handicapAutoAdjust: false,
    googleCalendarConnected: false,
    activityVisibility: "public",
    createdAt,
    isAdmin: false,
  };
}

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await pool.query(`SELECT * FROM users WHERE username = $1`, [
    username.toLowerCase(),
  ]);
  return (rows[0] as UserRow) ?? null;
}

export async function getUser(id: string): Promise<User | null> {
  const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  const row = rows[0] as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const row = await getUserByUsername(username);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export async function updateUserProfile(
  userId: string,
  displayName: string,
  handicap: number,
): Promise<void> {
  await pool.query(`UPDATE users SET display_name = $1, handicap = $2 WHERE id = $3`, [
    displayName,
    handicap,
    userId,
  ]);
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const createdAt = now();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await pool.query(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
    [token, userId, createdAt, expiresAt],
  );
  return token;
}

export async function getUserBySession(token: string): Promise<User | null> {
  const { rows } = await pool.query(
    `SELECT users.* FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = $1
       AND (sessions.expires_at IS NULL OR sessions.expires_at > $2)`,
    [token, new Date().toISOString()],
  );
  const row = rows[0] as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function deleteExpiredSessions(): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= $1`,
    [new Date().toISOString()],
  );
  return rowCount ?? 0;
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

export async function updateUserHandicapAutoAdjust(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(`UPDATE users SET handicap_auto_adjust = $1 WHERE id = $2`, [
    enabled ? 1 : 0,
    userId,
  ]);
}

export async function updateUserHandicap(userId: string, handicap: number): Promise<void> {
  await pool.query(`UPDATE users SET handicap = $1 WHERE id = $2`, [handicap, userId]);
}

export async function updateUserGender(userId: string, gender: Gender): Promise<void> {
  await pool.query(`UPDATE users SET gender = $1 WHERE id = $2`, [gender, userId]);
}

export async function updateActivityVisibility(
  userId: string,
  visibility: ActivityVisibility,
): Promise<void> {
  await pool.query(`UPDATE users SET activity_visibility = $1 WHERE id = $2`, [visibility, userId]);
}

export async function getUserGroupIds(userId: string): Promise<string[]> {
  const { rows } = await pool.query(`SELECT group_id FROM group_members WHERE user_id = $1`, [
    userId,
  ]);
  return rows.map((r: { group_id: string }) => r.group_id);
}
