export { initDb, closeDb } from "./schema.js";
export {
  createUser,
  getUserByUsername,
  getUser,
  authenticateUser,
  updateUserProfile,
  createSession,
  getUserBySession,
  deleteSession,
  updateUserHandicapAutoAdjust,
  updateUserHandicap,
} from "./users.js";
export {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  updateCourseCoords,
  deleteCourse,
  getCourseRoundCount,
  getCourseFavoriteCount,
  favoriteCourse,
  unfavoriteCourse,
} from "./courses.js";
export {
  createGroup,
  listGroups,
  getGroup,
  deleteGroup,
  addGroupMember,
  listGroupMembers,
  getGroupMember,
  findGroupMemberByUser,
  isUserInGroup,
  updateGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
  getUserRoleInGroup,
  countGroupAdmins,
  createGroupInvite,
  listGroupInvites,
  getGroupInviteByToken,
  deleteGroupInvite,
} from "./groups.js";
export {
  createRound,
  getRoundByRoomCode,
  getRound,
  deleteRound,
  updateRoundStatus,
  updateRoundCurrentHole,
  listRecentRounds,
  listActiveRoundsForUser,
  listUserCompletedRounds,
  listGroupCompletedRounds,
} from "./rounds.js";
export {
  addPlayer,
  findPlayerByName,
  findPlayerByUserId,
  getPlayer,
  listPlayers,
  updatePlayer,
  removePlayer,
} from "./players.js";
export { upsertScore, deleteScore, listScores } from "./scores.js";
export {
  createCompetition,
  deleteCompetition,
  getCompetition,
  upsertClaim,
  deleteClaim,
  setClaimWinner,
  clearClaimWinner,
  listCompetitions,
} from "./competitions.js";
export {
  upsertCourseReview,
  deleteCourseReview,
  getUserCourseReview,
  listCourseReviews,
} from "./courseReviews.js";
export type { AdminCourseReport } from "./courseReports.js";
export {
  createCourseReport,
  getUserCourseReport,
  listCourseReports,
  dismissCourseReports,
} from "./courseReports.js";
export {
  createScheduledRound,
  getScheduledRound,
  listScheduledRoundsForGroup,
  updateScheduledRound,
  claimScheduledRound,
  updateScheduledRoundStatus,
  deleteScheduledRound,
  upsertRsvp,
  listRsvps,
  listAcceptedRsvpUserIds,
  listScheduledRoundsForUser,
} from "./scheduledRounds.js";
export type {
  AdminStats,
  AdminUser,
  AdminRound,
  AdminCourse,
  AdminGroup,
  ActivityEvent,
} from "./admin.js";
export {
  getAdminStats,
  listAllUsers,
  listAllRounds,
  listAllCourses,
  listAllGroups,
  getActivityFeed,
  setUserAdmin,
  deleteUserAsAdmin,
  ensureAdminUser,
} from "./admin.js";
export {
  listHandicapRounds,
  getHandicapRound,
  createHandicapRound,
  updateHandicapRound,
  deleteHandicapRound,
  reorderHandicapRounds,
  countHandicapRounds,
  findHandicapRoundByRoundId,
  deleteOldestHandicapRound,
} from "./handicapRounds.js";
