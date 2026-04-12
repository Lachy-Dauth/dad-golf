import { pool } from "./pool.js";

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
