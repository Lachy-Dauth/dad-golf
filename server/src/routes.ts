import type { FastifyInstance } from "fastify";
import {
  generateRoomCode,
  normalizeRoomCode,
} from "@dad-golf/shared";
import type { Hole } from "@dad-golf/shared";
import {
  addGroupMember,
  addPlayer,
  createCourse,
  createGroup,
  createRound,
  deleteCourse,
  deleteGroup,
  deleteScore,
  findPlayerByName,
  getCourse,
  getGroup,
  getRoundByRoomCode,
  listCourses,
  listGroupMembers,
  listGroups,
  listPlayers,
  listRecentRounds,
  removeGroupMember,
  removePlayer,
  updateGroupMember,
  updatePlayer,
  updateRoundCurrentHole,
  updateRoundStatus,
  upsertScore,
} from "./db.js";
import { buildRoundState } from "./roundState.js";
import { broadcast } from "./hub.js";

const MAX_PLAYERS_PER_ROUND = 32;
const MAX_MEMBERS_PER_GROUP = 64;

function validateHoles(holes: unknown): Hole[] {
  if (!Array.isArray(holes))
    throw new Error("holes must be an array");
  if (holes.length !== 9 && holes.length !== 18) {
    throw new Error("holes must contain 9 or 18 entries");
  }
  const parsed: Hole[] = holes.map((h: unknown, i: number) => {
    const obj = h as Record<string, unknown>;
    const number = Number(obj.number ?? i + 1);
    const par = Number(obj.par);
    const strokeIndex = Number(obj.strokeIndex ?? obj.stroke_index);
    if (!Number.isInteger(number) || number < 1 || number > 18)
      throw new Error(`invalid hole number at index ${i}`);
    if (!Number.isInteger(par) || par < 3 || par > 6)
      throw new Error(`invalid par at hole ${number}`);
    if (
      !Number.isInteger(strokeIndex) ||
      strokeIndex < 1 ||
      strokeIndex > holes.length
    )
      throw new Error(`invalid stroke index at hole ${number}`);
    return { number, par, strokeIndex };
  });
  // unique stroke indexes
  const siSet = new Set(parsed.map((h) => h.strokeIndex));
  if (siSet.size !== parsed.length) {
    throw new Error("stroke indexes must be unique");
  }
  const numSet = new Set(parsed.map((h) => h.number));
  if (numSet.size !== parsed.length) {
    throw new Error("hole numbers must be unique");
  }
  return parsed.sort((a, b) => a.number - b.number);
}

function validateHandicap(h: unknown): number {
  const n = Number(h);
  if (!Number.isInteger(n) || n < 0 || n > 54) {
    throw new Error("handicap must be integer 0-54");
  }
  return n;
}

function validateName(name: unknown, field = "name"): string {
  if (typeof name !== "string") throw new Error(`${field} must be a string`);
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40)
    throw new Error(`${field} must be 1-40 characters`);
  return trimmed;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true }));

  // ---------- courses ----------
  app.get("/api/courses", async () => {
    return { courses: listCourses() };
  });

  app.get<{ Params: { id: string } }>(
    "/api/courses/:id",
    async (req, reply) => {
      const c = getCourse(req.params.id);
      if (!c) return reply.code(404).send({ error: "course not found" });
      return { course: c };
    },
  );

  app.post<{
    Body: { name?: string; location?: string; holes?: unknown };
  }>("/api/courses", async (req, reply) => {
    try {
      const name = validateName(req.body?.name, "course name");
      const location =
        typeof req.body?.location === "string"
          ? req.body.location.trim() || null
          : null;
      const holes = validateHoles(req.body?.holes);
      const course = createCourse(name, location, holes);
      return reply.code(201).send({ course });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>(
    "/api/courses/:id",
    async (req) => {
      deleteCourse(req.params.id);
      return { ok: true };
    },
  );

  // ---------- groups ----------
  app.get("/api/groups", async () => {
    const groups = listGroups().map((g) => ({
      ...g,
      members: listGroupMembers(g.id),
    }));
    return { groups };
  });

  app.get<{ Params: { id: string } }>(
    "/api/groups/:id",
    async (req, reply) => {
      const g = getGroup(req.params.id);
      if (!g) return reply.code(404).send({ error: "group not found" });
      const members = listGroupMembers(g.id);
      return { group: g, members };
    },
  );

  app.post<{ Body: { name?: string } }>(
    "/api/groups",
    async (req, reply) => {
      try {
        const name = validateName(req.body?.name, "group name");
        const group = createGroup(name);
        return reply.code(201).send({ group, members: [] });
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/api/groups/:id", async (req) => {
    deleteGroup(req.params.id);
    return { ok: true };
  });

  app.post<{
    Params: { id: string };
    Body: { name?: string; handicap?: number };
  }>("/api/groups/:id/members", async (req, reply) => {
    try {
      const group = getGroup(req.params.id);
      if (!group)
        return reply.code(404).send({ error: "group not found" });
      const existing = listGroupMembers(group.id);
      if (existing.length >= MAX_MEMBERS_PER_GROUP) {
        return reply
          .code(400)
          .send({ error: `group can hold up to ${MAX_MEMBERS_PER_GROUP} members` });
      }
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      const member = addGroupMember(group.id, name, handicap);
      return reply.code(201).send({ member });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.patch<{
    Params: { id: string; memberId: string };
    Body: { name?: string; handicap?: number };
  }>("/api/groups/:id/members/:memberId", async (req, reply) => {
    try {
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      updateGroupMember(req.params.memberId, name, handicap);
      return { ok: true };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { id: string; memberId: string };
  }>("/api/groups/:id/members/:memberId", async (req) => {
    removeGroupMember(req.params.memberId);
    return { ok: true };
  });

  // ---------- rounds ----------
  app.get("/api/rounds/recent", async () => {
    return { rounds: listRecentRounds(20) };
  });

  app.post<{
    Body: {
      courseId?: string;
      groupId?: string | null;
      importGroupMembers?: boolean;
    };
  }>("/api/rounds", async (req, reply) => {
    try {
      const { courseId, groupId, importGroupMembers } = req.body ?? {};
      if (!courseId) throw new Error("courseId is required");
      const course = getCourse(courseId);
      if (!course) throw new Error("course not found");
      let code = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        code = generateRoomCode();
        if (!getRoundByRoomCode(code)) break;
      }
      const round = createRound(code, course.id, groupId ?? null);
      if (importGroupMembers && groupId) {
        const members = listGroupMembers(groupId);
        for (const m of members.slice(0, MAX_PLAYERS_PER_ROUND)) {
          addPlayer(round.id, m.name, m.handicap);
        }
      }
      const state = buildRoundState(round.roomCode);
      return reply.code(201).send({ state });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.get<{ Params: { code: string } }>(
    "/api/rounds/:code",
    async (req, reply) => {
      const code = normalizeRoomCode(req.params.code);
      const state = buildRoundState(code);
      if (!state) return reply.code(404).send({ error: "round not found" });
      return { state };
    },
  );

  app.post<{
    Params: { code: string };
    Body: { name?: string; handicap?: number };
  }>("/api/rounds/:code/players", async (req, reply) => {
    try {
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      if (round.status === "complete") {
        return reply.code(400).send({ error: "round is already complete" });
      }
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      const existing = findPlayerByName(round.id, name);
      if (existing) {
        // idempotent rejoin
        const state = buildRoundState(code);
        return { player: existing, state };
      }
      const players = listPlayers(round.id);
      if (players.length >= MAX_PLAYERS_PER_ROUND) {
        return reply
          .code(400)
          .send({ error: `round is full (${MAX_PLAYERS_PER_ROUND} max)` });
      }
      const player = addPlayer(round.id, name, handicap);
      const state = buildRoundState(code);
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
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      updatePlayer(req.params.playerId, name, handicap);
      const state = buildRoundState(code);
      if (state) broadcast(code, { type: "state", state });
      return { ok: true, state };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { code: string; playerId: string };
  }>("/api/rounds/:code/players/:playerId", async (req, reply) => {
    const code = normalizeRoomCode(req.params.code);
    const round = getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    removePlayer(req.params.playerId);
    const state = buildRoundState(code);
    if (state) broadcast(code, { type: "state", state });
    return { ok: true };
  });

  app.post<{ Params: { code: string } }>(
    "/api/rounds/:code/start",
    async (req, reply) => {
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      updateRoundStatus(round.id, "in_progress");
      const state = buildRoundState(code);
      if (state) broadcast(code, { type: "round_started", state });
      return { state };
    },
  );

  app.post<{ Params: { code: string } }>(
    "/api/rounds/:code/complete",
    async (req, reply) => {
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      updateRoundStatus(round.id, "complete");
      const state = buildRoundState(code);
      if (state) broadcast(code, { type: "round_completed", state });
      return { state };
    },
  );

  app.post<{
    Params: { code: string };
    Body: { holeNumber?: number };
  }>("/api/rounds/:code/current-hole", async (req, reply) => {
    const code = normalizeRoomCode(req.params.code);
    const round = getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const holeNumber = Number(req.body?.holeNumber);
    const course = getCourse(round.courseId);
    if (!course) return reply.code(500).send({ error: "course missing" });
    if (
      !Number.isInteger(holeNumber) ||
      holeNumber < 1 ||
      holeNumber > course.holes.length
    ) {
      return reply.code(400).send({ error: "invalid hole number" });
    }
    updateRoundCurrentHole(round.id, holeNumber);
    const state = buildRoundState(code);
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
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      const course = getCourse(round.courseId);
      if (!course)
        return reply.code(500).send({ error: "course missing" });
      const playerId = String(req.body?.playerId ?? "");
      const holeNumber = Number(req.body?.holeNumber);
      const strokes = Number(req.body?.strokes);
      if (!playerId) throw new Error("playerId is required");
      if (
        !Number.isInteger(holeNumber) ||
        holeNumber < 1 ||
        holeNumber > course.holes.length
      ) {
        throw new Error("invalid hole number");
      }
      if (!Number.isInteger(strokes) || strokes < 1 || strokes > 20) {
        throw new Error("strokes must be integer 1-20");
      }
      const score = upsertScore(round.id, playerId, holeNumber, strokes);
      if (round.status === "waiting") {
        updateRoundStatus(round.id, "in_progress");
      }
      const state = buildRoundState(code);
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
    const code = normalizeRoomCode(req.params.code);
    const round = getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const playerId = String(req.body?.playerId ?? "");
    const holeNumber = Number(req.body?.holeNumber);
    if (!playerId || !Number.isInteger(holeNumber)) {
      return reply.code(400).send({ error: "invalid request" });
    }
    deleteScore(playerId, holeNumber);
    const state = buildRoundState(code);
    if (state) broadcast(code, { type: "state", state });
    return { ok: true };
  });
}
