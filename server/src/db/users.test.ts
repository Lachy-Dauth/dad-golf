import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, rowToUser } from "./users.js";
import type { UserRow } from "./users.js";

// --- hashPassword ---

test("hashPassword returns salt:hash format", () => {
  const result = hashPassword("testpass");
  const parts = result.split(":");
  assert.equal(parts.length, 2);
  assert.equal(parts[0].length, 32); // 16 bytes = 32 hex chars
  assert.equal(parts[1].length, 128); // 64 bytes = 128 hex chars
});

test("hashPassword produces different results for same password (random salt)", () => {
  const a = hashPassword("testpass");
  const b = hashPassword("testpass");
  assert.notEqual(a, b);
});

// --- verifyPassword ---

test("verifyPassword returns true for correct password", () => {
  const stored = hashPassword("secret123");
  assert.equal(verifyPassword("secret123", stored), true);
});

test("verifyPassword returns false for wrong password", () => {
  const stored = hashPassword("secret123");
  assert.equal(verifyPassword("wrong", stored), false);
});

test("verifyPassword returns false for malformed stored hash", () => {
  assert.equal(verifyPassword("anything", "nocolon"), false);
  assert.equal(verifyPassword("anything", ""), false);
});

// --- rowToUser ---

test("rowToUser converts database row to User object", () => {
  const row: UserRow = {
    id: "u1",
    username: "alice",
    password_hash: "salt:hash",
    display_name: "Alice",
    handicap: 18.5,
    handicap_auto_adjust: 1,
    google_calendar_connected: 0,
    activity_visibility: "public",
    created_at: "2025-01-01T00:00:00Z",
    is_admin: 0,
  };
  const user = rowToUser(row);
  assert.equal(user.id, "u1");
  assert.equal(user.username, "alice");
  assert.equal(user.displayName, "Alice");
  assert.equal(user.handicap, 18.5);
  assert.equal(user.handicapAutoAdjust, true);
  assert.equal(user.googleCalendarConnected, false);
  assert.equal(user.activityVisibility, "public");
  assert.equal(user.createdAt, "2025-01-01T00:00:00Z");
  assert.equal(user.isAdmin, false);
});

test("rowToUser converts boolean integers correctly", () => {
  const row: UserRow = {
    id: "u2",
    username: "bob",
    password_hash: "salt:hash",
    display_name: "Bob",
    handicap: 0,
    handicap_auto_adjust: 0,
    google_calendar_connected: 1,
    activity_visibility: "public",
    created_at: "2025-01-01T00:00:00Z",
    is_admin: 1,
  };
  const user = rowToUser(row);
  assert.equal(user.handicapAutoAdjust, false);
  assert.equal(user.googleCalendarConnected, true);
  assert.equal(user.isAdmin, true);
});

test("rowToUser defaults empty activity_visibility to public", () => {
  const row: UserRow = {
    id: "u3",
    username: "carol",
    password_hash: "salt:hash",
    display_name: "Carol",
    handicap: 10,
    handicap_auto_adjust: 0,
    google_calendar_connected: 0,
    activity_visibility: "",
    created_at: "2025-01-01T00:00:00Z",
    is_admin: 0,
  };
  const user = rowToUser(row);
  assert.equal(user.activityVisibility, "public");
});
