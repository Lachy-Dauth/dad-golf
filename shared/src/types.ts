export interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
}

export type ActivityVisibility = "none" | "group" | "all";

export interface User {
  id: string;
  username: string;
  displayName: string;
  handicap: number;
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
