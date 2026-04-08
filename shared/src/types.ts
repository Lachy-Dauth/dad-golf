export interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
}

export interface Course {
  id: string;
  name: string;
  location: string | null;
  holes: Hole[];
  createdAt: string;
}

export type RoundStatus = "waiting" | "in_progress" | "complete";

export interface Round {
  id: string;
  roomCode: string;
  courseId: string;
  groupId: string | null;
  status: RoundStatus;
  currentHole: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Player {
  id: string;
  roundId: string;
  name: string;
  handicap: number;
  joinedAt: string;
}

export interface Score {
  id: string;
  roundId: string;
  playerId: string;
  holeNumber: number;
  strokes: number;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  name: string;
  handicap: number;
  createdAt: string;
}

export interface LeaderboardRow {
  playerId: string;
  name: string;
  handicap: number;
  holesPlayed: number;
  totalPoints: number;
  totalStrokes: number;
  netStrokes: number;
  pointsBack: number;
  position: number;
}

export interface RoundState {
  round: Round;
  course: Course;
  players: Player[];
  scores: Score[];
  leaderboard: LeaderboardRow[];
}

export type WsClientMessage =
  | { type: "hello"; roomCode: string }
  | { type: "ping" };

export type WsServerMessage =
  | { type: "state"; state: RoundState }
  | { type: "score_update"; score: Score; state: RoundState }
  | { type: "player_joined"; player: Player; state: RoundState }
  | { type: "round_started"; state: RoundState }
  | { type: "round_completed"; state: RoundState }
  | { type: "current_hole"; holeNumber: number; state: RoundState }
  | { type: "error"; message: string }
  | { type: "pong" };
