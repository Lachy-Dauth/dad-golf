import type { FastifyInstance } from "fastify";
import { generateRoomCode, normalizeRoomCode } from "@dad-golf/shared";
import {
  addPlayer,
  createCompetition,
  createRound,
  clearClaimWinner,
  deleteClaim,
  deleteCompetition,
  deleteScore,
  findPlayerByName,
  findPlayerByUserId,
  getCompetition,
  getCourse,
  getPlayer,
  getRoundByRoomCode,
  isUserInGroup,
  listGroupMembers,
  listPlayers,
  listRecentRounds,
  removePlayer,
  setClaimWinner,
  updatePlayer,
  updateRoundCurrentHole,
  updateRoundStatus,
  upsertClaim,
  upsertScore,
} from "../db/index.js";
import { buildRoundState } from "../roundState.js";
import { broadcast } from "../hub.js";
import {
  MAX_PLAYERS_PER_ROUND,
  getViewerUser,
  requireUser,
  validateHandicap,
  validateName,
} from "./validation.js";

export async function registerRoundRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/rounds/recent", async () => {
    return { rounds: await listRecentRounds(20) };
  });

  app.post<{
    Body: {
      courseId?: string;
      groupId?: string | null;
      memberIds?: string[];
    };
  }>("/api/rounds", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const { courseId, groupId, memberIds } = req.body ?? {};
      if (!courseId) throw new Error("courseId is required");
      const course = await getCourse(courseId, user.id);
      if (!course) throw new Error("course not found");

      if (groupId) {
        if (!(await isUserInGroup(groupId, user.id))) {
          return reply.code(403).send({
            error: "you must be a member of the group to start a round for it",
          });
        }
      }

      let code = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        code = generateRoomCode();
        if (!(await getRoundByRoomCode(code))) break;
      }
      const round = await createRound(code, course.id, groupId ?? null, user.id);

      // Add the creator (round leader) as a player so they show in the lobby
      await addPlayer(round.id, user.displayName, user.handicap, user.id);

      if (groupId && Array.isArray(memberIds) && memberIds.length > 0) {
        const members = await listGroupMembers(groupId);
        const wanted = new Set(memberIds);
        let added = 1; // already added creator
        for (const m of members) {
          if (!wanted.has(m.id)) continue;
          if (m.userId === user.id) continue; // creator already added
          if (added >= MAX_PLAYERS_PER_ROUND) break;
          // avoid duplicate names within a round
          if (await findPlayerByName(round.id, m.name)) continue;
          await addPlayer(round.id, m.name, m.handicap, m.userId);
          added++;
        }
      }
      const state = await buildRoundState(round.roomCode, user.id);
      return reply.code(201).send({ state });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.get<{ Params: { code: string } }>("/api/rounds/:code", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const state = await buildRoundState(code, viewer?.id ?? null);
    if (!state) return reply.code(404).send({ error: "round not found" });
    return { state };
  });

  app.post<{
    Params: { code: string };
    Body: { name?: string; handicap?: number };
  }>("/api/rounds/:code/players", async (req, reply) => {
    try {
      const viewer = await getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = await getRoundByRoomCode(code);
      if (!round) return reply.code(404).send({ error: "round not found" });
      if (round.status === "complete") {
        return reply.code(400).send({ error: "round is already complete" });
      }

      // If signed in, idempotent rejoin by user_id
      if (viewer) {
        const existingByUser = await findPlayerByUserId(round.id, viewer.id);
        if (existingByUser) {
          const state = await buildRoundState(code, viewer.id);
          return { player: existingByUser, state };
        }
      }

      // Determine name + handicap. Signed in users may use their profile or
      // override. Guests must provide both.
      let name: string;
      let handicap: number;
      if (viewer && req.body?.name === undefined) {
        name = viewer.displayName;
        handicap = viewer.handicap;
      } else {
        name = validateName(req.body?.name);
        handicap = validateHandicap(req.body?.handicap);
      }

      const existing = await findPlayerByName(round.id, name);
      if (existing) {
        const state = await buildRoundState(code, viewer?.id ?? null);
        return { player: existing, state };
      }
      const players = await listPlayers(round.id);
      if (players.length >= MAX_PLAYERS_PER_ROUND) {
        return reply.code(400).send({ error: `round is full (${MAX_PLAYERS_PER_ROUND} max)` });
      }
      const player = await addPlayer(round.id, name, handicap, viewer?.id ?? null);
      const state = await buildRoundState(code, viewer?.id ?? null);
      if (state) broadcast(code, { type: "player_joined", player, state });
      return reply.code(201).send({ player, state });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.patch<{
    Params: { code: string; playerId: string };
    Body: { name?: string; handicap?: number };
  }>("/api/rounds/:code/players/:playerId", async (req, reply) => {
    try {
      const viewer = await getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = await getRoundByRoomCode(code);
      if (!round) return reply.code(404).send({ error: "round not found" });
      const player = await getPlayer(req.params.playerId);
      if (!player || player.roundId !== round.id) {
        return reply.code(404).send({ error: "player not found" });
      }
      const isLeader = viewer?.id === round.leaderUserId;
      const isSelf = viewer && player.userId === viewer.id;
      if (!isLeader && !isSelf) {
        return reply.code(403).send({ error: "not allowed" });
      }
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      await updatePlayer(req.params.playerId, name, handicap);
      const state = await buildRoundState(code, viewer?.id ?? null);
      if (state) broadcast(code, { type: "state", state });
      return { ok: true, state };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { code: string; playerId: string };
  }>("/api/rounds/:code/players/:playerId", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const player = await getPlayer(req.params.playerId);
    if (!player || player.roundId !== round.id) {
      return reply.code(404).send({ error: "player not found" });
    }
    const isLeader = viewer?.id === round.leaderUserId;
    const isSelf = viewer && player.userId === viewer.id;
    if (!isLeader && !isSelf) {
      return reply.code(403).send({ error: "not allowed" });
    }
    await removePlayer(req.params.playerId);
    const state = await buildRoundState(code, viewer?.id ?? null);
    if (state) broadcast(code, { type: "state", state });
    return { ok: true };
  });

  app.post<{ Params: { code: string } }>("/api/rounds/:code/start", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    if (round.leaderUserId !== user.id) {
      return reply.code(403).send({ error: "only the round leader can start this round" });
    }
    await updateRoundStatus(round.id, "in_progress");
    const state = await buildRoundState(code, user.id);
    if (state) broadcast(code, { type: "round_started", state });
    return { state };
  });

  app.post<{ Params: { code: string } }>("/api/rounds/:code/complete", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    if (round.leaderUserId !== user.id) {
      return reply.code(403).send({ error: "only the round leader can end this round" });
    }
    await updateRoundStatus(round.id, "complete");
    const state = await buildRoundState(code, user.id);
    if (state) broadcast(code, { type: "round_completed", state });
    return { state };
  });

  app.post<{
    Params: { code: string };
    Body: { holeNumber?: number };
  }>("/api/rounds/:code/current-hole", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const holeNumber = Number(req.body?.holeNumber);
    const course = await getCourse(round.courseId, viewer?.id ?? null);
    if (!course) return reply.code(500).send({ error: "course missing" });
    if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > course.holes.length) {
      return reply.code(400).send({ error: "invalid hole number" });
    }
    await updateRoundCurrentHole(round.id, holeNumber);
    const state = await buildRoundState(code, viewer?.id ?? null);
    if (state) broadcast(code, { type: "current_hole", holeNumber, state });
    return { state };
  });

  app.post<{
    Params: { code: string };
    Body: {
      playerId?: string;
      holeNumber?: number;
      strokes?: number;
    };
  }>("/api/rounds/:code/scores", async (req, reply) => {
    try {
      const viewer = await getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = await getRoundByRoomCode(code);
      if (!round) return reply.code(404).send({ error: "round not found" });
      const course = await getCourse(round.courseId, viewer?.id ?? null);
      if (!course) return reply.code(500).send({ error: "course missing" });
      const playerId = String(req.body?.playerId ?? "");
      const holeNumber = Number(req.body?.holeNumber);
      const strokes = Number(req.body?.strokes);
      if (!playerId) throw new Error("playerId is required");
      if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > course.holes.length) {
        throw new Error("invalid hole number");
      }
      if (!Number.isInteger(strokes) || strokes < 1 || strokes > 20) {
        throw new Error("strokes must be integer 1-20");
      }
      const score = await upsertScore(round.id, playerId, holeNumber, strokes);
      if (round.status === "waiting") {
        await updateRoundStatus(round.id, "in_progress");
      }
      const state = await buildRoundState(code, viewer?.id ?? null);
      if (state) broadcast(code, { type: "score_update", score, state });
      return { score, state };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { code: string };
    Body: { playerId?: string; holeNumber?: number };
  }>("/api/rounds/:code/scores", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const playerId = String(req.body?.playerId ?? "");
    const holeNumber = Number(req.body?.holeNumber);
    if (!playerId || !Number.isInteger(holeNumber)) {
      return reply.code(400).send({ error: "invalid request" });
    }
    await deleteScore(playerId, holeNumber);
    const state = await buildRoundState(code, viewer?.id ?? null);
    if (state) broadcast(code, { type: "state", state });
    return { ok: true };
  });

  // --- Competitions (CTP / Longest Drive) ---

  app.post<{
    Params: { code: string };
    Body: { holeNumber?: number; type?: string };
  }>("/api/rounds/:code/competitions", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const code = normalizeRoomCode(req.params.code);
      const round = await getRoundByRoomCode(code);
      if (!round) return reply.code(404).send({ error: "round not found" });
      if (round.leaderUserId !== user.id) {
        return reply.code(403).send({ error: "only the round leader can create competitions" });
      }
      const course = await getCourse(round.courseId, user.id);
      if (!course) return reply.code(500).send({ error: "course missing" });
      const holeNumber = Number(req.body?.holeNumber);
      const type = String(req.body?.type ?? "");
      if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > course.holes.length) {
        throw new Error("invalid hole number");
      }
      if (type !== "ctp" && type !== "longest_drive") {
        throw new Error("type must be 'ctp' or 'longest_drive'");
      }
      await createCompetition(round.id, holeNumber, type);
      const state = await buildRoundState(code, user.id);
      if (state) broadcast(code, { type: "competition_update", state });
      return reply.code(201).send({ state });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { code: string; competitionId: string };
  }>("/api/rounds/:code/competitions/:competitionId", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    if (round.leaderUserId !== user.id) {
      return reply.code(403).send({ error: "only the round leader can delete competitions" });
    }
    const comp = await getCompetition(req.params.competitionId);
    if (!comp || comp.roundId !== round.id) {
      return reply.code(404).send({ error: "competition not found" });
    }
    await deleteCompetition(req.params.competitionId);
    const state = await buildRoundState(code, user.id);
    if (state) broadcast(code, { type: "competition_update", state });
    return { ok: true };
  });

  app.post<{
    Params: { code: string; competitionId: string };
    Body: { playerId?: string; claim?: string };
  }>("/api/rounds/:code/competitions/:competitionId/claims", async (req, reply) => {
    try {
      const viewer = await getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = await getRoundByRoomCode(code);
      if (!round) return reply.code(404).send({ error: "round not found" });
      const comp = await getCompetition(req.params.competitionId);
      if (!comp || comp.roundId !== round.id) {
        return reply.code(404).send({ error: "competition not found" });
      }
      const playerId = String(req.body?.playerId ?? "");
      const claim = String(req.body?.claim ?? "").trim();
      if (!playerId) throw new Error("playerId is required");
      if (!claim || claim.length > 100) throw new Error("claim is required (max 100 chars)");
      const player = await getPlayer(playerId);
      if (!player || player.roundId !== round.id) {
        throw new Error("player not found in this round");
      }
      await upsertClaim(req.params.competitionId, playerId, claim);
      const state = await buildRoundState(code, viewer?.id ?? null);
      if (state) broadcast(code, { type: "competition_update", state });
      return { state };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { code: string; competitionId: string };
    Body: { playerId?: string };
  }>("/api/rounds/:code/competitions/:competitionId/claims", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const comp = await getCompetition(req.params.competitionId);
    if (!comp || comp.roundId !== round.id) {
      return reply.code(404).send({ error: "competition not found" });
    }
    const playerId = String(req.body?.playerId ?? "");
    if (!playerId) return reply.code(400).send({ error: "playerId is required" });
    const player = await getPlayer(playerId);
    if (!player || player.roundId !== round.id) {
      return reply.code(404).send({ error: "player not found" });
    }
    const isLeader = viewer?.id === round.leaderUserId;
    const isSelf = viewer && player.userId === viewer.id;
    if (!isLeader && !isSelf) {
      return reply.code(403).send({ error: "not allowed" });
    }
    await deleteClaim(req.params.competitionId, playerId);
    const state = await buildRoundState(code, viewer?.id ?? null);
    if (state) broadcast(code, { type: "competition_update", state });
    return { ok: true };
  });

  app.post<{
    Params: { code: string; competitionId: string };
    Body: { playerId?: string };
  }>("/api/rounds/:code/competitions/:competitionId/winner", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    if (round.leaderUserId !== user.id) {
      return reply.code(403).send({ error: "only the round leader can select winners" });
    }
    const comp = await getCompetition(req.params.competitionId);
    if (!comp || comp.roundId !== round.id) {
      return reply.code(404).send({ error: "competition not found" });
    }
    const playerId = String(req.body?.playerId ?? "");
    if (!playerId) return reply.code(400).send({ error: "playerId is required" });
    await setClaimWinner(req.params.competitionId, playerId);
    const state = await buildRoundState(code, user.id);
    if (state) broadcast(code, { type: "competition_update", state });
    return { state };
  });

  app.delete<{
    Params: { code: string; competitionId: string };
  }>("/api/rounds/:code/competitions/:competitionId/winner", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const code = normalizeRoomCode(req.params.code);
    const round = await getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    if (round.leaderUserId !== user.id) {
      return reply.code(403).send({ error: "only the round leader can clear winners" });
    }
    const comp = await getCompetition(req.params.competitionId);
    if (!comp || comp.roundId !== round.id) {
      return reply.code(404).send({ error: "competition not found" });
    }
    await clearClaimWinner(req.params.competitionId);
    const state = await buildRoundState(code, user.id);
    if (state) broadcast(code, { type: "competition_update", state });
    return { ok: true };
  });
}
