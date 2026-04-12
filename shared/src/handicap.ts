/**
 * Australian World Handicap System (WHS) calculation functions.
 *
 * Score Differential = (113 / Slope Rating) × (Adjusted Gross Score − Course Rating)
 *
 * Handicap Index = average of the best N differentials from the most recent 20,
 * with an adjustment for small sample sizes per the WHS lookup table.
 *
 * Source: https://www.golf.org.au/handicapping
 */

/**
 * Calculate the Score Differential for a single round.
 *
 *   (113 / slopeRating) × (adjustedGrossScore − courseRating)
 *
 * Returns the result rounded to one decimal place.
 */
export function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number,
): number {
  if (
    !Number.isFinite(adjustedGrossScore) ||
    !Number.isFinite(courseRating) ||
    !Number.isFinite(slopeRating) ||
    slopeRating <= 0
  ) {
    return 0;
  }
  const diff = (113 / slopeRating) * (adjustedGrossScore - courseRating);
  return Math.round(diff * 10) / 10;
}

/**
 * WHS lookup table: given the number of rounds available, returns
 * [number of lowest differentials to use, adjustment to subtract].
 */
function whsLookup(count: number): [number, number] | null {
  if (count < 3) return null;
  if (count === 3) return [1, 2.0];
  if (count === 4) return [1, 1.0];
  if (count === 5) return [1, 0];
  if (count === 6) return [2, 1.0];
  if (count <= 8) return [2, 0];
  if (count <= 11) return [3, 0];
  if (count <= 14) return [4, 0];
  if (count <= 16) return [5, 0];
  if (count <= 18) return [6, 0];
  if (count === 19) return [7, 0];
  return [8, 0]; // 20+
}

export interface HandicapCalculation {
  /** Final calculated handicap index (0.0–54.0) */
  handicapIndex: number;
  /** How many of the best differentials were used */
  roundsUsed: number;
  /** Total rounds in the history */
  totalRounds: number;
  /** Adjustment subtracted (e.g. -2.0 for 3 rounds) */
  adjustment: number;
  /** IDs of the rounds whose differentials were selected as "best N" */
  usedRoundIds: string[];
}

/**
 * Calculate a WHS Handicap Index from an array of recent round differentials.
 *
 * @param rounds  Entries ordered most-recent-first. Only the first 20 are
 *                used (the rest are ignored). Among those 20, the function
 *                selects the lowest N per the WHS lookup table.
 * @returns       The calculation result, or `null` if fewer than 3 rounds.
 */
export function calculateHandicapIndex(
  rounds: Array<{ id: string; differential: number }>,
): HandicapCalculation | null {
  // Cap at 20 most recent
  const capped = rounds.slice(0, 20);
  const lookup = whsLookup(capped.length);
  if (!lookup) return null;

  const [take, adjustment] = lookup;

  // Sort by differential ascending to find the lowest N
  const sorted = [...capped].sort((a, b) => a.differential - b.differential);
  const best = sorted.slice(0, take);

  const avg = best.reduce((sum, r) => sum + r.differential, 0) / best.length;
  const raw = avg - adjustment;

  // Clamp 0.0–54.0, round to 1 decimal
  const clamped = Math.min(54.0, Math.max(0.0, raw));
  const handicapIndex = Math.round(clamped * 10) / 10;

  return {
    handicapIndex,
    roundsUsed: take,
    totalRounds: capped.length,
    adjustment,
    usedRoundIds: best.map((r) => r.id),
  };
}
