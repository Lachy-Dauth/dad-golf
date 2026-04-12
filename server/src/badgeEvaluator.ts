import type { RoundState } from "@dad-golf/shared";
import { computeLeaderboard } from "@dad-golf/shared";
import { pool } from "./db/pool.js";
import { awardBadge } from "./db/badges.js";
import { createActivityEvent } from "./db/activity.js";

interface EvaluateContext {
  trigger: "round_completed" | "member_joined" | "competition_won";
  roundId?: string;
  groupId?: string;
  roundState?: RoundState;
  userId: string;
  visibility: string;
}

/**
 * Evaluate all badges for a user in the given context.
 * Returns the list of newly awarded badge IDs.
 */
export async function evaluateBadges(ctx: EvaluateContext): Promise<string[]> {
  const awarded: string[] = [];

  async function tryAward(badgeId: string, check: () => Promise<boolean>): Promise<void> {
    // Check if already earned
    const { rows } = await pool.query(
      `SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2`,
      [ctx.userId, badgeId],
    );
    if (rows.length > 0) return;

    if (await check()) {
      const isNew = await awardBadge(ctx.userId, badgeId);
      if (isNew) {
        awarded.push(badgeId);
      }
    }
  }

  // -- Milestones: round count --
  async function completedRoundCount(): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM players p
       JOIN rounds r ON r.id = p.round_id
       WHERE p.user_id = $1 AND r.status = 'complete'`,
      [ctx.userId],
    );
    return Number(rows[0].cnt);
  }

  await tryAward("first_timer", async () => (await completedRoundCount()) >= 1);
  await tryAward("regular", async () => (await completedRoundCount()) >= 10);
  await tryAward("veteran", async () => (await completedRoundCount()) >= 50);

  // -- Scoring badges (only on round_completed) --
  if (ctx.trigger === "round_completed" && ctx.roundState) {
    const state = ctx.roundState;
    const player = state.players.find((p) => p.userId === ctx.userId);

    if (player) {
      const playerScores = state.scores.filter((s) => s.playerId === player.id);

      // Birdie: gross strokes = par - 1
      await tryAward("birdie_watch", async () => {
        for (const score of playerScores) {
          const hole = state.course.holes.find((h) => h.number === score.holeNumber);
          if (hole && score.strokes === hole.par - 1) return true;
        }
        return false;
      });

      // Eagle: gross strokes <= par - 2
      await tryAward("eagle_eye", async () => {
        for (const score of playerScores) {
          const hole = state.course.holes.find((h) => h.number === score.holeNumber);
          if (hole && score.strokes <= hole.par - 2) return true;
        }
        return false;
      });

      // On Fire: 36+ Stableford points
      await tryAward("on_fire", async () => {
        const leaderboard = computeLeaderboard(state.course, state.players, state.scores);
        const row = leaderboard.find((r) => r.playerId === player.id);
        return (row?.totalPoints ?? 0) >= 36;
      });

      // Champion: position 1
      await tryAward("champion", async () => {
        const leaderboard = computeLeaderboard(state.course, state.players, state.scores);
        const row = leaderboard.find((r) => r.playerId === player.id);
        return row?.position === 1;
      });
    }

    // Explorer: 5 different courses
    await tryAward("explorer", async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(DISTINCT r.course_id) AS cnt FROM players p
         JOIN rounds r ON r.id = p.round_id
         WHERE p.user_id = $1 AND r.status = 'complete'`,
        [ctx.userId],
      );
      return Number(rows[0].cnt) >= 5;
    });

    // Social Butterfly: 10 unique co-players
    await tryAward("social_butterfly", async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(DISTINCT p2.user_id) AS cnt FROM players p1
         JOIN players p2 ON p2.round_id = p1.round_id AND p2.user_id != p1.user_id AND p2.user_id IS NOT NULL
         JOIN rounds r ON r.id = p1.round_id
         WHERE p1.user_id = $1 AND r.status = 'complete'`,
        [ctx.userId],
      );
      return Number(rows[0].cnt) >= 10;
    });
  }

  // -- Social badges --
  if (ctx.trigger === "member_joined") {
    await tryAward("team_player", async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM group_members WHERE user_id = $1`,
        [ctx.userId],
      );
      return Number(rows[0].cnt) >= 1;
    });
  }

  // -- Competition badges --
  if (ctx.trigger === "competition_won" || ctx.trigger === "round_completed") {
    await tryAward("sharpshooter", async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM competition_claims cc
         JOIN hole_competitions hc ON hc.id = cc.competition_id
         JOIN players p ON p.id = cc.player_id
         WHERE p.user_id = $1 AND hc.type = 'ctp' AND cc.is_winner = 1`,
        [ctx.userId],
      );
      return Number(rows[0].cnt) >= 1;
    });

    await tryAward("big_hitter", async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM competition_claims cc
         JOIN hole_competitions hc ON hc.id = cc.competition_id
         JOIN players p ON p.id = cc.player_id
         WHERE p.user_id = $1 AND hc.type = 'longest_drive' AND cc.is_winner = 1`,
        [ctx.userId],
      );
      return Number(rows[0].cnt) >= 1;
    });
  }

  // Fire badge_earned events for each new badge
  for (const badgeId of awarded) {
    await createActivityEvent(
      "badge_earned",
      ctx.userId,
      ctx.groupId ?? null,
      ctx.roundId ?? null,
      ctx.visibility,
      { badgeId },
    );
  }

  return awarded;
}
