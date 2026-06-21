export interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
}

export type ActivityVisibility = "none" | "public";

export type Gender = "M" | "F";

export interface User {
  id: string;
  username: string;
  displayName: string;
  handicap: number;
  gender: Gender;
  handicapAutoAdjust: boolean;
  googleCalendarConnected: boolean;
  activityVisibility: ActivityVisibility;
  createdAt: string;
  isAdmin: boolean;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
}

export interface HandicapRound {
  id: string;
  userId: string;
  roundId: string | null;
  date: string;
  courseName: string;
  adjustedGrossScore: number;
  courseRating: number;
  slopeRating: number;
  scoreDifferential: number;
  sortOrder: number;
  source: "manual" | "auto";
  createdAt: string;
}

export interface Course {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  slope: number;
  holes: Hole[];
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
  favoriteCount: number;
  isFavorite: boolean;
  avgRating: number | null;
  ratingCount: number;
  roundCount: number;
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CourseReportReason = "incorrect_info" | "duplicate" | "inappropriate";

export interface Weather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
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
  gender: Gender;
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

export type GroupRole = "admin" | "member";

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string | null;
  name: string;
  handicap: number;
  role: GroupRole;
  createdAt: string;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  token: string;
  createdAt: string;
}

export type RsvpStatus = "accepted" | "declined" | "tentative";

export type ScheduledRoundStatus = "scheduled" | "started" | "cancelled";

export interface ScheduledRound {
  id: string;
  groupId: string;
  courseId: string;
  courseName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  status: ScheduledRoundStatus;
  roundId: string | null;
  roomCode: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
}

export interface ScheduledRoundRsvp {
  id: string;
  scheduledRoundId: string;
  userId: string;
  userName: string;
  status: RsvpStatus;
  updatedAt: string;
}

export interface ActiveRoundSummary {
  roomCode: string;
  courseName: string;
  status: string;
  playerCount: number;
  createdAt: string;
}

export interface UserScheduledRound extends ScheduledRound {
  groupName: string;
  rsvpStatus: RsvpStatus | null;
}

export type CompetitionType = "ctp" | "longest_drive";

export interface CompetitionClaim {
  id: string;
  competitionId: string;
  playerId: string;
  playerName: string;
  claim: string;
  isWinner: boolean;
  createdAt: string;
}

export interface HoleCompetition {
  id: string;
  roundId: string;
  holeNumber: number;
  type: CompetitionType;
  createdAt: string;
  claims: CompetitionClaim[];
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
  competitions: HoleCompetition[];
}

export interface RoundSummary {
  roomCode: string;
  courseName: string;
  courseLocation: string | null;
  date: string;
  playerCount: number;
  winnerName: string | null;
  viewerPosition: number | null;
  viewerPoints: number | null;
}

export type WsClientMessage = { type: "hello"; roomCode: string } | { type: "ping" };

export type WsServerMessage =
  | { type: "state"; state: RoundState }
  | { type: "score_update"; score: Score; state: RoundState }
  | { type: "player_joined"; player: Player; state: RoundState }
  | { type: "round_started"; state: RoundState }
  | { type: "round_completed"; state: RoundState }
  | { type: "current_hole"; holeNumber: number; state: RoundState }
  | { type: "competition_update"; state: RoundState }
  | { type: "error"; message: string }
  | { type: "pong" };

// ---- Activity Feed ----

export type ActivityEventType =
  | "round_completed"
  | "round_started"
  | "member_joined"
  | "scheduled_round_created"
  | "competition_won"
  | "handicap_change"
  | "badge_earned";

export interface ActivityFeedItem {
  id: string;
  type: ActivityEventType;
  groupId: string | null;
  groupName: string | null;
  userId: string;
  userName: string;
  username: string;
  roundId: string | null;
  roomCode: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;
}

export interface ActivityComment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

// ---- Achievement Badges ----

export type BadgeCategory = "milestones" | "scoring" | "social" | "competitions";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
}

export interface UserBadge {
  badgeId: string;
  earnedAt: string;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  handicap: number;
  createdAt: string;
  badges: UserBadge[];
  recentRounds: RoundSummary[];
  totalRounds: number;
}

// ---- Admin Types ----

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

export interface AdminActivityEvent {
  type: string;
  description: string;
  timestamp: string;
}

// ---- Stats Types ----

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
