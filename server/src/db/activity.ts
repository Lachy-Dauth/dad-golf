import type {
  ActivityComment,
  ActivityEventType,
  ActivityFeedItem,
  ActivityVisibility,
} from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

export async function createActivityEvent(
  type: ActivityEventType,
  userId: string,
  groupId: string | null,
  roundId: string | null,
  visibility: ActivityVisibility,
  data: Record<string, unknown>,
): Promise<string> {
  const id = newId();
  await pool.query(
    `INSERT INTO activity_events (id, type, group_id, user_id, round_id, visibility, data_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, type, groupId, userId, roundId, visibility, JSON.stringify(data), now()],
  );
  return id;
}

const ACTIVITY_FEED_COLUMNS = `ae.*, u.display_name AS user_name, u.username,
            g.name AS group_name, r.room_code,
            (SELECT COUNT(*) FROM activity_likes al WHERE al.event_id = ae.id) AS like_count,
            (SELECT COUNT(*) FROM activity_comments ac WHERE ac.event_id = ae.id) AS comment_count,
            EXISTS(SELECT 1 FROM activity_likes al2 WHERE al2.event_id = ae.id AND al2.user_id = $1) AS viewer_liked`;

const ACTIVITY_FEED_FROM = `FROM activity_events ae
     LEFT JOIN users u ON u.id = ae.user_id
     LEFT JOIN groups g ON g.id = ae.group_id
     LEFT JOIN rounds r ON r.id = ae.round_id`;

const ACTIVITY_FEED_WHERE = `WHERE (ae.visibility = 'group' AND ae.group_id = ANY($2))
        OR ae.user_id = $1`;

export async function getActivityFeedForUser(
  userId: string,
  limit: number,
  offset: number,
): Promise<{ items: ActivityFeedItem[]; total: number }> {
  const { rows: groupRows } = await pool.query(
    `SELECT group_id FROM group_members WHERE user_id = $1`,
    [userId],
  );
  const groupIds = groupRows.map((r: { group_id: string }) => r.group_id);

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS cnt ${ACTIVITY_FEED_FROM} ${ACTIVITY_FEED_WHERE}`,
    [userId, groupIds],
  );
  const total = Number(countRows[0].cnt);

  const { rows } = await pool.query(
    `SELECT ${ACTIVITY_FEED_COLUMNS}
     ${ACTIVITY_FEED_FROM}
     ${ACTIVITY_FEED_WHERE}
     ORDER BY ae.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, groupIds, limit, offset],
  );

  return { items: (rows as ActivityFeedRow[]).map(rowToFeedItem), total };
}

interface ActivityFeedRow {
  id: string;
  type: string;
  group_id: string | null;
  user_id: string;
  round_id: string | null;
  data_json: string;
  created_at: string;
  user_name: string;
  username: string;
  group_name: string | null;
  room_code: string | null;
  like_count: string;
  comment_count: string;
  viewer_liked: boolean;
}

function rowToFeedItem(row: ActivityFeedRow): ActivityFeedItem {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(row.data_json || "{}");
  } catch {
    /* ignore */
  }
  return {
    id: row.id,
    type: row.type as ActivityFeedItem["type"],
    groupId: row.group_id,
    groupName: row.group_name,
    userId: row.user_id,
    userName: row.user_name,
    username: row.username,
    roundId: row.round_id,
    roomCode: row.room_code,
    data,
    createdAt: row.created_at,
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    viewerLiked: Boolean(row.viewer_liked),
  };
}

export async function canUserSeeEvent(eventId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT * FROM activity_events WHERE id = $1`, [eventId]);
  if (rows.length === 0) return false;
  const event = rows[0] as { user_id: string; group_id: string | null; visibility: string };

  // Author can always see their own events
  if (event.user_id === userId) return true;

  // 'none' visibility: only the author
  if (event.visibility === "none") return false;

  // Check if viewer shares the event's group
  if (event.visibility === "group" && event.group_id) {
    const { rows: memberRows } = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [event.group_id, userId],
    );
    return memberRows.length > 0;
  }

  return false;
}

export async function likeActivityEvent(eventId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO activity_likes (event_id, user_id, created_at) VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, userId, now()],
  );
}

export async function unlikeActivityEvent(eventId: string, userId: string): Promise<void> {
  await pool.query(`DELETE FROM activity_likes WHERE event_id = $1 AND user_id = $2`, [
    eventId,
    userId,
  ]);
}

export async function getActivityComments(eventId: string): Promise<ActivityComment[]> {
  const { rows } = await pool.query(
    `SELECT ac.*, u.display_name AS user_name
     FROM activity_comments ac
     JOIN users u ON u.id = ac.user_id
     WHERE ac.event_id = $1
     ORDER BY ac.created_at ASC`,
    [eventId],
  );
  return rows.map(
    (r: Record<string, unknown>): ActivityComment => ({
      id: String(r.id),
      eventId: String(r.event_id),
      userId: String(r.user_id),
      userName: String(r.user_name),
      text: String(r.text),
      createdAt: String(r.created_at),
    }),
  );
}

export async function addActivityComment(
  eventId: string,
  userId: string,
  text: string,
): Promise<ActivityComment> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO activity_comments (id, event_id, user_id, text, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, eventId, userId, text, createdAt],
  );
  const { rows } = await pool.query(`SELECT display_name FROM users WHERE id = $1`, [userId]);
  return {
    id,
    eventId,
    userId,
    userName: String(rows[0]?.display_name ?? ""),
    text,
    createdAt,
  };
}
