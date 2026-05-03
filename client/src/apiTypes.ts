import type { CourseReportReason } from "@dad-golf/shared";

export interface AdminStats {
  users: number;
  courses: number;
  groups: number;
  rounds: { total: number; waiting: number; inProgress: number; complete: number };
  scores: number;
  sessions: number;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  handicap: number;
  isAdmin: boolean;
  createdAt: string;
  roundCount: number;
  courseCount: number;
}

export interface AdminRound {
  id: string;
  roomCode: string;
  courseName: string;
  leaderName: string | null;
  playerCount: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AdminCourse {
  id: string;
  name: string;
  location: string | null;
  holeCount: number;
  createdByName: string | null;
  favoriteCount: number;
  roundCount: number;
  createdAt: string;
}

export interface AdminGroup {
  id: string;
  name: string;
  ownerName: string | null;
  memberCount: number;
  createdAt: string;
}

export interface AdminCourseReport {
  courseId: string;
  courseName: string;
  courseLocation: string | null;
  reportCount: number;
  reasons: CourseReportReason[];
}

export interface GroupMemberStats {
  playerId: string;
  playerName: string;
  userId: string | null;
  roundsPlayed: number;
  wins: number;
  totalPoints: number;
  avgPoints: number;
  bestPoints: number;
  bestRoundCode: string | null;
  totalStrokes: number;
  avgStrokes: number;
  bestStrokes: number;
  bestStrokesRoundCode: string | null;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
}

export interface GroupRecord {
  type: string;
  value: number;
  playerName: string;
  courseName: string;
  roomCode: string;
  date: string;
}

export interface GroupStats {
  totalRounds: number;
  totalHolesPlayed: number;
  memberStats: GroupMemberStats[];
  records: GroupRecord[];
  courseStats: Array<{
    courseId: string;
    courseName: string;
    timesPlayed: number;
    avgPoints: number;
    avgStrokes: number;
  }>;
  recentRounds: Array<{
    roomCode: string;
    courseName: string;
    completedAt: string;
    winnerName: string | null;
    winnerPoints: number | null;
    playerCount: number;
    coursePar: number;
  }>;
}

export interface Opponent {
  userId: string;
  displayName: string;
  username: string;
  sharedRounds: number;
}

export interface H2HPlayerStats {
  userId: string;
  displayName: string;
  wins: number;
  totalPoints: number;
  avgPoints: number;
  bestPoints: number;
  totalStrokes: number;
  avgStrokes: number;
  bestStrokes: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
  par3AvgPoints: number | null;
  par4AvgPoints: number | null;
  par5AvgPoints: number | null;
  par3AvgStrokes: number | null;
  par4AvgStrokes: number | null;
  par5AvgStrokes: number | null;
}

export interface HeadToHeadStats {
  sharedRounds: number;
  draws: number;
  player1: H2HPlayerStats;
  player2: H2HPlayerStats;
  rounds: Array<{
    roomCode: string;
    courseName: string;
    completedAt: string;
    coursePar: number;
    p1Points: number;
    p1Strokes: number;
    p2Points: number;
    p2Strokes: number;
    winnerId: string | null;
  }>;
}

export interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
}

export interface UserStats {
  totalRounds: number;
  wins: number;
  totalHolesPlayed: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
  par3AvgPoints: number | null;
  par4AvgPoints: number | null;
  par5AvgPoints: number | null;
  par3AvgStrokes: number | null;
  par4AvgStrokes: number | null;
  par5AvgStrokes: number | null;
  bestRoundPoints: number | null;
  bestRoundCourse: string | null;
  bestRoundCode: string | null;
  bestRoundStrokes: number | null;
  bestStrokesRoundStrokes: number | null;
  bestStrokesRoundCourse: string | null;
  bestStrokesRoundCode: string | null;
  avgPointsPerRound: number | null;
  avgStrokesPerRound: number | null;
  courseStats: Array<{
    courseId: string;
    courseName: string;
    courseLocation: string | null;
    timesPlayed: number;
    avgPoints: number;
    bestPoints: number;
    avgStrokes: number;
    bestStrokes: number;
    coursePar: number;
  }>;
  recentRounds: Array<{
    roomCode: string;
    courseName: string;
    completedAt: string;
    totalPoints: number;
    totalStrokes: number;
    position: number;
    playerCount: number;
    coursePar: number;
  }>;
}
