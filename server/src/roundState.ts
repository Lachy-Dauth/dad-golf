import { computeLeaderboard } from "@dad-golf/shared";
import type { RoundState } from "@dad-golf/shared";
import {
  getCourse,
  getRoundByRoomCode,
  listPlayers,
  listScores,
} from "./db.js";

export function buildRoundState(
  roomCode: string,
  viewerUserId: string | null = null,
): RoundState | null {
  const round = getRoundByRoomCode(roomCode);
  if (!round) return null;
  const course = getCourse(round.courseId, viewerUserId);
  if (!course) return null;
  const players = listPlayers(round.id);
  const scores = listScores(round.id);
  const leaderboard = computeLeaderboard(course, players, scores);
  return { round, course, players, scores, leaderboard };
}
