import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, formatDuration, formatElapsedTime } from "./dateFormat.js";

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
