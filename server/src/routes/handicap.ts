import type { FastifyInstance } from "fastify";
import { calculateScoreDifferential, calculateHandicapIndex } from "@dad-golf/shared";
import {
  listHandicapRounds,
  getHandicapRound,
  createHandicapRound,
  updateHandicapRound,
  deleteHandicapRound,
  reorderHandicapRounds,
  countHandicapRounds,
  deleteOldestHandicapRound,
  getUser,
  updateUserHandicapAutoAdjust,
  updateUserHandicap,
} from "../db/index.js";
import {
  requireUser,
  validateAdjustedGrossScore,
  validateCourseRating,
  validateCourseSlope,
  validateDate,
  validateName,
} from "./validation.js";

function buildCalculation(rounds: Array<{ id: string; scoreDifferential: number }>) {
  const entries = rounds.map((r) => ({ id: r.id, differential: r.scoreDifferential }));
  return calculateHandicapIndex(entries);
}

export async function registerHandicapRoutes(app: FastifyInstance): Promise<void> {
  // Get handicap settings, rounds, and calculated index
  app.get("/api/handicap", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const rounds = await listHandicapRounds(user.id);
    const calculation = buildCalculation(rounds);

    return {
      autoAdjust: user.handicapAutoAdjust,
      rounds,
      calculation,
      currentHandicap: user.handicap,
    };
  });

  // Toggle auto-adjust setting
  app.patch<{ Body: { autoAdjust?: boolean } }>("/api/handicap/settings", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const autoAdjust = Boolean(req.body?.autoAdjust);
    await updateUserHandicapAutoAdjust(user.id, autoAdjust);

    const updated = await getUser(user.id);
    return { user: updated };
  });

  // Add a manual handicap round
  app.post<{
    Body: {
      date?: string;
      courseName?: string;
      adjustedGrossScore?: number;
      courseRating?: number;
      slopeRating?: number;
    };
  }>("/api/handicap/rounds", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    try {
      const date = validateDate(req.body?.date);
      const courseName = validateName(req.body?.courseName, "course name");
      const adjustedGrossScore = validateAdjustedGrossScore(req.body?.adjustedGrossScore);
      const courseRating = validateCourseRating(req.body?.courseRating);
      const slopeRating = validateCourseSlope(req.body?.slopeRating);

      const count = await countHandicapRounds(user.id);
      if (count >= 20) {
        await deleteOldestHandicapRound(user.id);
      }

      const differential = calculateScoreDifferential(
        adjustedGrossScore,
        courseRating,
        slopeRating,
      );
      const round = await createHandicapRound(
        user.id,
        date,
        courseName,
        adjustedGrossScore,
        courseRating,
        slopeRating,
        differential,
        null,
        "manual",
      );

      const rounds = await listHandicapRounds(user.id);
      const calculation = buildCalculation(rounds);

      // Auto-update handicap if enabled
      if (user.handicapAutoAdjust && calculation) {
        await updateUserHandicap(user.id, calculation.handicapIndex);
      }

      return reply.code(201).send({ round, calculation });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Edit a handicap round
  app.patch<{
    Params: { id: string };
    Body: {
      date?: string;
      courseName?: string;
      adjustedGrossScore?: number;
      courseRating?: number;
      slopeRating?: number;
    };
  }>("/api/handicap/rounds/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const existing = await getHandicapRound(req.params.id);
    if (!existing || existing.userId !== user.id) {
      return reply.code(404).send({ error: "round not found" });
    }

    try {
      const date = validateDate(req.body?.date);
      const courseName = validateName(req.body?.courseName, "course name");
      const adjustedGrossScore = validateAdjustedGrossScore(req.body?.adjustedGrossScore);
      const courseRating = validateCourseRating(req.body?.courseRating);
      const slopeRating = validateCourseSlope(req.body?.slopeRating);

      const differential = calculateScoreDifferential(
        adjustedGrossScore,
        courseRating,
        slopeRating,
      );
      await updateHandicapRound(
        req.params.id,
        date,
        courseName,
        adjustedGrossScore,
        courseRating,
        slopeRating,
        differential,
      );

      const rounds = await listHandicapRounds(user.id);
      const calculation = buildCalculation(rounds);

      if (user.handicapAutoAdjust && calculation) {
        await updateUserHandicap(user.id, calculation.handicapIndex);
      }

      const updated = await getHandicapRound(req.params.id);
      return { round: updated, calculation };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Delete a handicap round
  app.delete<{ Params: { id: string } }>("/api/handicap/rounds/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const existing = await getHandicapRound(req.params.id);
    if (!existing || existing.userId !== user.id) {
      return reply.code(404).send({ error: "round not found" });
    }

    await deleteHandicapRound(req.params.id);

    const rounds = await listHandicapRounds(user.id);
    const calculation = buildCalculation(rounds);

    if (user.handicapAutoAdjust && calculation) {
      await updateUserHandicap(user.id, calculation.handicapIndex);
    }

    return { ok: true, calculation };
  });

  // Reorder handicap rounds
  app.put<{
    Body: { orderedIds?: string[] };
  }>("/api/handicap/rounds/reorder", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const orderedIds = req.body?.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return reply.code(400).send({ error: "orderedIds must be a non-empty array" });
    }

    // Verify all IDs belong to this user
    const existingRounds = await listHandicapRounds(user.id);
    const existingIds = new Set(existingRounds.map((r) => r.id));
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        return reply.code(400).send({ error: `round ${id} not found` });
      }
    }

    await reorderHandicapRounds(user.id, orderedIds);

    const rounds = await listHandicapRounds(user.id);
    const calculation = buildCalculation(rounds);

    if (user.handicapAutoAdjust && calculation) {
      await updateUserHandicap(user.id, calculation.handicapIndex);
    }

    return { rounds, calculation };
  });

  // Apply calculated handicap to user profile
  app.post("/api/handicap/apply", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const rounds = await listHandicapRounds(user.id);
    const calculation = buildCalculation(rounds);

    if (!calculation) {
      return reply.code(400).send({ error: "need at least 3 rounds to calculate handicap" });
    }

    await updateUserHandicap(user.id, calculation.handicapIndex);
    const updated = await getUser(user.id);
    return { user: updated, calculation };
  });
}
