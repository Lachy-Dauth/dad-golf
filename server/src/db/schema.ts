import { randomUUID } from "node:crypto";
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

  // Migration: course reviews (ratings + text reviews)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_reviews (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(course_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON course_reviews(course_id);
  `);

  // Migration: course reports (moderation flags)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_reports (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL CHECK (reason IN ('incorrect_info', 'duplicate', 'inappropriate')),
      created_at TEXT NOT NULL,
      UNIQUE(course_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_course_reports_course ON course_reports(course_id);
  `);

  // Migration: Google Calendar OAuth connections
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_calendar_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expiry TEXT NOT NULL,
      calendar_id TEXT NOT NULL DEFAULT 'primary',
      email TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_google_cal_user ON google_calendar_connections(user_id);
  `);

  // Migration: track Google Calendar event IDs on RSVPs
  await pool.query(`
    ALTER TABLE scheduled_round_rsvps ADD COLUMN IF NOT EXISTS google_event_id TEXT;
  `);

  // Migration: flag for Google Calendar connection on users
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_connected INTEGER NOT NULL DEFAULT 0;
  `);

  // Migration: index on scheduled_round_rsvps(user_id) for event ID cleanup queries
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rsvp_user ON scheduled_round_rsvps(user_id);
  `);

  // Migration: OAuth state nonces for CSRF protection
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_nonces (
      nonce TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
  `);

  // Migration: calendar feed subscription tokens
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_feed_user ON calendar_feed_tokens(user_id);
  `);

  // Migration: activity visibility setting on users
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_visibility TEXT NOT NULL DEFAULT 'group';
  `);

  // Migration: activity events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round_id TEXT REFERENCES rounds(id) ON DELETE SET NULL,
      visibility TEXT NOT NULL DEFAULT 'group',
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_events_group ON activity_events(group_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at DESC);
  `);

  // Migration: activity likes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_likes (
      event_id TEXT NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (event_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_likes_event ON activity_likes(event_id);
  `);

  // Migration: activity comments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_comments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_comments_event ON activity_comments(event_id);
  `);

  // Migration: user badges
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id TEXT NOT NULL,
      earned_at TEXT NOT NULL,
      UNIQUE(user_id, badge_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
  `);

  // Migration: remove 'all' visibility option (replaced by 'group')
  await pool.query(
    `UPDATE users SET activity_visibility = 'group' WHERE activity_visibility = 'all'`,
  );
  await pool.query(`UPDATE activity_events SET visibility = 'group' WHERE visibility = 'all'`);

  // Migration: rename 'group' visibility to 'public'
  await pool.query(
    `UPDATE users SET activity_visibility = 'public' WHERE activity_visibility = 'group'`,
  );
  await pool.query(`UPDATE activity_events SET visibility = 'public' WHERE visibility = 'group'`);

  // Migration: update column defaults so fresh inserts use 'public', not the legacy 'group'
  await pool.query(`ALTER TABLE users ALTER COLUMN activity_visibility SET DEFAULT 'public'`);
  await pool.query(`ALTER TABLE activity_events ALTER COLUMN visibility SET DEFAULT 'public'`);

  // Migration: add session expiry
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TEXT;`);

  // Migration: gender on users and players (default 'M'). Used by the
  // WHS Daily Handicap formula (consistency factor differs M vs F).
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'M';
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_gender_check
        CHECK (gender IN ('M', 'F'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await pool.query(`
    ALTER TABLE players ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'M';
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE players ADD CONSTRAINT players_gender_check
        CHECK (gender IN ('M', 'F'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Migration: multiple tees per course. `tees_json` holds `[{id, name, rating, slope}]`;
  // `default_tee_id` names the tee whose rating/slope the legacy columns mirror.
  // Existing courses are backfilled with a single "Default" tee cloned from
  // their current rating/slope.
  await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS tees_json TEXT;`);
  await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_tee_id TEXT;`);
  const { rows: coursesNeedingTees } = await pool.query(
    `SELECT id, rating, slope FROM courses WHERE tees_json IS NULL OR default_tee_id IS NULL`,
  );
  for (const row of coursesNeedingTees as Array<{ id: string; rating: number; slope: number }>) {
    const teeId = randomUUID();
    const tees = [
      { id: teeId, name: "Default", rating: Number(row.rating), slope: Number(row.slope) },
    ];
    await pool.query(
      `UPDATE courses SET tees_json = $1, default_tee_id = $2 WHERE id = $3`,
      [JSON.stringify(tees), teeId, row.id],
    );
  }

  // Migration: each player picks a tee. Backfill existing players with
  // their round's course's default tee.
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS tee_id TEXT;`);
  await pool.query(
    `UPDATE players p
        SET tee_id = c.default_tee_id
       FROM rounds r, courses c
      WHERE p.round_id = r.id
        AND r.course_id = c.id
        AND p.tee_id IS NULL
        AND c.default_tee_id IS NOT NULL`,
  );
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
