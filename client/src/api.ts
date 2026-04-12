import type {
  ActiveRoundSummary,
  CompetitionType,
  Course,
  CourseReportReason,
  CourseReview,
  Group,
  GroupInvite,
  GroupMember,
  GroupRole,
  HandicapRound,
  Hole,
  Player,
  RoundState,
  RoundSummary,
  RsvpStatus,
  ScheduledRound,
  ScheduledRoundRsvp,
  Score,
  User,
  UserScheduledRound,
  Weather,
} from "@dad-golf/shared";
import type { HandicapCalculation } from "@dad-golf/shared";

// Admin types
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

export interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
}
import { getAuthToken } from "./authStore.js";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return headers;
}

function jsonHeaders(): Record<string, string> {
  return authHeaders({ "content-type": "application/json" });
}

export const api = {
  // auth
  register: (payload: {
    username: string;
    password: string;
    displayName: string;
    handicap: number;
  }) =>
    fetch("/api/auth/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ user: User; token: string }>(r)),
  login: (username: string, password: string) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ user: User; token: string }>(r)),
  logout: () =>
    fetch("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  me: () =>
    fetch("/api/auth/me", {
      headers: authHeaders(),
    }).then((r) => json<{ user: User }>(r)),
  updateProfile: (displayName: string, handicap: number) =>
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ displayName, handicap }),
    }).then((r) => json<{ user: User }>(r)),

  // courses
  listCourses: () =>
    fetch("/api/courses", { headers: authHeaders() }).then((r) => json<{ courses: Course[] }>(r)),
  getCourse: (id: string) =>
    fetch(`/api/courses/${id}`, { headers: authHeaders() }).then((r) =>
      json<{ course: Course; viewerReview: CourseReview | null }>(r),
    ),
  createCourse: (payload: {
    name: string;
    location: string | null;
    rating: number;
    slope: number;
    holes: Hole[];
  }) =>
    fetch("/api/courses", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ course: Course }>(r)),
  updateCourse: (
    id: string,
    payload: {
      name: string;
      location: string | null;
      rating: number;
      slope: number;
      holes: Hole[];
    },
  ) =>
    fetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ course: Course }>(r)),
  deleteCourse: (id: string) =>
    fetch(`/api/courses/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  favoriteCourse: (id: string) =>
    fetch(`/api/courses/${id}/favorite`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ course: Course }>(r)),
  unfavoriteCourse: (id: string) =>
    fetch(`/api/courses/${id}/favorite`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ course: Course }>(r)),

  // course reviews
  listCourseReviews: (courseId: string, limit = 20, offset = 0) =>
    fetch(`/api/courses/${courseId}/reviews?limit=${limit}&offset=${offset}`, {
      headers: authHeaders(),
    }).then((r) => json<{ reviews: CourseReview[]; total: number }>(r)),
  submitCourseReview: (courseId: string, rating: number, reviewText?: string) =>
    fetch(`/api/courses/${courseId}/reviews`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ rating, reviewText: reviewText || null }),
    }).then((r) => json<{ review: CourseReview }>(r)),
  deleteCourseReview: (courseId: string) =>
    fetch(`/api/courses/${courseId}/reviews`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),

  // course reports
  reportCourse: (courseId: string, reason: CourseReportReason) =>
    fetch(`/api/courses/${courseId}/report`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ reason }),
    }).then((r) => json<{ ok: boolean }>(r)),

  // course weather
  getCourseWeather: (courseId: string) =>
    fetch(`/api/courses/${courseId}/weather`, { headers: authHeaders() }).then((r) =>
      json<{ weather: Weather }>(r),
    ),

  // groups
  listGroups: () =>
    fetch("/api/groups", { headers: authHeaders() }).then((r) =>
      json<{ groups: Array<Group & { members: GroupMember[] }> }>(r),
    ),
  getGroup: (id: string) =>
    fetch(`/api/groups/${id}`, { headers: authHeaders() }).then((r) =>
      json<{ group: Group; members: GroupMember[] }>(r),
    ),
  createGroup: (name: string) =>
    fetch("/api/groups", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name }),
    }).then((r) => json<{ group: Group; members: GroupMember[] }>(r)),
  deleteGroup: (id: string) =>
    fetch(`/api/groups/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  addGroupMember: (groupId: string, name: string, handicap: number) =>
    fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ member: GroupMember }>(r)),
  updateGroupMember: (groupId: string, memberId: string, name: string, handicap: number) =>
    fetch(`/api/groups/${groupId}/members/${memberId}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ ok: boolean }>(r)),
  removeGroupMember: (groupId: string, memberId: string) =>
    fetch(`/api/groups/${groupId}/members/${memberId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  updateGroupMemberRole: (groupId: string, memberId: string, role: GroupRole) =>
    fetch(`/api/groups/${groupId}/members/${memberId}/role`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ role }),
    }).then((r) => json<{ ok: boolean }>(r)),

  // group invites
  listGroupInvites: (groupId: string) =>
    fetch(`/api/groups/${groupId}/invites`, { headers: authHeaders() }).then((r) =>
      json<{ invites: GroupInvite[] }>(r),
    ),
  createGroupInvite: (groupId: string) =>
    fetch(`/api/groups/${groupId}/invites`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ invite: GroupInvite }>(r)),
  deleteGroupInvite: (groupId: string, inviteId: string) =>
    fetch(`/api/groups/${groupId}/invites/${inviteId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  getInvite: (token: string) =>
    fetch(`/api/group-invites/${token}`).then((r) =>
      json<{ invite: GroupInvite; group: Group; memberCount: number }>(r),
    ),
  acceptInvite: (token: string) =>
    fetch(`/api/group-invites/${token}/accept`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ group: Group; member: GroupMember }>(r)),

  // scheduled rounds
  listScheduledRounds: (groupId: string) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds`, { headers: authHeaders() }).then((r) =>
      json<{ scheduledRounds: ScheduledRound[]; rsvps: Record<string, ScheduledRoundRsvp[]> }>(r),
    ),
  getScheduledRound: (groupId: string, id: string) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds/${id}`, { headers: authHeaders() }).then((r) =>
      json<{ scheduledRound: ScheduledRound; rsvps: ScheduledRoundRsvp[] }>(r),
    ),
  createScheduledRound: (
    groupId: string,
    payload: {
      courseId: string;
      scheduledDate: string;
      scheduledTime?: string;
      durationMinutes?: number;
      notes?: string;
    },
  ) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ scheduledRound: ScheduledRound }>(r)),
  updateScheduledRound: (
    groupId: string,
    id: string,
    payload: {
      courseId?: string;
      scheduledDate?: string;
      scheduledTime?: string | null;
      durationMinutes?: number | null;
      notes?: string | null;
    },
  ) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds/${id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ scheduledRound: ScheduledRound }>(r)),
  cancelScheduledRound: (groupId: string, id: string) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  rsvpScheduledRound: (groupId: string, id: string, status: RsvpStatus) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds/${id}/rsvp`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ status }),
    }).then((r) => json<{ rsvp: ScheduledRoundRsvp }>(r)),
  startScheduledRound: (groupId: string, id: string) =>
    fetch(`/api/groups/${groupId}/scheduled-rounds/${id}/start`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ state: RoundState }>(r)),

  // my (user-specific cross-group queries)
  myActiveRounds: () =>
    fetch("/api/my/rounds", { headers: authHeaders() }).then((r) =>
      json<{ rounds: ActiveRoundSummary[] }>(r),
    ),
  myScheduledRounds: () =>
    fetch("/api/my/scheduled-rounds", { headers: authHeaders() }).then((r) =>
      json<{ scheduledRounds: UserScheduledRound[] }>(r),
    ),

  // round history
  listMyRounds: (limit = 20, offset = 0) =>
    fetch(`/api/users/me/rounds?limit=${limit}&offset=${offset}`, {
      headers: authHeaders(),
    }).then((r) => json<{ rounds: RoundSummary[]; total: number }>(r)),
  listGroupRounds: (groupId: string, limit = 20, offset = 0) =>
    fetch(`/api/groups/${groupId}/rounds?limit=${limit}&offset=${offset}`, {
      headers: authHeaders(),
    }).then((r) => json<{ rounds: RoundSummary[]; total: number }>(r)),

  // rounds
  createRound: (payload: { courseId: string; groupId: string | null; memberIds: string[] }) =>
    fetch("/api/rounds", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ state: RoundState }>(r)),
  getRound: (code: string) =>
    fetch(`/api/rounds/${code}`, { headers: authHeaders() }).then((r) =>
      json<{ state: RoundState }>(r),
    ),
  joinRound: (code: string, payload: { name?: string; handicap?: number } = {}) =>
    fetch(`/api/rounds/${code}/players`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ player: Player; state: RoundState }>(r)),
  updateRoundPlayer: (code: string, playerId: string, name: string, handicap: number) =>
    fetch(`/api/rounds/${code}/players/${playerId}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ ok: boolean; state: RoundState }>(r)),
  removeRoundPlayer: (code: string, playerId: string) =>
    fetch(`/api/rounds/${code}/players/${playerId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  startRound: (code: string) =>
    fetch(`/api/rounds/${code}/start`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ state: RoundState }>(r)),
  completeRound: (code: string) =>
    fetch(`/api/rounds/${code}/complete`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ state: RoundState }>(r)),
  setCurrentHole: (code: string, holeNumber: number) =>
    fetch(`/api/rounds/${code}/current-hole`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ holeNumber }),
    }).then((r) => json<{ state: RoundState }>(r)),
  submitScore: (code: string, playerId: string, holeNumber: number, strokes: number) =>
    fetch(`/api/rounds/${code}/scores`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ playerId, holeNumber, strokes }),
    }).then((r) => json<{ score: Score; state: RoundState }>(r)),
  clearScore: (code: string, playerId: string, holeNumber: number) =>
    fetch(`/api/rounds/${code}/scores`, {
      method: "DELETE",
      headers: jsonHeaders(),
      body: JSON.stringify({ playerId, holeNumber }),
    }).then((r) => json<{ ok: boolean }>(r)),

  // competitions
  createCompetition: (code: string, holeNumber: number, type: CompetitionType) =>
    fetch(`/api/rounds/${code}/competitions`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ holeNumber, type }),
    }).then((r) => json<{ state: RoundState }>(r)),
  deleteCompetition: (code: string, competitionId: string) =>
    fetch(`/api/rounds/${code}/competitions/${competitionId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  submitClaim: (code: string, competitionId: string, playerId: string, claim: string) =>
    fetch(`/api/rounds/${code}/competitions/${competitionId}/claims`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ playerId, claim }),
    }).then((r) => json<{ state: RoundState }>(r)),
  deleteClaim: (code: string, competitionId: string, playerId: string) =>
    fetch(`/api/rounds/${code}/competitions/${competitionId}/claims`, {
      method: "DELETE",
      headers: jsonHeaders(),
      body: JSON.stringify({ playerId }),
    }).then((r) => json<{ ok: boolean }>(r)),
  setCompetitionWinner: (code: string, competitionId: string, playerId: string) =>
    fetch(`/api/rounds/${code}/competitions/${competitionId}/winner`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ playerId }),
    }).then((r) => json<{ state: RoundState }>(r)),
  clearCompetitionWinner: (code: string, competitionId: string) =>
    fetch(`/api/rounds/${code}/competitions/${competitionId}/winner`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),

  // weather
  getRoundWeather: (code: string) =>
    fetch(`/api/rounds/${code}/weather`, { headers: authHeaders() }).then((r) =>
      json<{ weather: Weather }>(r),
    ),

  // admin
  adminStats: () =>
    fetch("/api/admin/stats", { headers: authHeaders() }).then((r) => json<AdminStats>(r)),
  adminUsers: () =>
    fetch("/api/admin/users", { headers: authHeaders() }).then((r) =>
      json<{ users: AdminUser[] }>(r),
    ),
  adminDeleteUser: (id: string) =>
    fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  adminRounds: (limit = 50, offset = 0) =>
    fetch(`/api/admin/rounds?limit=${limit}&offset=${offset}`, {
      headers: authHeaders(),
    }).then((r) => json<{ rounds: AdminRound[]; total: number }>(r)),
  adminCourses: () =>
    fetch("/api/admin/courses", { headers: authHeaders() }).then((r) =>
      json<{ courses: AdminCourse[] }>(r),
    ),
  adminGroups: () =>
    fetch("/api/admin/groups", { headers: authHeaders() }).then((r) =>
      json<{ groups: AdminGroup[] }>(r),
    ),
  adminDeleteRound: (id: string) =>
    fetch(`/api/admin/rounds/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
  adminActivity: (limit = 50) =>
    fetch(`/api/admin/activity?limit=${limit}`, {
      headers: authHeaders(),
    }).then((r) => json<{ events: ActivityEvent[] }>(r)),
  adminCourseReports: () =>
    fetch("/api/admin/course-reports", { headers: authHeaders() }).then((r) =>
      json<{ reports: AdminCourseReport[] }>(r),
    ),
  adminDismissCourseReports: (courseId: string) =>
    fetch(`/api/admin/course-reports/${courseId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),

  // handicap
  getHandicap: () =>
    fetch("/api/handicap", { headers: authHeaders() }).then((r) =>
      json<{
        autoAdjust: boolean;
        rounds: HandicapRound[];
        calculation: HandicapCalculation | null;
        currentHandicap: number;
      }>(r),
    ),
  updateHandicapSettings: (autoAdjust: boolean) =>
    fetch("/api/handicap/settings", {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ autoAdjust }),
    }).then((r) => json<{ user: User }>(r)),
  addHandicapRound: (payload: {
    date: string;
    courseName: string;
    adjustedGrossScore: number;
    courseRating: number;
    slopeRating: number;
  }) =>
    fetch("/api/handicap/rounds", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ round: HandicapRound; calculation: HandicapCalculation | null }>(r)),
  updateHandicapRound: (
    id: string,
    payload: {
      date: string;
      courseName: string;
      adjustedGrossScore: number;
      courseRating: number;
      slopeRating: number;
    },
  ) =>
    fetch(`/api/handicap/rounds/${id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }).then((r) => json<{ round: HandicapRound; calculation: HandicapCalculation | null }>(r)),
  deleteHandicapRound: (id: string) =>
    fetch(`/api/handicap/rounds/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean; calculation: HandicapCalculation | null }>(r)),
  reorderHandicapRounds: (orderedIds: string[]) =>
    fetch("/api/handicap/rounds/reorder", {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ orderedIds }),
    }).then((r) => json<{ rounds: HandicapRound[]; calculation: HandicapCalculation | null }>(r)),
  applyHandicap: () =>
    fetch("/api/handicap/apply", {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => json<{ user: User; calculation: HandicapCalculation }>(r)),

  // google calendar
  googleCalendarAvailable: () =>
    fetch("/api/google-calendar/available").then((r) => json<{ available: boolean }>(r)),
  googleCalendarAuthUrl: () =>
    fetch("/api/google-calendar/auth-url", { headers: authHeaders() }).then((r) =>
      json<{ url: string }>(r),
    ),
  googleCalendarStatus: () =>
    fetch("/api/google-calendar/status", { headers: authHeaders() }).then((r) =>
      json<{ connected: boolean; email: string | null; calendarId: string | null }>(r),
    ),
  googleCalendarCalendars: () =>
    fetch("/api/google-calendar/calendars", { headers: authHeaders() }).then((r) =>
      json<{ calendars: Array<{ id: string; name: string; primary: boolean }> }>(r),
    ),
  googleCalendarUpdateSettings: (calendarId: string) =>
    fetch("/api/google-calendar/settings", {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ calendarId }),
    }).then((r) => json<{ ok: boolean }>(r)),
  googleCalendarDisconnect: () =>
    fetch("/api/google-calendar", {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => json<{ ok: boolean }>(r)),
};
