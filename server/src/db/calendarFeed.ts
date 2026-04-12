import { randomBytes } from "node:crypto";
import type { User } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { newId, now } from "./helpers.js";
import { rowToUser, type UserRow } from "./users.js";

interface FeedTokenRow {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
}

export async function getCalendarFeedToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT token FROM calendar_feed_tokens WHERE user_id = $1`, [
    userId,
  ]);
  const row = rows[0] as FeedTokenRow | undefined;
  return row?.token ?? null;
}

export async function getUserByFeedToken(token: string): Promise<User | null> {
  const { rows } = await pool.query(
    `SELECT u.* FROM calendar_feed_tokens ft JOIN users u ON u.id = ft.user_id WHERE ft.token = $1`,
    [token],
  );
  const row = rows[0] as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function createCalendarFeedToken(userId: string): Promise<string> {
  // Return existing token if one exists
  const existing = await getCalendarFeedToken(userId);
  if (existing) return existing;

  const token = randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO calendar_feed_tokens (id, user_id, token, created_at) VALUES ($1, $2, $3, $4)`,
    [newId(), userId, token, now()],
  );
  return token;
}

export async function deleteCalendarFeedToken(userId: string): Promise<void> {
  await pool.query(`DELETE FROM calendar_feed_tokens WHERE user_id = $1`, [userId]);
}
