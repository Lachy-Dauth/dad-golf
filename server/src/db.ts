import pg from "pg";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  Course,
  Group,
  GroupInvite,
  GroupMember,
  Hole,
  Player,
  Round,
  RoundStatus,
  Score,
  User,
} from "@dad-golf/shared";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=")
    ? { rejectUnauthorized: false }
    : undefined,
});

export async function initDb(): Promise<void> {
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  handicap DOUBLE PRECISION NOT NULL DEFAULT 18.0,
  created_at TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  rating DOUBLE PRECISION NOT NULL DEFAULT 72.0,
  slope INTEGER NOT NULL DEFAULT 113,
  holes_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_course_favorites_course ON course_favorites(course_id);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  handicap DOUBLE PRECISION NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_invites_group ON group_invites(group_id);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  course_id TEXT NOT NULL REFERENCES courses(id),
  group_id TEXT REFERENCES groups(id),
  status TEXT NOT NULL,
  current_hole INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  leader_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rounds_room_code ON rounds(room_code);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  handicap DOUBLE PRECISION NOT NULL,
  joined_at TEXT NOT NULL,
  UNIQUE(round_id, name)
);
CREATE INDEX IF NOT EXISTS idx_players_round ON players(round_id);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  strokes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(player_id, hole_number)
);
CREATE INDEX IF NOT EXISTS idx_scores_round ON scores(round_id);
  `);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

// ---------- helpers ----------
const now = () => new Date().toISOString();
const newId = () => randomUUID();

// ---------- users / auth ----------
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  handicap: number;
  created_at: string;
  is_admin: number;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    handicap: Number(row.handicap),
    createdAt: row.created_at,
    isAdmin: Boolean(row.is_admin),
  };
}

export async function createUser(
  username: string,
  password: string,
  displayName: string,
  handicap: number,
): Promise<User> {
  const id = newId();
  const createdAt = now();
  const passwordHash = hashPassword(password);
  await pool.query(
    `INSERT INTO users (id, username, password_hash, display_name, handicap, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, username.toLowerCase(), passwordHash, displayName, handicap, createdAt],
  );
  return {
    id,
    username: username.toLowerCase(),
    displayName,
    handicap,
    createdAt,
    isAdmin: false,
  };
}

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE username = $1`,
    [username.toLowerCase()],
  );
  return (rows[0] as UserRow) ?? null;
}

export async function getUser(id: string): Promise<User | null> {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE id = $1`,
    [id],
  );
  const row = rows[0] as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<User | null> {
  const row = await getUserByUsername(username);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export async function updateUserProfile(
  userId: string,
  displayName: string,
  handicap: number,
): Promise<void> {
  await pool.query(
    `UPDATE users SET display_name = $1, handicap = $2 WHERE id = $3`,
    [displayName, handicap, userId],
  );
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3)`,
    [token, userId, now()],
  );
  return token;
}

export async function getUserBySession(token: string): Promise<User | null> {
  const { rows } = await pool.query(
    `SELECT users.* FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = $1`,
    [token],
  );
  const row = rows[0] as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// ---------- courses ----------
export async function createCourse(
  name: string,
  location: string | null,
  rating: number,
  slope: number,
  holes: Hole[],
  createdByUserId: string,
): Promise<Course> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO courses (id, name, location, rating, slope, holes_json, created_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, location, rating, slope, JSON.stringify(holes), createdAt, createdByUserId],
  );
  const creator = await getUser(createdByUserId);
  return {
    id,
    name,
    location,
    rating,
    slope,
    holes,
    createdAt,
    createdByUserId,
    createdByName: creator?.displayName ?? null,
    favoriteCount: 0,
    isFavorite: false,
  };
}

interface CourseRow {
  id: string;
  name: string;
  location: string | null;
  rating: number;
  slope: number;
  holes_json: string;
  created_at: string;
  created_by_user_id: string | null;
}

interface CourseListRow extends CourseRow {
  creator_name: string | null;
  favorite_count: string;
  is_favorite: string;
}

function rowToCourse(row: CourseListRow): Course {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    rating: Number(row.rating),
    slope: Number(row.slope),
    holes: JSON.parse(row.holes_json) as Hole[],
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    createdByName: row.creator_name,
    favoriteCount: Number(row.favorite_count) || 0,
    isFavorite: Number(row.is_favorite) > 0,
  };
}

export async function listCourses(viewerUserId: string | null): Promise<Course[]> {
  const { rows } = await pool.query(
    `SELECT c.*,
            u.display_name AS creator_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            CASE WHEN $1::text IS NULL THEN 0
                 ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = $1)
            END AS is_favorite
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id
       ORDER BY favorite_count DESC, c.name ASC`,
    [viewerUserId],
  );
  return (rows as CourseListRow[]).map(rowToCourse);
}

export async function getCourse(
  id: string,
  viewerUserId: string | null = null,
): Promise<Course | null> {
  const { rows } = await pool.query(
    `SELECT c.*,
            u.display_name AS creator_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            CASE WHEN $1::text IS NULL THEN 0
                 ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = $1)
            END AS is_favorite
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id
       WHERE c.id = $2`,
    [viewerUserId, id],
  );
  const row = rows[0] as CourseListRow | undefined;
  return row ? rowToCourse(row) : null;
}

export async function updateCourse(
  id: string,
  name: string,
  location: string | null,
  rating: number,
  slope: number,
  holes: Hole[],
): Promise<void> {
  await pool.query(
    `UPDATE courses SET name = $1, location = $2, rating = $3, slope = $4, holes_json = $5 WHERE id = $6`,
    [name, location, rating, slope, JSON.stringify(holes), id],
  );
}

export async function deleteCourse(id: string): Promise<void> {
  await pool.query(`DELETE FROM courses WHERE id = $1`, [id]);
}

export async function getCourseFavoriteCount(courseId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS n FROM course_favorites WHERE course_id = $1`,
    [courseId],
  );
  return Number((rows[0] as { n: string }).n);
}

export async function favoriteCourse(userId: string, courseId: string): Promise<void> {
  await pool.query(
    `INSERT INTO course_favorites (user_id, course_id, created_at) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, courseId, now()],
  );
}

export async function unfavoriteCourse(userId: string, courseId: string): Promise<void> {
  await pool.query(
    `DELETE FROM course_favorites WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId],
  );
}

// ---------- groups ----------
interface GroupRow {
  id: string;
  name: string;
  created_at: string;
  owner_user_id: string | null;
}
interface GroupListRow extends GroupRow {
  owner_name: string | null;
}

function rowToGroup(row: GroupListRow): Group {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
  };
}

export async function createGroup(name: string, ownerUserId: string): Promise<Group> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO groups (id, name, created_at, owner_user_id) VALUES ($1, $2, $3, $4)`,
    [id, name, createdAt, ownerUserId],
  );
  const owner = await getUser(ownerUserId);
  return {
    id,
    name,
    createdAt,
    ownerUserId,
    ownerName: owner?.displayName ?? null,
  };
}

export async function listGroups(): Promise<Group[]> {
  const { rows } = await pool.query(
    `SELECT g.*, u.display_name AS owner_name
       FROM groups g
       LEFT JOIN users u ON u.id = g.owner_user_id
       ORDER BY g.name ASC`,
  );
  return (rows as GroupListRow[]).map(rowToGroup);
}

export async function getGroup(id: string): Promise<Group | null> {
  const { rows } = await pool.query(
    `SELECT g.*, u.display_name AS owner_name
       FROM groups g
       LEFT JOIN users u ON u.id = g.owner_user_id
       WHERE g.id = $1`,
    [id],
  );
  const row = rows[0] as GroupListRow | undefined;
  return row ? rowToGroup(row) : null;
}

export async function deleteGroup(id: string): Promise<void> {
  await pool.query(`DELETE FROM groups WHERE id = $1`, [id]);
}

interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  handicap: number;
  created_at: string;
}

function rowToGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    name: row.name,
    handicap: Number(row.handicap),
    createdAt: row.created_at,
  };
}

export async function addGroupMember(
  groupId: string,
  name: string,
  handicap: number,
  userId: string | null = null,
): Promise<GroupMember> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO group_members (id, group_id, user_id, name, handicap, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, groupId, userId, name, handicap, createdAt],
  );
  return { id, groupId, userId, name, handicap, createdAt };
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { rows } = await pool.query(
    `SELECT * FROM group_members WHERE group_id = $1 ORDER BY created_at ASC`,
    [groupId],
  );
  return (rows as GroupMemberRow[]).map(rowToGroupMember);
}

export async function getGroupMember(memberId: string): Promise<GroupMember | null> {
  const { rows } = await pool.query(
    `SELECT * FROM group_members WHERE id = $1`,
    [memberId],
  );
  const row = rows[0] as GroupMemberRow | undefined;
  return row ? rowToGroupMember(row) : null;
}

export async function findGroupMemberByUser(
  groupId: string,
  userId: string,
): Promise<GroupMember | null> {
  const { rows } = await pool.query(
    `SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  const row = rows[0] as GroupMemberRow | undefined;
  return row ? rowToGroupMember(row) : null;
}

export async function isUserInGroup(groupId: string, userId: string): Promise<boolean> {
  if (!groupId || !userId) return false;
  const { rows: memberRows } = await pool.query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
    [groupId, userId],
  );
  if (memberRows.length > 0) return true;
  const { rows: ownerRows } = await pool.query(
    `SELECT owner_user_id FROM groups WHERE id = $1`,
    [groupId],
  );
  const owner = ownerRows[0] as { owner_user_id: string | null } | undefined;
  return owner?.owner_user_id === userId;
}

export async function updateGroupMember(
  memberId: string,
  name: string,
  handicap: number,
): Promise<void> {
  await pool.query(
    `UPDATE group_members SET name = $1, handicap = $2 WHERE id = $3`,
    [name, handicap, memberId],
  );
}

export async function removeGroupMember(memberId: string): Promise<void> {
  await pool.query(`DELETE FROM group_members WHERE id = $1`, [memberId]);
}

// ---------- group invites ----------
export async function createGroupInvite(groupId: string): Promise<GroupInvite> {
  const id = newId();
  const token = randomBytes(12).toString("hex");
  const createdAt = now();
  await pool.query(
    `INSERT INTO group_invites (id, group_id, token, created_at) VALUES ($1, $2, $3, $4)`,
    [id, groupId, token, createdAt],
  );
  return { id, groupId, token, createdAt };
}

interface GroupInviteRow {
  id: string;
  group_id: string;
  token: string;
  created_at: string;
}

function rowToGroupInvite(row: GroupInviteRow): GroupInvite {
  return {
    id: row.id,
    groupId: row.group_id,
    token: row.token,
    createdAt: row.created_at,
  };
}

export async function listGroupInvites(groupId: string): Promise<GroupInvite[]> {
  const { rows } = await pool.query(
    `SELECT * FROM group_invites WHERE group_id = $1 ORDER BY created_at DESC`,
    [groupId],
  );
  return (rows as GroupInviteRow[]).map(rowToGroupInvite);
}

export async function getGroupInviteByToken(token: string): Promise<GroupInvite | null> {
  const { rows } = await pool.query(
    `SELECT * FROM group_invites WHERE token = $1`,
    [token],
  );
  const row = rows[0] as GroupInviteRow | undefined;
  return row ? rowToGroupInvite(row) : null;
}

export async function deleteGroupInvite(id: string): Promise<void> {
  await pool.query(`DELETE FROM group_invites WHERE id = $1`, [id]);
}

// ---------- rounds ----------
export async function createRound(
  roomCode: string,
  courseId: string,
  groupId: string | null,
  leaderUserId: string,
): Promise<Round> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO rounds (id, room_code, course_id, group_id, status, current_hole, created_at, leader_user_id)
     VALUES ($1, $2, $3, $4, 'waiting', 1, $5, $6)`,
    [id, roomCode, courseId, groupId, createdAt, leaderUserId],
  );
  const leader = await getUser(leaderUserId);
  return {
    id,
    roomCode,
    courseId,
    groupId,
    status: "waiting",
    currentHole: 1,
    createdAt,
    startedAt: null,
    completedAt: null,
    leaderUserId,
    leaderName: leader?.displayName ?? null,
  };
}

interface RoundRow {
  id: string;
  room_code: string;
  course_id: string;
  group_id: string | null;
  status: RoundStatus;
  current_hole: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  leader_user_id: string | null;
}

interface RoundListRow extends RoundRow {
  leader_name: string | null;
}

function rowToRound(row: RoundListRow): Round {
  return {
    id: row.id,
    roomCode: row.room_code,
    courseId: row.course_id,
    groupId: row.group_id,
    status: row.status,
    currentHole: Number(row.current_hole),
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    leaderUserId: row.leader_user_id,
    leaderName: row.leader_name,
  };
}

export async function getRoundByRoomCode(roomCode: string): Promise<Round | null> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.leader_user_id
       WHERE r.room_code = $1`,
    [roomCode],
  );
  const row = rows[0] as RoundListRow | undefined;
  return row ? rowToRound(row) : null;
}

export async function getRound(id: string): Promise<Round | null> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.leader_user_id
       WHERE r.id = $1`,
    [id],
  );
  const row = rows[0] as RoundListRow | undefined;
  return row ? rowToRound(row) : null;
}

export async function updateRoundStatus(id: string, status: RoundStatus): Promise<void> {
  if (status === "in_progress") {
    await pool.query(
      `UPDATE rounds SET status = $1, started_at = COALESCE(started_at, $2) WHERE id = $3`,
      [status, now(), id],
    );
  } else if (status === "complete") {
    await pool.query(
      `UPDATE rounds SET status = $1, completed_at = $2 WHERE id = $3`,
      [status, now(), id],
    );
  } else {
    await pool.query(
      `UPDATE rounds SET status = $1 WHERE id = $2`,
      [status, id],
    );
  }
}

export async function updateRoundCurrentHole(id: string, holeNumber: number): Promise<void> {
  await pool.query(
    `UPDATE rounds SET current_hole = $1 WHERE id = $2`,
    [holeNumber, id],
  );
}

export async function listRecentRounds(limit = 20): Promise<Round[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.display_name AS leader_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.leader_user_id
       ORDER BY r.created_at DESC LIMIT $1`,
    [limit],
  );
  return (rows as RoundListRow[]).map(rowToRound);
}

// ---------- players ----------
interface PlayerRow {
  id: string;
  round_id: string;
  user_id: string | null;
  name: string;
  handicap: number;
  joined_at: string;
}

function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    roundId: row.round_id,
    userId: row.user_id,
    name: row.name,
    handicap: Number(row.handicap),
    joinedAt: row.joined_at,
    isGuest: row.user_id === null,
  };
}

export async function addPlayer(
  roundId: string,
  name: string,
  handicap: number,
  userId: string | null = null,
): Promise<Player> {
  const id = newId();
  const joinedAt = now();
  await pool.query(
    `INSERT INTO players (id, round_id, user_id, name, handicap, joined_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, roundId, userId, name, handicap, joinedAt],
  );
  return {
    id,
    roundId,
    userId,
    name,
    handicap,
    joinedAt,
    isGuest: userId === null,
  };
}

export async function findPlayerByName(
  roundId: string,
  name: string,
): Promise<Player | null> {
  const { rows } = await pool.query(
    `SELECT * FROM players WHERE round_id = $1 AND name = $2`,
    [roundId, name],
  );
  const row = rows[0] as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export async function findPlayerByUserId(
  roundId: string,
  userId: string,
): Promise<Player | null> {
  const { rows } = await pool.query(
    `SELECT * FROM players WHERE round_id = $1 AND user_id = $2`,
    [roundId, userId],
  );
  const row = rows[0] as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export async function getPlayer(playerId: string): Promise<Player | null> {
  const { rows } = await pool.query(
    `SELECT * FROM players WHERE id = $1`,
    [playerId],
  );
  const row = rows[0] as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export async function listPlayers(roundId: string): Promise<Player[]> {
  const { rows } = await pool.query(
    `SELECT * FROM players WHERE round_id = $1 ORDER BY joined_at ASC`,
    [roundId],
  );
  return (rows as PlayerRow[]).map(rowToPlayer);
}

export async function updatePlayer(
  playerId: string,
  name: string,
  handicap: number,
): Promise<void> {
  await pool.query(
    `UPDATE players SET name = $1, handicap = $2 WHERE id = $3`,
    [name, handicap, playerId],
  );
}

export async function removePlayer(playerId: string): Promise<void> {
  await pool.query(`DELETE FROM players WHERE id = $1`, [playerId]);
}

// ---------- scores ----------
interface ScoreRow {
  id: string;
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
  created_at: string;
}

function rowToScore(row: ScoreRow): Score {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    holeNumber: Number(row.hole_number),
    strokes: Number(row.strokes),
    createdAt: row.created_at,
  };
}

export async function upsertScore(
  roundId: string,
  playerId: string,
  holeNumber: number,
  strokes: number,
): Promise<Score> {
  const id = newId();
  const createdAt = now();
  const { rows } = await pool.query(
    `INSERT INTO scores (id, round_id, player_id, hole_number, strokes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (player_id, hole_number) DO UPDATE
       SET strokes = EXCLUDED.strokes, created_at = EXCLUDED.created_at
     RETURNING *`,
    [id, roundId, playerId, holeNumber, strokes, createdAt],
  );
  return rowToScore(rows[0] as ScoreRow);
}

export async function deleteScore(playerId: string, holeNumber: number): Promise<void> {
  await pool.query(
    `DELETE FROM scores WHERE player_id = $1 AND hole_number = $2`,
    [playerId, holeNumber],
  );
}

export async function listScores(roundId: string): Promise<Score[]> {
  const { rows } = await pool.query(
    `SELECT * FROM scores WHERE round_id = $1 ORDER BY hole_number ASC`,
    [roundId],
  );
  return (rows as ScoreRow[]).map(rowToScore);
}

// ---------- admin ----------
export interface AdminStats {
  users: number;
  courses: number;
  groups: number;
  rounds: { total: number; waiting: number; inProgress: number; complete: number };
  scores: number;
  sessions: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const count = async (table: string) => {
    const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`);
    return Number((rows[0] as { n: string }).n);
  };
  const { rows: roundsByStatus } = await pool.query(
    `SELECT status, COUNT(*) AS n FROM rounds GROUP BY status`,
  );
  const statusMap: Record<string, number> = {};
  for (const r of roundsByStatus as Array<{ status: string; n: string }>) {
    statusMap[r.status] = Number(r.n);
  }
  return {
    users: await count("users"),
    courses: await count("courses"),
    groups: await count("groups"),
    rounds: {
      total: (statusMap["waiting"] ?? 0) + (statusMap["in_progress"] ?? 0) + (statusMap["complete"] ?? 0),
      waiting: statusMap["waiting"] ?? 0,
      inProgress: statusMap["in_progress"] ?? 0,
      complete: statusMap["complete"] ?? 0,
    },
    scores: await count("scores"),
    sessions: await count("sessions"),
  };
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

export async function listAllUsers(): Promise<AdminUser[]> {
  const { rows } = await pool.query(
    `SELECT u.*,
            (SELECT COUNT(*) FROM players p WHERE p.user_id = u.id) AS round_count,
            (SELECT COUNT(*) FROM courses c WHERE c.created_by_user_id = u.id) AS course_count
       FROM users u
       ORDER BY u.created_at DESC`,
  );
  return (rows as Array<UserRow & { round_count: string; course_count: string }>).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    handicap: Number(r.handicap),
    isAdmin: Number(r.is_admin) > 0,
    createdAt: r.created_at,
    roundCount: Number(r.round_count),
    courseCount: Number(r.course_count),
  }));
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

export async function listAllRounds(
  limit = 50,
  offset = 0,
): Promise<{ rounds: AdminRound[]; total: number }> {
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS n FROM rounds`,
  );
  const total = Number((countRows[0] as { n: string }).n);
  const { rows } = await pool.query(
    `SELECT r.id, r.room_code, r.status, r.created_at, r.started_at, r.completed_at,
            COALESCE(c.name, 'Unknown') AS course_name,
            u.display_name AS leader_name,
            (SELECT COUNT(*) FROM players p WHERE p.round_id = r.id) AS player_count
       FROM rounds r
       LEFT JOIN courses c ON c.id = r.course_id
       LEFT JOIN users u ON u.id = r.leader_user_id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return {
    rounds: (rows as Array<{
      id: string;
      room_code: string;
      status: string;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
      course_name: string;
      leader_name: string | null;
      player_count: string;
    }>).map((r) => ({
      id: r.id,
      roomCode: r.room_code,
      courseName: r.course_name,
      leaderName: r.leader_name,
      playerCount: Number(r.player_count),
      status: r.status,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    })),
    total,
  };
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

export async function listAllCourses(): Promise<AdminCourse[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.location, c.holes_json, c.created_at,
            u.display_name AS created_by_name,
            (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
            (SELECT COUNT(*) FROM rounds r WHERE r.course_id = c.id) AS round_count
       FROM courses c
       LEFT JOIN users u ON u.id = c.created_by_user_id
       ORDER BY c.name ASC`,
  );
  return (rows as Array<{
    id: string;
    name: string;
    location: string | null;
    holes_json: string;
    created_at: string;
    created_by_name: string | null;
    favorite_count: string;
    round_count: string;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    holeCount: (JSON.parse(r.holes_json) as unknown[]).length,
    createdByName: r.created_by_name,
    favoriteCount: Number(r.favorite_count),
    roundCount: Number(r.round_count),
    createdAt: r.created_at,
  }));
}

export interface AdminGroup {
  id: string;
  name: string;
  ownerName: string | null;
  memberCount: number;
  createdAt: string;
}

export async function listAllGroups(): Promise<AdminGroup[]> {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.created_at,
            u.display_name AS owner_name,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
       FROM groups g
       LEFT JOIN users u ON u.id = g.owner_user_id
       ORDER BY g.name ASC`,
  );
  return (rows as Array<{
    id: string;
    name: string;
    created_at: string;
    owner_name: string | null;
    member_count: string;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    ownerName: r.owner_name,
    memberCount: Number(r.member_count),
    createdAt: r.created_at,
  }));
}

export interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
}

export async function getActivityFeed(limit = 50): Promise<ActivityEvent[]> {
  const { rows } = await pool.query(
    `SELECT type, description, timestamp FROM (
       SELECT 'user_registered' AS type,
              'New user: ' || display_name || ' (@' || username || ')' AS description,
              created_at AS timestamp
         FROM users
       UNION ALL
       SELECT 'round_created' AS type,
              'Round created: ' || r.room_code || ' on ' || COALESCE(c.name, 'Unknown') AS description,
              r.created_at AS timestamp
         FROM rounds r LEFT JOIN courses c ON c.id = r.course_id
       UNION ALL
       SELECT 'round_completed' AS type,
              'Round completed: ' || r.room_code || ' on ' || COALESCE(c.name, 'Unknown') AS description,
              r.completed_at AS timestamp
         FROM rounds r LEFT JOIN courses c ON c.id = r.course_id
         WHERE r.completed_at IS NOT NULL
     ) events
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit],
  );
  return rows as ActivityEvent[];
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await pool.query(
    `UPDATE users SET is_admin = $1 WHERE id = $2`,
    [isAdmin ? 1 : 0, userId],
  );
}

export async function deleteUserAsAdmin(userId: string): Promise<void> {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

export async function ensureAdminUser(password: string): Promise<void> {
  const existing = await getUserByUsername("admin");
  if (existing) {
    const newHash = hashPassword(password);
    await pool.query(
      `UPDATE users SET password_hash = $1, is_admin = 1 WHERE id = $2`,
      [newHash, existing.id],
    );
  } else {
    const id = newId();
    const createdAt = now();
    const passwordHash = hashPassword(password);
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, handicap, created_at, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, 1)`,
      [id, "admin", passwordHash, "Admin", 18, createdAt],
    );
  }
}
