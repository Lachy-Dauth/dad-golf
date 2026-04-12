import { randomBytes } from "node:crypto";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

export interface GoogleCalendarConnection {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  calendarId: string;
  email: string | null;
  createdAt: string;
}

interface ConnectionRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string;
  email: string | null;
  created_at: string;
}

function rowToConnection(row: ConnectionRow): GoogleCalendarConnection {
  return {
    id: row.id,
    userId: row.user_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: row.token_expiry,
    calendarId: row.calendar_id,
    email: row.email,
    createdAt: row.created_at,
  };
}

export async function getGoogleConnection(
  userId: string,
): Promise<GoogleCalendarConnection | null> {
  const { rows } = await pool.query(
    `SELECT * FROM google_calendar_connections WHERE user_id = $1`,
    [userId],
  );
  const row = rows[0] as ConnectionRow | undefined;
  return row ? rowToConnection(row) : null;
}

export async function createGoogleConnection(
  userId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiry: string,
  email: string,
): Promise<void> {
  const id = newId();
  const createdAt = now();
  // Delete any existing connection first (upsert pattern)
  await pool.query(`DELETE FROM google_calendar_connections WHERE user_id = $1`, [userId]);
  await pool.query(
    `INSERT INTO google_calendar_connections (id, user_id, access_token, refresh_token, token_expiry, email, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, userId, accessToken, refreshToken, tokenExpiry, email, createdAt],
  );
  await pool.query(`UPDATE users SET google_calendar_connected = 1 WHERE id = $1`, [userId]);
}

export async function updateGoogleTokens(
  userId: string,
  accessToken: string,
  tokenExpiry: string,
): Promise<void> {
  await pool.query(
    `UPDATE google_calendar_connections SET access_token = $1, token_expiry = $2 WHERE user_id = $3`,
    [accessToken, tokenExpiry, userId],
  );
}

export async function updateGoogleCalendarId(userId: string, calendarId: string): Promise<void> {
  await pool.query(`UPDATE google_calendar_connections SET calendar_id = $1 WHERE user_id = $2`, [
    calendarId,
    userId,
  ]);
}

export async function deleteGoogleConnection(userId: string): Promise<void> {
  await pool.query(`DELETE FROM google_calendar_connections WHERE user_id = $1`, [userId]);
  await pool.query(`UPDATE scheduled_round_rsvps SET google_event_id = NULL WHERE user_id = $1`, [
    userId,
  ]);
  await pool.query(`UPDATE users SET google_calendar_connected = 0 WHERE id = $1`, [userId]);
}

export async function getGoogleEventId(
  scheduledRoundId: string,
  userId: string,
): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT google_event_id FROM scheduled_round_rsvps
     WHERE scheduled_round_id = $1 AND user_id = $2`,
    [scheduledRoundId, userId],
  );
  const row = rows[0] as { google_event_id: string | null } | undefined;
  return row?.google_event_id ?? null;
}

export async function setGoogleEventId(
  scheduledRoundId: string,
  userId: string,
  eventId: string,
): Promise<void> {
  await pool.query(
    `UPDATE scheduled_round_rsvps SET google_event_id = $1
     WHERE scheduled_round_id = $2 AND user_id = $3`,
    [eventId, scheduledRoundId, userId],
  );
}

export async function clearGoogleEventId(scheduledRoundId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE scheduled_round_rsvps SET google_event_id = NULL
     WHERE scheduled_round_id = $1 AND user_id = $2`,
    [scheduledRoundId, userId],
  );
}

export async function clearAllGoogleEventIds(userId: string): Promise<void> {
  await pool.query(`UPDATE scheduled_round_rsvps SET google_event_id = NULL WHERE user_id = $1`, [
    userId,
  ]);
}

/** Create a short-lived OAuth nonce bound to a user (CSRF protection). */
export async function createOAuthNonce(userId: string): Promise<string> {
  const nonce = randomBytes(32).toString("hex");
  await pool.query(`INSERT INTO oauth_nonces (nonce, user_id, created_at) VALUES ($1, $2, $3)`, [
    nonce,
    userId,
    now(),
  ]);
  return nonce;
}

/** Consume an OAuth nonce and return the user ID. Returns null if expired (>10 min) or not found. */
export async function consumeOAuthNonce(nonce: string): Promise<string | null> {
  const { rows } = await pool.query(
    `DELETE FROM oauth_nonces WHERE nonce = $1 RETURNING user_id, created_at`,
    [nonce],
  );
  const row = rows[0] as { user_id: string; created_at: string } | undefined;
  if (!row) return null;
  // Expire after 10 minutes
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > 10 * 60 * 1000) return null;
  return row.user_id;
}

/** Get all RSVPs with a google_event_id for a given scheduled round (for bulk sync). */
export async function listRsvpsWithGoogleEvents(
  scheduledRoundId: string,
): Promise<Array<{ userId: string; googleEventId: string }>> {
  const { rows } = await pool.query(
    `SELECT user_id, google_event_id FROM scheduled_round_rsvps
     WHERE scheduled_round_id = $1 AND google_event_id IS NOT NULL`,
    [scheduledRoundId],
  );
  return (rows as Array<{ user_id: string; google_event_id: string }>).map((r) => ({
    userId: r.user_id,
    googleEventId: r.google_event_id,
  }));
}
