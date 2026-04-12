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
} from "./users.js";
export {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  updateCourseCoords,
  deleteCourse,
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
  createGroupInvite,
  listGroupInvites,
  getGroupInviteByToken,
  deleteGroupInvite,
} from "./groups.js";
export {
  createRound,
  getRoundByRoomCode,
  getRound,
  updateRoundStatus,
  updateRoundCurrentHole,
  listRecentRounds,
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
