import { computeLeaderboard } from "@dad-golf/shared";
import type { RoundState } from "@dad-golf/shared";
import {
  getCourse,
  getRoundByRoomCode,
  listPlayers,
  listScores,
  listCompetitions,
} from "./db/index.js";

export async function buildRoundState(
  roomCode: string,
  viewerUserId: string | null = null,
): Promise<RoundState | null> {
  const round = await getRoundByRoomCode(roomCode);
  if (!round) return null;
  const [course, players, scores, competitions] = await Promise.all([
    getCourse(round.courseId, viewerUserId),
    listPlayers(round.id),
    listScores(round.id),
    listCompetitions(round.id),
  ]);
  if (!course) return null;
  const leaderboard = computeLeaderboard(course, players, scores);
  return { round, course, players, scores, leaderboard, competitions };
}
