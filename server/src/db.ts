import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

const DB_PATH = resolve(
  process.env.DATA_DIR ?? "./data",
  "dad-golf.sqlite",
);

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  handicap INTEGER NOT NULL DEFAULT 18,
  created_at TEXT NOT NULL
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
  handicap INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

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
  handicap INTEGER NOT NULL,
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

// Backwards compatible schema migrations for existing installs
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("courses", "created_by_user_id", "created_by_user_id TEXT");
ensureColumn("groups", "owner_user_id", "owner_user_id TEXT");
ensureColumn("group_members", "user_id", "user_id TEXT");
ensureColumn("rounds", "leader_user_id", "leader_user_id TEXT");
ensureColumn("players", "user_id", "user_id TEXT");

// Indexes that reference columns added by the migrations above must run
// after ensureColumn() so they work on pre-existing databases.
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);`,
);

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
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    handicap: row.handicap,
    createdAt: row.created_at,
  };
}

export function createUser(
  username: string,
  password: string,
  displayName: string,
  handicap: number,
): User {
  const id = newId();
  const createdAt = now();
  const passwordHash = hashPassword(password);
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, handicap, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, username.toLowerCase(), passwordHash, displayName, handicap, createdAt);
  return {
    id,
    username: username.toLowerCase(),
    displayName,
    handicap,
    createdAt,
  };
}

export function getUserByUsername(username: string): UserRow | null {
  const row = db
    .prepare(`SELECT * FROM users WHERE username = ?`)
    .get(username.toLowerCase()) as UserRow | undefined;
  return row ?? null;
}

export function getUser(id: string): User | null {
  const row = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function authenticateUser(
  username: string,
  password: string,
): User | null {
  const row = getUserByUsername(username);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export function updateUserProfile(
  userId: string,
  displayName: string,
  handicap: number,
): void {
  db.prepare(
    `UPDATE users SET display_name = ?, handicap = ? WHERE id = ?`,
  ).run(displayName, handicap, userId);
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
  ).run(token, userId, now());
  return token;
}

export function getUserBySession(token: string): User | null {
  const row = db
    .prepare(
      `SELECT users.* FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
    )
    .get(token) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

// ---------- courses ----------
export function createCourse(
  name: string,
  location: string | null,
  holes: Hole[],
  createdByUserId: string,
): Course {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO courses (id, name, location, holes_json, created_at, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, name, location, JSON.stringify(holes), createdAt, createdByUserId);
  const creator = getUser(createdByUserId);
  return {
    id,
    name,
    location,
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
  holes_json: string;
  created_at: string;
  created_by_user_id: string | null;
}

interface CourseListRow extends CourseRow {
  creator_name: string | null;
  favorite_count: number;
  is_favorite: number;
}

function rowToCourse(row: CourseListRow): Course {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    holes: JSON.parse(row.holes_json) as Hole[],
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    createdByName: row.creator_name,
    favoriteCount: row.favorite_count ?? 0,
    isFavorite: Boolean(row.is_favorite),
  };
}

export function listCourses(viewerUserId: string | null): Course[] {
  const rows = db
    .prepare(
      `SELECT c.*,
              u.display_name AS creator_name,
              (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
              CASE WHEN ? IS NULL THEN 0
                   ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = ?)
              END AS is_favorite
         FROM courses c
         LEFT JOIN users u ON u.id = c.created_by_user_id
         ORDER BY favorite_count DESC, c.name ASC`,
    )
    .all(viewerUserId, viewerUserId) as CourseListRow[];
  return rows.map(rowToCourse);
}

export function getCourse(
  id: string,
  viewerUserId: string | null = null,
): Course | null {
  const row = db
    .prepare(
      `SELECT c.*,
              u.display_name AS creator_name,
              (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id) AS favorite_count,
              CASE WHEN ? IS NULL THEN 0
                   ELSE (SELECT COUNT(*) FROM course_favorites cf WHERE cf.course_id = c.id AND cf.user_id = ?)
              END AS is_favorite
         FROM courses c
         LEFT JOIN users u ON u.id = c.created_by_user_id
         WHERE c.id = ?`,
    )
    .get(viewerUserId, viewerUserId, id) as CourseListRow | undefined;
  return row ? rowToCourse(row) : null;
}

export function updateCourse(
  id: string,
  name: string,
  location: string | null,
  holes: Hole[],
): void {
  db.prepare(
    `UPDATE courses SET name = ?, location = ?, holes_json = ? WHERE id = ?`,
  ).run(name, location, JSON.stringify(holes), id);
}

export function deleteCourse(id: string): void {
  db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);
}

export function getCourseFavoriteCount(courseId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM course_favorites WHERE course_id = ?`)
    .get(courseId) as { n: number };
  return row.n;
}

export function favoriteCourse(userId: string, courseId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO course_favorites (user_id, course_id, created_at) VALUES (?, ?, ?)`,
  ).run(userId, courseId, now());
}

export function unfavoriteCourse(userId: string, courseId: string): void {
  db.prepare(
    `DELETE FROM course_favorites WHERE user_id = ? AND course_id = ?`,
  ).run(userId, courseId);
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

export function createGroup(name: string, ownerUserId: string): Group {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO groups (id, name, created_at, owner_user_id) VALUES (?, ?, ?, ?)`,
  ).run(id, name, createdAt, ownerUserId);
  const owner = getUser(ownerUserId);
  return {
    id,
    name,
    createdAt,
    ownerUserId,
    ownerName: owner?.displayName ?? null,
  };
}

export function listGroups(): Group[] {
  const rows = db
    .prepare(
      `SELECT g.*, u.display_name AS owner_name
         FROM groups g
         LEFT JOIN users u ON u.id = g.owner_user_id
         ORDER BY g.name ASC`,
    )
    .all() as GroupListRow[];
  return rows.map(rowToGroup);
}

export function getGroup(id: string): Group | null {
  const row = db
    .prepare(
      `SELECT g.*, u.display_name AS owner_name
         FROM groups g
         LEFT JOIN users u ON u.id = g.owner_user_id
         WHERE g.id = ?`,
    )
    .get(id) as GroupListRow | undefined;
  return row ? rowToGroup(row) : null;
}

export function deleteGroup(id: string): void {
  db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);
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
    handicap: row.handicap,
    createdAt: row.created_at,
  };
}

export function addGroupMember(
  groupId: string,
  name: string,
  handicap: number,
  userId: string | null = null,
): GroupMember {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO group_members (id, group_id, user_id, name, handicap, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, groupId, userId, name, handicap, createdAt);
  return { id, groupId, userId, name, handicap, createdAt };
}

export function listGroupMembers(groupId: string): GroupMember[] {
  const rows = db
    .prepare(
      `SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC`,
    )
    .all(groupId) as GroupMemberRow[];
  return rows.map(rowToGroupMember);
}

export function getGroupMember(memberId: string): GroupMember | null {
  const row = db
    .prepare(`SELECT * FROM group_members WHERE id = ?`)
    .get(memberId) as GroupMemberRow | undefined;
  return row ? rowToGroupMember(row) : null;
}

export function findGroupMemberByUser(
  groupId: string,
  userId: string,
): GroupMember | null {
  const row = db
    .prepare(
      `SELECT * FROM group_members WHERE group_id = ? AND user_id = ?`,
    )
    .get(groupId, userId) as GroupMemberRow | undefined;
  return row ? rowToGroupMember(row) : null;
}

export function isUserInGroup(groupId: string, userId: string): boolean {
  if (!groupId || !userId) return false;
  const row = db
    .prepare(
      `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
    )
    .get(groupId, userId);
  if (row) return true;
  const owner = db
    .prepare(`SELECT owner_user_id FROM groups WHERE id = ?`)
    .get(groupId) as { owner_user_id: string | null } | undefined;
  return owner?.owner_user_id === userId;
}

export function updateGroupMember(
  memberId: string,
  name: string,
  handicap: number,
): void {
  db.prepare(
    `UPDATE group_members SET name = ?, handicap = ? WHERE id = ?`,
  ).run(name, handicap, memberId);
}

export function removeGroupMember(memberId: string): void {
  db.prepare(`DELETE FROM group_members WHERE id = ?`).run(memberId);
}

// ---------- group invites ----------
export function createGroupInvite(groupId: string): GroupInvite {
  const id = newId();
  const token = randomBytes(12).toString("hex");
  const createdAt = now();
  db.prepare(
    `INSERT INTO group_invites (id, group_id, token, created_at) VALUES (?, ?, ?, ?)`,
  ).run(id, groupId, token, createdAt);
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

export function listGroupInvites(groupId: string): GroupInvite[] {
  const rows = db
    .prepare(
      `SELECT * FROM group_invites WHERE group_id = ? ORDER BY created_at DESC`,
    )
    .all(groupId) as GroupInviteRow[];
  return rows.map(rowToGroupInvite);
}

export function getGroupInviteByToken(token: string): GroupInvite | null {
  const row = db
    .prepare(`SELECT * FROM group_invites WHERE token = ?`)
    .get(token) as GroupInviteRow | undefined;
  return row ? rowToGroupInvite(row) : null;
}

export function deleteGroupInvite(id: string): void {
  db.prepare(`DELETE FROM group_invites WHERE id = ?`).run(id);
}

// ---------- rounds ----------
export function createRound(
  roomCode: string,
  courseId: string,
  groupId: string | null,
  leaderUserId: string,
): Round {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO rounds (id, room_code, course_id, group_id, status, current_hole, created_at, leader_user_id)
     VALUES (?, ?, ?, ?, 'waiting', 1, ?, ?)`,
  ).run(id, roomCode, courseId, groupId, createdAt, leaderUserId);
  const leader = getUser(leaderUserId);
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
    currentHole: row.current_hole,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    leaderUserId: row.leader_user_id,
    leaderName: row.leader_name,
  };
}

export function getRoundByRoomCode(roomCode: string): Round | null {
  const row = db
    .prepare(
      `SELECT r.*, u.display_name AS leader_name
         FROM rounds r
         LEFT JOIN users u ON u.id = r.leader_user_id
         WHERE r.room_code = ?`,
    )
    .get(roomCode) as RoundListRow | undefined;
  return row ? rowToRound(row) : null;
}

export function getRound(id: string): Round | null {
  const row = db
    .prepare(
      `SELECT r.*, u.display_name AS leader_name
         FROM rounds r
         LEFT JOIN users u ON u.id = r.leader_user_id
         WHERE r.id = ?`,
    )
    .get(id) as RoundListRow | undefined;
  return row ? rowToRound(row) : null;
}

export function updateRoundStatus(id: string, status: RoundStatus): void {
  if (status === "in_progress") {
    db.prepare(
      `UPDATE rounds SET status = ?, started_at = COALESCE(started_at, ?) WHERE id = ?`,
    ).run(status, now(), id);
  } else if (status === "complete") {
    db.prepare(
      `UPDATE rounds SET status = ?, completed_at = ? WHERE id = ?`,
    ).run(status, now(), id);
  } else {
    db.prepare(`UPDATE rounds SET status = ? WHERE id = ?`).run(status, id);
  }
}

export function updateRoundCurrentHole(id: string, holeNumber: number): void {
  db.prepare(`UPDATE rounds SET current_hole = ? WHERE id = ?`).run(
    holeNumber,
    id,
  );
}

export function listRecentRounds(limit = 20): Round[] {
  const rows = db
    .prepare(
      `SELECT r.*, u.display_name AS leader_name
         FROM rounds r
         LEFT JOIN users u ON u.id = r.leader_user_id
         ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(limit) as RoundListRow[];
  return rows.map(rowToRound);
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
    handicap: row.handicap,
    joinedAt: row.joined_at,
    isGuest: row.user_id === null,
  };
}

export function addPlayer(
  roundId: string,
  name: string,
  handicap: number,
  userId: string | null = null,
): Player {
  const id = newId();
  const joinedAt = now();
  db.prepare(
    `INSERT INTO players (id, round_id, user_id, name, handicap, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, roundId, userId, name, handicap, joinedAt);
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

export function findPlayerByName(
  roundId: string,
  name: string,
): Player | null {
  const row = db
    .prepare(`SELECT * FROM players WHERE round_id = ? AND name = ?`)
    .get(roundId, name) as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export function findPlayerByUserId(
  roundId: string,
  userId: string,
): Player | null {
  const row = db
    .prepare(`SELECT * FROM players WHERE round_id = ? AND user_id = ?`)
    .get(roundId, userId) as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export function getPlayer(playerId: string): Player | null {
  const row = db
    .prepare(`SELECT * FROM players WHERE id = ?`)
    .get(playerId) as PlayerRow | undefined;
  return row ? rowToPlayer(row) : null;
}

export function listPlayers(roundId: string): Player[] {
  const rows = db
    .prepare(
      `SELECT * FROM players WHERE round_id = ? ORDER BY joined_at ASC`,
    )
    .all(roundId) as PlayerRow[];
  return rows.map(rowToPlayer);
}

export function updatePlayer(
  playerId: string,
  name: string,
  handicap: number,
): void {
  db.prepare(
    `UPDATE players SET name = ?, handicap = ? WHERE id = ?`,
  ).run(name, handicap, playerId);
}

export function removePlayer(playerId: string): void {
  db.prepare(`DELETE FROM players WHERE id = ?`).run(playerId);
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
    holeNumber: row.hole_number,
    strokes: row.strokes,
    createdAt: row.created_at,
  };
}

export function upsertScore(
  roundId: string,
  playerId: string,
  holeNumber: number,
  strokes: number,
): Score {
  const existing = db
    .prepare(
      `SELECT * FROM scores WHERE player_id = ? AND hole_number = ?`,
    )
    .get(playerId, holeNumber) as ScoreRow | undefined;
  if (existing) {
    db.prepare(
      `UPDATE scores SET strokes = ?, created_at = ? WHERE id = ?`,
    ).run(strokes, now(), existing.id);
    return rowToScore({ ...existing, strokes, created_at: now() });
  }
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO scores (id, round_id, player_id, hole_number, strokes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, roundId, playerId, holeNumber, strokes, createdAt);
  return {
    id,
    roundId,
    playerId,
    holeNumber,
    strokes,
    createdAt,
  };
}

export function deleteScore(playerId: string, holeNumber: number): void {
  db.prepare(
    `DELETE FROM scores WHERE player_id = ? AND hole_number = ?`,
  ).run(playerId, holeNumber);
}

export function listScores(roundId: string): Score[] {
  const rows = db
    .prepare(
      `SELECT * FROM scores WHERE round_id = ? ORDER BY hole_number ASC`,
    )
    .all(roundId) as ScoreRow[];
  return rows.map(rowToScore);
}
