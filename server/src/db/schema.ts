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
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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

CREATE TABLE IF NOT EXISTS hole_competitions (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ctp', 'longest_drive')),
  created_at TEXT NOT NULL,
  UNIQUE(round_id, hole_number, type)
);
CREATE INDEX IF NOT EXISTS idx_hole_competitions_round ON hole_competitions(round_id);

CREATE TABLE IF NOT EXISTS competition_claims (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES hole_competitions(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  is_winner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(competition_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_competition_claims_comp ON competition_claims(competition_id);

CREATE TABLE IF NOT EXISTS scheduled_rounds (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id),
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'started', 'cancelled')),
  round_id TEXT REFERENCES rounds(id) ON DELETE SET NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scheduled_rounds_group ON scheduled_rounds(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_rounds_date ON scheduled_rounds(scheduled_date);

CREATE TABLE IF NOT EXISTS scheduled_round_rsvps (
  id TEXT PRIMARY KEY,
  scheduled_round_id TEXT NOT NULL REFERENCES scheduled_rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'declined', 'tentative')),
  updated_at TEXT NOT NULL,
  UNIQUE(scheduled_round_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scheduled_round_rsvps_round ON scheduled_round_rsvps(scheduled_round_id);

CREATE TABLE IF NOT EXISTS handicap_rounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id TEXT REFERENCES rounds(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  course_name TEXT NOT NULL,
  adjusted_gross_score DOUBLE PRECISION NOT NULL,
  course_rating DOUBLE PRECISION NOT NULL,
  slope_rating INTEGER NOT NULL,
  score_differential DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_handicap_rounds_user ON handicap_rounds(user_id);
  `);

  // Migration: add lat/lng columns to courses (safe to re-run)
  await pool.query(`
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
  `);

  // Migration: add role column to group_members (safe to re-run)
  await pool.query(`
    ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE group_members ADD CONSTRAINT group_members_role_check
        CHECK (role IN ('admin', 'member'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_user_group
      ON group_members (group_id, user_id) WHERE user_id IS NOT NULL;
  `);
  await pool.query(`
    UPDATE group_members SET role = 'admin'
    FROM groups
    WHERE group_members.group_id = groups.id
      AND group_members.user_id = groups.owner_user_id
      AND group_members.role = 'member';
  `);

  // Migration: add handicap auto-adjust setting to users
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS handicap_auto_adjust INTEGER NOT NULL DEFAULT 0;
  `);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
