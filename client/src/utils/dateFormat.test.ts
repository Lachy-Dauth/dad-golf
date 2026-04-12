import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatTime,
  formatDuration,
  formatElapsedTime,
  formatDate,
  formatDateTime,
  relativeTime,
} from "./dateFormat.js";

// --- formatTime ---

test("formatTime converts midnight to 12:00am", () => {
  assert.equal(formatTime("00:00"), "12:00am");
});

test("formatTime converts noon to 12:00pm", () => {
  assert.equal(formatTime("12:00"), "12:00pm");
});

test("formatTime converts morning time", () => {
  assert.equal(formatTime("09:15"), "9:15am");
});

test("formatTime converts afternoon time", () => {
  assert.equal(formatTime("13:30"), "1:30pm");
});

test("formatTime converts 11pm", () => {
  assert.equal(formatTime("23:59"), "11:59pm");
});

test("formatTime converts 1am", () => {
  assert.equal(formatTime("01:05"), "1:05am");
});

// --- formatDuration ---

test("formatDuration minutes only", () => {
  assert.equal(formatDuration(30), "30 min");
  assert.equal(formatDuration(45), "45 min");
});

test("formatDuration exact hours singular", () => {
  assert.equal(formatDuration(60), "1 hour");
});

test("formatDuration exact hours plural", () => {
  assert.equal(formatDuration(120), "2 hours");
  assert.equal(formatDuration(180), "3 hours");
});

test("formatDuration hours and minutes", () => {
  assert.equal(formatDuration(90), "1h 30m");
  assert.equal(formatDuration(150), "2h 30m");
});

// --- formatElapsedTime ---

test("formatElapsedTime returns null for null start", () => {
  assert.equal(formatElapsedTime(null, "2025-03-15T13:00:00Z"), null);
});

test("formatElapsedTime returns null for null end", () => {
  assert.equal(formatElapsedTime("2025-03-15T09:00:00Z", null), null);
});

test("formatElapsedTime returns null for zero duration", () => {
  const ts = "2025-03-15T09:00:00Z";
  assert.equal(formatElapsedTime(ts, ts), null);
});

test("formatElapsedTime returns null for negative duration", () => {
  assert.equal(formatElapsedTime("2025-03-15T13:00:00Z", "2025-03-15T09:00:00Z"), null);
});

test("formatElapsedTime formats minutes", () => {
  assert.equal(formatElapsedTime("2025-03-15T09:00:00Z", "2025-03-15T09:45:00Z"), "45m");
});

test("formatElapsedTime formats exact hours", () => {
  assert.equal(formatElapsedTime("2025-03-15T09:00:00Z", "2025-03-15T11:00:00Z"), "2h");
});

test("formatElapsedTime formats hours and minutes", () => {
  assert.equal(formatElapsedTime("2025-03-15T09:00:00Z", "2025-03-15T11:30:00Z"), "2h 30m");
});

// --- formatDate ---
// Tests run with TZ=UTC for deterministic locale output.

test("formatDate formats ISO string to readable date", () => {
  const result = formatDate("2025-03-15T10:00:00Z");
  // With TZ=UTC the date stays Mar 15, 2025 regardless of locale
  assert.ok(result.includes("2025"), `expected year in "${result}"`);
  assert.ok(result.includes("15"), `expected day in "${result}"`);
  assert.ok(/mar/i.test(result), `expected month in "${result}"`);
});

// --- formatDateTime ---

test("formatDateTime formats ISO string to readable date+time", () => {
  const result = formatDateTime("2025-03-15T10:30:00Z");
  assert.ok(result.includes("2025"), `expected year in "${result}"`);
  assert.ok(result.includes("15"), `expected day in "${result}"`);
  assert.ok(/10:30|10\.30/i.test(result), `expected time in "${result}"`);
});

// --- relativeTime ---

test("relativeTime - just now", () => {
  const now = new Date().toISOString();
  assert.equal(relativeTime(now), "just now");
});

test("relativeTime - minutes ago", () => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  assert.equal(relativeTime(fiveMinAgo), "5m ago");
});

test("relativeTime - hours ago", () => {
  const threeHoursAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
  assert.equal(relativeTime(threeHoursAgo), "3h ago");
});

test("relativeTime - days ago", () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 86400_000).toISOString();
  assert.equal(relativeTime(twoDaysAgo), "2d ago");
});

test("relativeTime - week+ falls back to date string", () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86400_000).toISOString();
  const result = relativeTime(tenDaysAgo);
  // Should not contain "ago" pattern, should be a formatted date
  assert.ok(!result.includes("ago"), `expected date string, got "${result}"`);
  assert.ok(result.length > 0);
});
