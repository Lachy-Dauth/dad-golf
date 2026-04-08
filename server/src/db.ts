import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Course,
  Group,
  GroupMember,
  Hole,
  Player,
  Round,
  RoundStatus,
  Score,
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
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  holes_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handicap INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  course_id TEXT NOT NULL REFERENCES courses(id),
  group_id TEXT REFERENCES groups(id),
  status TEXT NOT NULL,
  current_hole INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rounds_room_code ON rounds(room_code);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
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

// ---------- helpers ----------
const now = () => new Date().toISOString();
const newId = () => randomUUID();

// ---------- courses ----------
export function createCourse(
  name: string,
  location: string | null,
  holes: Hole[],
): Course {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO courses (id, name, location, holes_json, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, name, location, JSON.stringify(holes), createdAt);
  return { id, name, location, holes, createdAt };
}

interface CourseRow {
  id: string;
  name: string;
  location: string | null;
  holes_json: string;
  created_at: string;
}

function rowToCourse(row: CourseRow): Course {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    holes: JSON.parse(row.holes_json) as Hole[],
    createdAt: row.created_at,
  };
}

export function listCourses(): Course[] {
  const rows = db
    .prepare(`SELECT * FROM courses ORDER BY name ASC`)
    .all() as CourseRow[];
  return rows.map(rowToCourse);
}

export function getCourse(id: string): Course | null {
  const row = db
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow | undefined;
  return row ? rowToCourse(row) : null;
}

export function deleteCourse(id: string): void {
  db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);
}

// ---------- groups ----------
export function createGroup(name: string): Group {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)`,
  ).run(id, name, createdAt);
  return { id, name, createdAt };
}

interface GroupRow {
  id: string;
  name: string;
  created_at: string;
}

function rowToGroup(row: GroupRow): Group {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function listGroups(): Group[] {
  const rows = db
    .prepare(`SELECT * FROM groups ORDER BY name ASC`)
    .all() as GroupRow[];
  return rows.map(rowToGroup);
}

export function getGroup(id: string): Group | null {
  const row = db
    .prepare(`SELECT * FROM groups WHERE id = ?`)
    .get(id) as GroupRow | undefined;
  return row ? rowToGroup(row) : null;
}

export function deleteGroup(id: string): void {
  db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);
}

interface GroupMemberRow {
  id: string;
  group_id: string;
  name: string;
  handicap: number;
  created_at: string;
}

function rowToGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    handicap: row.handicap,
    createdAt: row.created_at,
  };
}

export function addGroupMember(
  groupId: string,
  name: string,
  handicap: number,
): GroupMember {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO group_members (id, group_id, name, handicap, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, groupId, name, handicap, createdAt);
  return { id, groupId, name, handicap, createdAt };
}

export function listGroupMembers(groupId: string): GroupMember[] {
  const rows = db
    .prepare(
      `SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC`,
    )
    .all(groupId) as GroupMemberRow[];
  return rows.map(rowToGroupMember);
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

// ---------- rounds ----------
export function createRound(
  roomCode: string,
  courseId: string,
  groupId: string | null,
): Round {
  const id = newId();
  const createdAt = now();
  db.prepare(
    `INSERT INTO rounds (id, room_code, course_id, group_id, status, current_hole, created_at)
     VALUES (?, ?, ?, ?, 'waiting', 1, ?)`,
  ).run(id, roomCode, courseId, groupId, createdAt);
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
}

function rowToRound(row: RoundRow): Round {
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
  };
}

export function getRoundByRoomCode(roomCode: string): Round | null {
  const row = db
    .prepare(`SELECT * FROM rounds WHERE room_code = ?`)
    .get(roomCode) as RoundRow | undefined;
  return row ? rowToRound(row) : null;
}

export function getRound(id: string): Round | null {
  const row = db
    .prepare(`SELECT * FROM rounds WHERE id = ?`)
    .get(id) as RoundRow | undefined;
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
    .prepare(`SELECT * FROM rounds ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as RoundRow[];
  return rows.map(rowToRound);
}

// ---------- players ----------
interface PlayerRow {
  id: string;
  round_id: string;
  name: string;
  handicap: number;
  joined_at: string;
}

function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    roundId: row.round_id,
    name: row.name,
    handicap: row.handicap,
    joinedAt: row.joined_at,
  };
}

export function addPlayer(
  roundId: string,
  name: string,
  handicap: number,
): Player {
  const id = newId();
  const joinedAt = now();
  db.prepare(
    `INSERT INTO players (id, round_id, name, handicap, joined_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, roundId, name, handicap, joinedAt);
  return { id, roundId, name, handicap, joinedAt };
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
