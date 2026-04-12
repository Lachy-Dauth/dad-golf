import type {
  ScheduledRound,
  ScheduledRoundRsvp,
  ScheduledRoundStatus,
  RsvpStatus,
  UserScheduledRound,
} from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

interface ScheduledRoundRow {
  id: string;
  group_id: string;
  course_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  status: ScheduledRoundStatus;
  round_id: string | null;
  created_by_user_id: string;
  created_at: string;
}

interface ScheduledRoundListRow extends ScheduledRoundRow {
  course_name: string;
  created_by_name: string;
  room_code: string | null;
}

function rowToScheduledRound(row: ScheduledRoundListRow): ScheduledRound {
  return {
    id: row.id,
    groupId: row.group_id,
    courseId: row.course_id,
    courseName: row.course_name,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : null,
    notes: row.notes,
    status: row.status,
    roundId: row.round_id,
    roomCode: row.room_code ?? null,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

interface RsvpRow {
  id: string;
  scheduled_round_id: string;
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
}

interface RsvpListRow extends RsvpRow {
  user_name: string;
}

function rowToRsvp(row: RsvpListRow): ScheduledRoundRsvp {
  return {
    id: row.id,
    scheduledRoundId: row.scheduled_round_id,
    userId: row.user_id,
    userName: row.user_name,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

const SCHEDULED_ROUND_SELECT = `
  SELECT sr.*, c.name AS course_name, u.display_name AS created_by_name,
         r.room_code
    FROM scheduled_rounds sr
    JOIN courses c ON c.id = sr.course_id
    JOIN users u ON u.id = sr.created_by_user_id
    LEFT JOIN rounds r ON r.id = sr.round_id`;

export async function createScheduledRound(
  groupId: string,
  courseId: string,
  scheduledDate: string,
  scheduledTime: string | null,
  durationMinutes: number | null,
  notes: string | null,
  createdByUserId: string,
): Promise<ScheduledRound> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO scheduled_rounds (id, group_id, course_id, scheduled_date, scheduled_time, duration_minutes, notes, status, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)`,
    [
      id,
      groupId,
      courseId,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      notes,
      createdByUserId,
      createdAt,
    ],
  );
  const { rows } = await pool.query(`${SCHEDULED_ROUND_SELECT} WHERE sr.id = $1`, [id]);
  return rowToScheduledRound(rows[0] as ScheduledRoundListRow);
}

export async function getScheduledRound(id: string): Promise<ScheduledRound | null> {
  const { rows } = await pool.query(`${SCHEDULED_ROUND_SELECT} WHERE sr.id = $1`, [id]);
  const row = rows[0] as ScheduledRoundListRow | undefined;
  return row ? rowToScheduledRound(row) : null;
}

export async function listScheduledRoundsForGroup(groupId: string): Promise<ScheduledRound[]> {
  const { rows } = await pool.query(
    `${SCHEDULED_ROUND_SELECT}
     WHERE sr.group_id = $1 AND sr.status != 'cancelled'
     ORDER BY sr.scheduled_date ASC, sr.scheduled_time ASC NULLS LAST`,
    [groupId],
  );
  return (rows as ScheduledRoundListRow[]).map(rowToScheduledRound);
}

export async function updateScheduledRound(
  id: string,
  fields: {
    courseId?: string;
    scheduledDate?: string;
    scheduledTime?: string | null;
    durationMinutes?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (fields.courseId !== undefined) {
    sets.push(`course_id = $${idx++}`);
    params.push(fields.courseId);
  }
  if (fields.scheduledDate !== undefined) {
    sets.push(`scheduled_date = $${idx++}`);
    params.push(fields.scheduledDate);
  }
  if (fields.scheduledTime !== undefined) {
    sets.push(`scheduled_time = $${idx++}`);
    params.push(fields.scheduledTime);
  }
  if (fields.durationMinutes !== undefined) {
    sets.push(`duration_minutes = $${idx++}`);
    params.push(fields.durationMinutes);
  }
  if (fields.notes !== undefined) {
    sets.push(`notes = $${idx++}`);
    params.push(fields.notes);
  }

  if (sets.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE scheduled_rounds SET ${sets.join(", ")} WHERE id = $${idx}`, params);
}

export async function claimScheduledRound(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE scheduled_rounds SET status = 'started' WHERE id = $1 AND status = 'scheduled'`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

export async function updateScheduledRoundStatus(
  id: string,
  status: ScheduledRoundStatus,
  roundId?: string,
): Promise<void> {
  if (roundId) {
    await pool.query(`UPDATE scheduled_rounds SET status = $1, round_id = $2 WHERE id = $3`, [
      status,
      roundId,
      id,
    ]);
  } else {
    await pool.query(`UPDATE scheduled_rounds SET status = $1 WHERE id = $2`, [status, id]);
  }
}

export async function deleteScheduledRound(id: string): Promise<void> {
  await pool.query(`DELETE FROM scheduled_rounds WHERE id = $1`, [id]);
}

export async function upsertRsvp(
  scheduledRoundId: string,
  userId: string,
  status: RsvpStatus,
): Promise<ScheduledRoundRsvp> {
  const id = newId();
  const updatedAt = now();
  const { rows } = await pool.query(
    `INSERT INTO scheduled_round_rsvps (id, scheduled_round_id, user_id, status, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (scheduled_round_id, user_id) DO UPDATE SET status = $4, updated_at = $5
     RETURNING *`,
    [id, scheduledRoundId, userId, status, updatedAt],
  );
  const row = rows[0] as RsvpRow;
  // Fetch with user name
  const { rows: named } = await pool.query(
    `SELECT r.*, u.display_name AS user_name
       FROM scheduled_round_rsvps r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = $1`,
    [row.id],
  );
  return rowToRsvp(named[0] as RsvpListRow);
}

export async function listRsvps(scheduledRoundId: string): Promise<ScheduledRoundRsvp[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS user_name
       FROM scheduled_round_rsvps r
       JOIN users u ON u.id = r.user_id
       WHERE r.scheduled_round_id = $1
       ORDER BY r.updated_at ASC`,
    [scheduledRoundId],
  );
  return (rows as RsvpListRow[]).map(rowToRsvp);
}

export async function listAcceptedRsvpUserIds(scheduledRoundId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT user_id FROM scheduled_round_rsvps WHERE scheduled_round_id = $1 AND status = 'accepted'`,
    [scheduledRoundId],
  );
  return (rows as { user_id: string }[]).map((r) => r.user_id);
}

export async function listScheduledRoundsForUser(userId: string): Promise<UserScheduledRound[]> {
  const { rows } = await pool.query(
    `SELECT sr.*, c.name AS course_name, u.display_name AS created_by_name,
            r.room_code, g.name AS group_name, rsvp.status AS rsvp_status
       FROM scheduled_rounds sr
       JOIN courses c ON c.id = sr.course_id
       JOIN users u ON u.id = sr.created_by_user_id
       LEFT JOIN rounds r ON r.id = sr.round_id
       JOIN groups g ON g.id = sr.group_id
       JOIN group_members gm ON gm.group_id = sr.group_id AND gm.user_id = $1
       LEFT JOIN scheduled_round_rsvps rsvp ON rsvp.scheduled_round_id = sr.id AND rsvp.user_id = $1
       WHERE sr.status = 'scheduled'
       ORDER BY sr.scheduled_date ASC, sr.scheduled_time ASC NULLS LAST`,
    [userId],
  );
  return (
    rows as Array<ScheduledRoundListRow & { group_name: string; rsvp_status: RsvpStatus | null }>
  ).map((row) => ({
    ...rowToScheduledRound(row),
    groupName: row.group_name,
    rsvpStatus: row.rsvp_status ?? null,
  }));
}

/**
 * List scheduled rounds for a calendar feed. Includes scheduled, started,
 * and recently cancelled rounds (last 7 days) so calendar apps can update.
 */
export async function listScheduledRoundsForFeed(userId: string): Promise<ScheduledRound[]> {
  const { rows } = await pool.query(
    `SELECT sr.*, c.name AS course_name, u.display_name AS created_by_name,
            r.room_code
       FROM scheduled_rounds sr
       JOIN courses c ON c.id = sr.course_id
       JOIN users u ON u.id = sr.created_by_user_id
       LEFT JOIN rounds r ON r.id = sr.round_id
       JOIN group_members gm ON gm.group_id = sr.group_id AND gm.user_id = $1
       WHERE sr.status IN ('scheduled', 'started')
          OR (sr.status = 'cancelled' AND sr.created_at >= NOW() - INTERVAL '7 days')
       ORDER BY sr.scheduled_date ASC, sr.scheduled_time ASC NULLS LAST`,
    [userId],
  );
  return (rows as ScheduledRoundListRow[]).map(rowToScheduledRound);
}
