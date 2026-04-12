import type { UserBadge } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

/**
 * Award a badge to a user. Returns true if newly awarded, false if already had it.
 */
export async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO user_badges (id, user_id, badge_id, earned_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, badge_id) DO NOTHING`,
    [newId(), userId, badgeId, now()],
  );
  return (rowCount ?? 0) > 0;
}

export async function listUserBadges(userId: string): Promise<UserBadge[]> {
  const { rows } = await pool.query(
    `SELECT badge_id, earned_at FROM user_badges WHERE user_id = $1 ORDER BY earned_at ASC`,
    [userId],
  );
  return rows.map(
    (r: { badge_id: string; earned_at: string }): UserBadge => ({
      badgeId: r.badge_id,
      earnedAt: r.earned_at,
    }),
  );
}
