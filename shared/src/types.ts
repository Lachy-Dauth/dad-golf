export interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  handicap: number;
  createdAt: string;
  isAdmin: boolean;
}

export interface Course {
  id: string;
  name: string;
  location: string | null;
  rating: number;
  slope: number;
  holes: Hole[];
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
  favoriteCount: number;
  isFavorite: boolean;
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
  leaderUserId: string | null;
  leaderName: string | null;
}

export interface Player {
  id: string;
  roundId: string;
  userId: string | null;
  name: string;
  handicap: number;
  joinedAt: string;
  isGuest: boolean;
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
  ownerUserId: string | null;
  ownerName: string | null;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string | null;
  name: string;
  handicap: number;
  createdAt: string;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  token: string;
  createdAt: string;
}

export interface LeaderboardRow {
  playerId: string;
  name: string;
  handicap: number;
  dailyHandicap: number;
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
