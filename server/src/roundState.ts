import { computeLeaderboard } from "@dad-golf/shared";
import type { RoundState } from "@dad-golf/shared";
import {
  getCourse,
  getRoundByRoomCode,
  listPlayers,
  listScores,
} from "./db.js";

export async function buildRoundState(
  roomCode: string,
  viewerUserId: string | null = null,
): Promise<RoundState | null> {
  const round = await getRoundByRoomCode(roomCode);
  if (!round) return null;
  const course = await getCourse(round.courseId, viewerUserId);
  if (!course) return null;
  const players = await listPlayers(round.id);
  const scores = await listScores(round.id);
  const leaderboard = computeLeaderboard(course, players, scores);
  return { round, course, players, scores, leaderboard };
}
