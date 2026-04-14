import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateHoles,
  validateHandicap,
  validateCourseRating,
  validateCourseSlope,
  validateName,
  validateUsername,
  validatePassword,
  validateScheduledDate,
  validateScheduledTime,
  validateDurationMinutes,
  validateAdjustedGrossScore,
  validateDate,
  validateStarRating,
  validateReviewText,
  validateReportReason,
  validateNotes,
  parsePagination,
  errorMessage,
} from "./validation.js";

// --- validateHoles ---

function makeHoles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokeIndex: i + 1,
  }));
}

test("validateHoles accepts valid 9-hole array", () => {
  const result = validateHoles(makeHoles(9));
  assert.equal(result.length, 9);
});

test("validateHoles accepts valid 18-hole array", () => {
  const result = validateHoles(makeHoles(18));
  assert.equal(result.length, 18);
});

test("validateHoles sorts by hole number", () => {
  const holes = [
    { number: 3, par: 4, strokeIndex: 3 },
    { number: 1, par: 4, strokeIndex: 1 },
    { number: 2, par: 5, strokeIndex: 2 },
    { number: 4, par: 3, strokeIndex: 4 },
    { number: 5, par: 4, strokeIndex: 5 },
    { number: 6, par: 4, strokeIndex: 6 },
    { number: 7, par: 4, strokeIndex: 7 },
    { number: 8, par: 4, strokeIndex: 8 },
    { number: 9, par: 4, strokeIndex: 9 },
  ];
  const result = validateHoles(holes);
  assert.deepEqual(
    result.map((h) => h.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("validateHoles rejects non-array", () => {
  assert.throws(() => validateHoles("not an array"), /holes must be an array/);
});

test("validateHoles rejects wrong count", () => {
  assert.throws(() => validateHoles(makeHoles(7)), /9 or 18/);
});

test("validateHoles rejects invalid par", () => {
  const holes = makeHoles(9);
  holes[0].par = 2;
  assert.throws(() => validateHoles(holes), /invalid par/);
  holes[0].par = 7;
  assert.throws(() => validateHoles(holes), /invalid par/);
});

test("validateHoles rejects invalid stroke index", () => {
  const holes = makeHoles(9);
  holes[0].strokeIndex = 0;
  assert.throws(() => validateHoles(holes), /invalid stroke index/);
  holes[0].strokeIndex = 10;
  assert.throws(() => validateHoles(holes), /invalid stroke index/);
});

test("validateHoles rejects duplicate stroke indexes", () => {
  const holes = makeHoles(9);
  holes[1].strokeIndex = 1; // duplicate with holes[0]
  assert.throws(() => validateHoles(holes), /stroke indexes must be unique/);
});

test("validateHoles rejects duplicate hole numbers", () => {
  const holes = makeHoles(9);
  holes[1].number = 1; // duplicate with holes[0]
  holes[1].strokeIndex = 2; // keep SI unique to isolate the error
  assert.throws(() => validateHoles(holes), /hole numbers must be unique/);
});

test("validateHoles accepts stroke_index alias", () => {
  const holes = Array.from({ length: 9 }, (_, i) => ({
    number: i + 1,
    par: 4,
    stroke_index: i + 1,
  }));
  const result = validateHoles(holes);
  assert.equal(result[0].strokeIndex, 1);
});

// --- validateHandicap ---

test("validateHandicap accepts valid values", () => {
  assert.equal(validateHandicap(0), 0);
  assert.equal(validateHandicap(27), 27);
  assert.equal(validateHandicap(54), 54);
});

test("validateHandicap rounds to one decimal", () => {
  assert.equal(validateHandicap(12.34), 12.3);
  assert.equal(validateHandicap(12.35), 12.4);
});

test("validateHandicap coerces string to number", () => {
  assert.equal(validateHandicap("18"), 18);
});

test("validateHandicap rejects out of range", () => {
  assert.throws(() => validateHandicap(-1), /between 0.0 and 54.0/);
  assert.throws(() => validateHandicap(55), /between 0.0 and 54.0/);
});

test("validateHandicap rejects non-finite", () => {
  assert.throws(() => validateHandicap(NaN), /between 0.0 and 54.0/);
  assert.throws(() => validateHandicap(Infinity), /between 0.0 and 54.0/);
});

// --- validateCourseRating ---

test("validateCourseRating accepts valid values", () => {
  assert.equal(validateCourseRating(72), 72);
  assert.equal(validateCourseRating(10), 10);
  assert.equal(validateCourseRating(100), 100);
});

test("validateCourseRating rounds to one decimal", () => {
  assert.equal(validateCourseRating(72.34), 72.3);
  assert.equal(validateCourseRating(72.35), 72.4);
});

test("validateCourseRating rejects out of range", () => {
  assert.throws(() => validateCourseRating(9), /between 10 and 100/);
  assert.throws(() => validateCourseRating(101), /between 10 and 100/);
});

// --- validateCourseSlope ---

test("validateCourseSlope accepts valid integers", () => {
  assert.equal(validateCourseSlope(113), 113);
  assert.equal(validateCourseSlope(55), 55);
  assert.equal(validateCourseSlope(155), 155);
});

test("validateCourseSlope rejects non-integers", () => {
  assert.throws(() => validateCourseSlope(113.5), /integer/);
});

test("validateCourseSlope rejects out of range", () => {
  assert.throws(() => validateCourseSlope(54), /between 55 and 155/);
  assert.throws(() => validateCourseSlope(156), /between 55 and 155/);
});

// --- validateName ---

test("validateName accepts and trims valid name", () => {
  assert.equal(validateName("  Alice  "), "Alice");
});

test("validateName accepts 1-40 chars", () => {
  assert.equal(validateName("A"), "A");
  assert.equal(validateName("A".repeat(40)), "A".repeat(40));
});

test("validateName rejects empty", () => {
  assert.throws(() => validateName(""), /1-40 characters/);
  assert.throws(() => validateName("   "), /1-40 characters/);
});

test("validateName rejects too long", () => {
  assert.throws(() => validateName("A".repeat(41)), /1-40 characters/);
});

test("validateName rejects non-string", () => {
  assert.throws(() => validateName(123), /must be a string/);
});

test("validateName uses custom field name in error", () => {
  assert.throws(() => validateName(123, "displayName"), /displayName must be a string/);
});

// --- validateUsername ---

test("validateUsername lowercases and trims", () => {
  assert.equal(validateUsername("  John  "), "john");
});

test("validateUsername accepts valid patterns", () => {
  assert.equal(validateUsername("john_doe"), "john_doe");
  assert.equal(validateUsername("j.d-1"), "j.d-1");
  assert.equal(validateUsername("abc"), "abc");
  assert.equal(validateUsername("a".repeat(24)), "a".repeat(24));
});

test("validateUsername rejects too short", () => {
  assert.throws(() => validateUsername("ab"), /3-24 chars/);
});

test("validateUsername rejects too long", () => {
  assert.throws(() => validateUsername("a".repeat(25)), /3-24 chars/);
});

test("validateUsername rejects invalid chars", () => {
  assert.throws(() => validateUsername("john doe"), /3-24 chars/);
  assert.throws(() => validateUsername("john@doe"), /3-24 chars/);
});

test("validateUsername rejects non-string", () => {
  assert.throws(() => validateUsername(123), /must be a string/);
});

// --- validatePassword ---

test("validatePassword accepts valid lengths", () => {
  assert.equal(validatePassword("12345678"), "12345678");
  assert.equal(validatePassword("x".repeat(128)), "x".repeat(128));
});

test("validatePassword rejects too short", () => {
  assert.throws(() => validatePassword("1234567"), /8-128 characters/);
});

test("validatePassword rejects too long", () => {
  assert.throws(() => validatePassword("x".repeat(129)), /8-128 characters/);
});

test("validatePassword rejects non-string", () => {
  assert.throws(() => validatePassword(123456), /must be a string/);
});

// --- validateScheduledDate ---

test("validateScheduledDate accepts valid date", () => {
  assert.equal(validateScheduledDate("2025-03-15"), "2025-03-15");
});

test("validateScheduledDate rejects bad format", () => {
  assert.throws(() => validateScheduledDate("15-03-2025"), /YYYY-MM-DD/);
  assert.throws(() => validateScheduledDate("2025/03/15"), /YYYY-MM-DD/);
});

test("validateScheduledDate rejects invalid calendar date", () => {
  assert.throws(() => validateScheduledDate("2025-02-30"), /not a valid calendar date/);
});

test("validateScheduledDate rejects non-string", () => {
  assert.throws(() => validateScheduledDate(20250315), /must be a string/);
});

// --- validateScheduledTime ---

test("validateScheduledTime accepts valid time", () => {
  assert.equal(validateScheduledTime("08:30"), "08:30");
  assert.equal(validateScheduledTime("00:00"), "00:00");
  assert.equal(validateScheduledTime("23:59"), "23:59");
});

test("validateScheduledTime rejects bad format", () => {
  assert.throws(() => validateScheduledTime("8:30"), /HH:MM/);
  assert.throws(() => validateScheduledTime("08:3"), /HH:MM/);
});

test("validateScheduledTime rejects out of range", () => {
  assert.throws(() => validateScheduledTime("24:00"), /not a valid time/);
  assert.throws(() => validateScheduledTime("12:60"), /not a valid time/);
});

test("validateScheduledTime rejects non-string", () => {
  assert.throws(() => validateScheduledTime(830), /must be a string/);
});

// --- validateDurationMinutes ---

test("validateDurationMinutes accepts valid range", () => {
  assert.equal(validateDurationMinutes(30), 30);
  assert.equal(validateDurationMinutes(120), 120);
  assert.equal(validateDurationMinutes(600), 600);
});

test("validateDurationMinutes returns null for empty values", () => {
  assert.equal(validateDurationMinutes(null), null);
  assert.equal(validateDurationMinutes(undefined), null);
  assert.equal(validateDurationMinutes(""), null);
});

test("validateDurationMinutes rejects out of range", () => {
  assert.throws(() => validateDurationMinutes(29), /between 30 and 600/);
  assert.throws(() => validateDurationMinutes(601), /between 30 and 600/);
});

test("validateDurationMinutes rejects non-integer", () => {
  assert.throws(() => validateDurationMinutes(120.5), /integer/);
});

// --- validateAdjustedGrossScore ---

test("validateAdjustedGrossScore accepts valid range", () => {
  assert.equal(validateAdjustedGrossScore(90), 90);
  assert.equal(validateAdjustedGrossScore(30), 30);
  assert.equal(validateAdjustedGrossScore(200), 200);
});

test("validateAdjustedGrossScore rejects out of range", () => {
  assert.throws(() => validateAdjustedGrossScore(29), /between 30 and 200/);
  assert.throws(() => validateAdjustedGrossScore(201), /between 30 and 200/);
});

test("validateAdjustedGrossScore rejects non-integer", () => {
  assert.throws(() => validateAdjustedGrossScore(90.5), /integer/);
});

// --- validateDate ---

test("validateDate accepts valid date", () => {
  assert.equal(validateDate("2025-06-01"), "2025-06-01");
});

test("validateDate rejects bad format", () => {
  assert.throws(() => validateDate("01-06-2025"), /YYYY-MM-DD/);
});

test("validateDate rejects invalid calendar date", () => {
  assert.throws(() => validateDate("2025-02-31"), /not a valid calendar date/);
});

test("validateDate rejects non-string", () => {
  assert.throws(() => validateDate(20250601), /must be a string/);
});

// --- validateStarRating ---

test("validateStarRating accepts 1-5", () => {
  for (let i = 1; i <= 5; i++) {
    assert.equal(validateStarRating(i), i);
  }
});

test("validateStarRating rejects out of range", () => {
  assert.throws(() => validateStarRating(0), /between 1 and 5/);
  assert.throws(() => validateStarRating(6), /between 1 and 5/);
});

test("validateStarRating rejects non-integer", () => {
  assert.throws(() => validateStarRating(3.5), /integer/);
});

// --- validateReviewText ---

test("validateReviewText accepts valid text", () => {
  assert.equal(validateReviewText("Great course!"), "Great course!");
});

test("validateReviewText trims whitespace", () => {
  assert.equal(validateReviewText("  Nice  "), "Nice");
});

test("validateReviewText returns null for empty values", () => {
  assert.equal(validateReviewText(null), null);
  assert.equal(validateReviewText(undefined), null);
  assert.equal(validateReviewText(""), null);
  assert.equal(validateReviewText("   "), null);
});

test("validateReviewText rejects over 500 chars", () => {
  assert.throws(() => validateReviewText("x".repeat(501)), /500 characters/);
});

test("validateReviewText rejects non-string truthy values", () => {
  assert.throws(() => validateReviewText(123), /must be a string/);
});

// --- validateReportReason ---

test("validateReportReason accepts valid reasons", () => {
  assert.equal(validateReportReason("incorrect_info"), "incorrect_info");
  assert.equal(validateReportReason("duplicate"), "duplicate");
  assert.equal(validateReportReason("inappropriate"), "inappropriate");
});

test("validateReportReason rejects invalid reason", () => {
  assert.throws(() => validateReportReason("invalid"), /must be one of/);
});

test("validateReportReason rejects non-string", () => {
  assert.throws(() => validateReportReason(123), /must be one of/);
});

// --- validateNotes ---

test("validateNotes accepts valid text", () => {
  assert.equal(validateNotes("Bring sunscreen"), "Bring sunscreen");
});

test("validateNotes trims whitespace", () => {
  assert.equal(validateNotes("  Note  "), "Note");
});

test("validateNotes returns null for empty values", () => {
  assert.equal(validateNotes(null), null);
  assert.equal(validateNotes(undefined), null);
  assert.equal(validateNotes(""), null);
  assert.equal(validateNotes("   "), null);
});

test("validateNotes rejects over 500 chars", () => {
  assert.throws(() => validateNotes("x".repeat(501)), /500 characters/);
});

test("validateNotes rejects non-string truthy values", () => {
  assert.throws(() => validateNotes(123), /must be a string/);
});

// --- parsePagination ---

test("parsePagination returns defaults", () => {
  assert.deepEqual(parsePagination({}), { limit: 20, offset: 0 });
});

test("parsePagination uses provided values", () => {
  assert.deepEqual(parsePagination({ limit: "10", offset: "5" }), { limit: 10, offset: 5 });
});

test("parsePagination clamps limit to maxLimit", () => {
  assert.deepEqual(parsePagination({ limit: "100" }), { limit: 50, offset: 0 });
});

test("parsePagination clamps limit minimum to 1", () => {
  // "0" is falsy after Number(), so falls back to default
  assert.deepEqual(parsePagination({ limit: "0" }), { limit: 20, offset: 0 });
  // "-5" is truthy, clamped by Math.max to 1
  assert.deepEqual(parsePagination({ limit: "-5" }), { limit: 1, offset: 0 });
});

test("parsePagination clamps offset minimum to 0", () => {
  assert.deepEqual(parsePagination({ offset: "-1" }), { limit: 20, offset: 0 });
});

test("parsePagination falls back on NaN", () => {
  assert.deepEqual(parsePagination({ limit: "abc", offset: "xyz" }), { limit: 20, offset: 0 });
});

test("parsePagination accepts custom defaults", () => {
  const result = parsePagination({}, { limit: 10, maxLimit: 25 });
  assert.deepEqual(result, { limit: 10, offset: 0 });
});

// --- errorMessage ---

test("errorMessage extracts from Error instance", () => {
  assert.equal(errorMessage(new Error("oops")), "oops");
});

test("errorMessage stringifies non-Error values", () => {
  assert.equal(errorMessage("string error"), "string error");
  assert.equal(errorMessage(42), "42");
  assert.equal(errorMessage(null), "null");
});
