import type { FastifyBaseLogger } from "fastify";
import type { ActivityVisibility, RoundState, Round } from "@dad-golf/shared";
import { calculateScoreDifferential, calculateHandicapIndex } from "@dad-golf/shared";
import {
  countHandicapRounds,
  createActivityEvent,
  createHandicapRound,
  deleteOldestHandicapRound,
  findHandicapRoundByRoundId,
  getUser,
  getUserGroupIds,
  listHandicapRounds,
  updateUserHandicap,
} from "./db/index.js";
import { evaluateBadges } from "./badgeEvaluator.js";
import { fireAndForget } from "./routes/validation.js";

export async function processRoundCompletion(
  state: RoundState,
  round: Round,
  roomCode: string,
  leaderVisibility: ActivityVisibility,
  log: FastifyBaseLogger,
): Promise<void> {
  emitRoundCompletedActivity(state, round, roomCode, leaderVisibility, log);
  await autoAddHandicapRounds(state, round, log);
  emitPlayerBadgeEvaluations(state, round, log);
}

function emitRoundCompletedActivity(
  state: RoundState,
  round: Round,
  roomCode: string,
  leaderVisibility: ActivityVisibility,
  log: FastifyBaseLogger,
): void {
  if (!round.groupId) return;
  const winner = state.leaderboard[0];
  const winnerPlayer = winner ? state.players.find((p) => p.id === winner.playerId) : null;
  const winnerId = winnerPlayer?.userId ?? round.leaderUserId;
  if (!winnerId) return;
  fireAndForget(
    createActivityEvent("round_completed", winnerId, round.groupId, round.id, leaderVisibility, {
      courseName: state.course.name,
      roomCode,
      playerCount: state.players.length,
      winnerName: winner?.name ?? null,
      winnerPoints: winner?.totalPoints ?? null,
    }),
    log,
    "round_completed activity event",
  );
}

async function autoAddHandicapRounds(
  state: RoundState,
  round: Round,
  log: FastifyBaseLogger,
): Promise<void> {
  for (const player of state.players) {
    if (!player.userId) continue;
    const playerUser = await getUser(player.userId);
    if (!playerUser || !playerUser.handicapAutoAdjust) continue;

    const existing = await findHandicapRoundByRoundId(player.userId, round.id);
    if (existing) continue;

    // Require at least 75% of holes scored for a valid handicap round
    const playerScores = state.scores.filter((s) => s.playerId === player.id);
    const minHoles = Math.ceil(state.course.holes.length * 0.75);
    if (playerScores.length < minHoles) continue;

    // Calculate adjusted gross score: actual strokes + par for unplayed holes
    let adjustedGross = playerScores.reduce((sum, s) => sum + s.strokes, 0);
    const scoredHoles = new Set(playerScores.map((s) => s.holeNumber));
    for (const hole of state.course.holes) {
      if (!scoredHoles.has(hole.number)) {
        adjustedGross += hole.par;
      }
    }

    const differential = calculateScoreDifferential(
      adjustedGross,
      state.course.rating,
      state.course.slope,
    );

    const count = await countHandicapRounds(player.userId);
    if (count >= 20) {
      await deleteOldestHandicapRound(player.userId);
    }

    const roundDate = (state.round.completedAt ?? new Date().toISOString()).split("T")[0];
    await createHandicapRound(
      player.userId,
      roundDate,
      state.course.name,
      adjustedGross,
      state.course.rating,
      state.course.slope,
      differential,
      round.id,
      "auto",
    );

    // Recalculate and update user handicap
    const hRounds = await listHandicapRounds(player.userId);
    const calc = calculateHandicapIndex(
      hRounds.map((r) => ({ id: r.id, differential: r.scoreDifferential })),
    );
    if (calc) {
      const oldHandicap = playerUser.handicap;
      await updateUserHandicap(player.userId, calc.handicapIndex);
      if (Math.abs(calc.handicapIndex - oldHandicap) >= 0.1) {
        fireAndForget(
          getUserGroupIds(player.userId).then((userGroups) =>
            Promise.allSettled(
              userGroups.map((gId) =>
                createActivityEvent(
                  "handicap_change",
                  player.userId!,
                  gId,
                  round.id,
                  playerUser.activityVisibility,
                  { oldHandicap, newHandicap: calc.handicapIndex },
                ),
              ),
            ),
          ),
          log,
          "handicap_change activity event",
        );
      }
    }
  }
}

function emitPlayerBadgeEvaluations(state: RoundState, round: Round, log: FastifyBaseLogger): void {
  for (const player of state.players) {
    if (!player.userId) continue;
    const userId = player.userId;
    fireAndForget(
      getUser(userId).then((playerUser) =>
        evaluateBadges({
          trigger: "round_completed",
          userId,
          roundId: round.id,
          groupId: round.groupId ?? undefined,
          roundState: state,
          visibility: playerUser?.activityVisibility ?? "public",
        }),
      ),
      log,
      "round_completed badge evaluation",
    );
  }
}
