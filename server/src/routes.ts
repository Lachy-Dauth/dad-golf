import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  generateRoomCode,
  normalizeRoomCode,
} from "@dad-golf/shared";
import type { Hole, User } from "@dad-golf/shared";
import {
  addGroupMember,
  addPlayer,
  authenticateUser,
  createCourse,
  createGroup,
  createGroupInvite,
  createRound,
  createSession,
  createUser,
  deleteCourse,
  deleteGroup,
  deleteGroupInvite,
  deleteScore,
  deleteSession,
  favoriteCourse,
  findGroupMemberByUser,
  findPlayerByName,
  findPlayerByUserId,
  getCourse,
  getCourseFavoriteCount,
  getGroup,
  getGroupInviteByToken,
  getGroupMember,
  getPlayer,
  getRoundByRoomCode,
  getUserByUsername,
  getUserBySession,
  isUserInGroup,
  listCourses,
  listGroupInvites,
  listGroupMembers,
  listGroups,
  listPlayers,
  listRecentRounds,
  removeGroupMember,
  removePlayer,
  unfavoriteCourse,
  updateCourse,
  updateGroupMember,
  updatePlayer,
  updateRoundCurrentHole,
  updateRoundStatus,
  updateUserProfile,
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

function validateUsername(name: unknown): string {
  if (typeof name !== "string") throw new Error("username must be a string");
  const trimmed = name.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(trimmed)) {
    throw new Error(
      "username must be 3-24 chars, letters/numbers/_/-/. only",
    );
  }
  return trimmed;
}

function validatePassword(p: unknown): string {
  if (typeof p !== "string") throw new Error("password must be a string");
  if (p.length < 6 || p.length > 128) {
    throw new Error("password must be 6-128 characters");
  }
  return p;
}

function getViewerUser(req: FastifyRequest): User | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return null;
  return getUserBySession(match[1]);
}

function requireUser(req: FastifyRequest, reply: FastifyReply): User | null {
  const user = getViewerUser(req);
  if (!user) {
    reply.code(401).send({ error: "sign in required" });
    return null;
  }
  return user;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true }));

  // ---------- auth ----------
  app.post<{
    Body: {
      username?: string;
      password?: string;
      displayName?: string;
      handicap?: number;
    };
  }>("/api/auth/register", async (req, reply) => {
    try {
      const username = validateUsername(req.body?.username);
      const password = validatePassword(req.body?.password);
      const displayName = validateName(
        req.body?.displayName ?? username,
        "display name",
      );
      const handicap = validateHandicap(req.body?.handicap ?? 18);
      if (getUserByUsername(username)) {
        return reply.code(400).send({ error: "username already taken" });
      }
      const user = createUser(username, password, displayName, handicap);
      const token = createSession(user.id);
      return reply.code(201).send({ user, token });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/auth/login",
    async (req, reply) => {
      try {
        const username = validateUsername(req.body?.username);
        const password = validatePassword(req.body?.password);
        const user = authenticateUser(username, password);
        if (!user) {
          return reply.code(401).send({ error: "invalid credentials" });
        }
        const token = createSession(user.id);
        return { user, token };
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    },
  );

  app.post("/api/auth/logout", async (req, reply) => {
    const auth = req.headers.authorization;
    const match = auth ? /^Bearer\s+(.+)$/i.exec(auth) : null;
    if (match) deleteSession(match[1]);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = getViewerUser(req);
    if (!user) return reply.code(401).send({ error: "not signed in" });
    return { user };
  });

  app.patch<{
    Body: { displayName?: string; handicap?: number };
  }>("/api/auth/me", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    try {
      const displayName = validateName(req.body?.displayName, "display name");
      const handicap = validateHandicap(req.body?.handicap);
      updateUserProfile(user.id, displayName, handicap);
      return { user: { ...user, displayName, handicap } };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // ---------- courses ----------
  app.get("/api/courses", async (req) => {
    const viewer = getViewerUser(req);
    return { courses: listCourses(viewer?.id ?? null) };
  });

  app.get<{ Params: { id: string } }>(
    "/api/courses/:id",
    async (req, reply) => {
      const viewer = getViewerUser(req);
      const c = getCourse(req.params.id, viewer?.id ?? null);
      if (!c) return reply.code(404).send({ error: "course not found" });
      return { course: c };
    },
  );

  app.post<{
    Body: { name?: string; location?: string; holes?: unknown };
  }>("/api/courses", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    try {
      const name = validateName(req.body?.name, "course name");
      const location =
        typeof req.body?.location === "string"
          ? req.body.location.trim() || null
          : null;
      const holes = validateHoles(req.body?.holes);
      const course = createCourse(name, location, holes, user.id);
      return reply.code(201).send({ course });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { name?: string; location?: string; holes?: unknown };
  }>("/api/courses/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const course = getCourse(req.params.id, user.id);
    if (!course) return reply.code(404).send({ error: "course not found" });
    if (course.createdByUserId !== user.id) {
      return reply
        .code(403)
        .send({ error: "only the course creator can edit this course" });
    }
    try {
      const name = validateName(req.body?.name, "course name");
      const location =
        typeof req.body?.location === "string"
          ? req.body.location.trim() || null
          : null;
      const holes = validateHoles(req.body?.holes);
      updateCourse(course.id, name, location, holes);
      const updated = getCourse(course.id, user.id);
      return { course: updated };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>(
    "/api/courses/:id",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const course = getCourse(req.params.id, user.id);
      if (!course) return reply.code(404).send({ error: "course not found" });
      if (course.createdByUserId !== user.id) {
        return reply
          .code(403)
          .send({ error: "only the course creator can delete this course" });
      }
      const favCount = getCourseFavoriteCount(course.id);
      if (favCount > 0) {
        return reply.code(400).send({
          error: `course has ${favCount} favorite${favCount === 1 ? "" : "s"} and cannot be deleted`,
        });
      }
      deleteCourse(course.id);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/courses/:id/favorite",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const course = getCourse(req.params.id, user.id);
      if (!course) return reply.code(404).send({ error: "course not found" });
      favoriteCourse(user.id, course.id);
      return { course: getCourse(course.id, user.id) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/courses/:id/favorite",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      unfavoriteCourse(user.id, req.params.id);
      return { course: getCourse(req.params.id, user.id) };
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
      const user = requireUser(req, reply);
      if (!user) return;
      try {
        const name = validateName(req.body?.name, "group name");
        const group = createGroup(name, user.id);
        // Auto-add the creator as the first member
        addGroupMember(group.id, user.displayName, user.handicap, user.id);
        const members = listGroupMembers(group.id);
        return reply.code(201).send({ group, members });
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/api/groups/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const group = getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    if (group.ownerUserId !== user.id) {
      return reply
        .code(403)
        .send({ error: "only the group owner can delete this group" });
    }
    deleteGroup(req.params.id);
    return { ok: true };
  });

  app.post<{
    Params: { id: string };
    Body: { name?: string; handicap?: number };
  }>("/api/groups/:id/members", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    try {
      const group = getGroup(req.params.id);
      if (!group)
        return reply.code(404).send({ error: "group not found" });
      if (group.ownerUserId !== user.id) {
        return reply
          .code(403)
          .send({ error: "only the group owner can add members" });
      }
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
    const user = requireUser(req, reply);
    if (!user) return;
    try {
      const group = getGroup(req.params.id);
      if (!group)
        return reply.code(404).send({ error: "group not found" });
      const member = getGroupMember(req.params.memberId);
      if (!member || member.groupId !== group.id) {
        return reply.code(404).send({ error: "member not found" });
      }
      const isOwner = group.ownerUserId === user.id;
      const isSelf = member.userId === user.id;
      if (!isOwner && !isSelf) {
        return reply.code(403).send({ error: "not allowed" });
      }
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
  }>("/api/groups/:id/members/:memberId", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const group = getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const member = getGroupMember(req.params.memberId);
    if (!member || member.groupId !== group.id) {
      return reply.code(404).send({ error: "member not found" });
    }
    const isOwner = group.ownerUserId === user.id;
    const isSelf = member.userId === user.id;
    if (!isOwner && !isSelf) {
      return reply.code(403).send({ error: "not allowed" });
    }
    if (isSelf && isOwner) {
      return reply
        .code(400)
        .send({ error: "owner cannot leave their own group" });
    }
    removeGroupMember(req.params.memberId);
    return { ok: true };
  });

  // ---------- group invites ----------
  app.get<{ Params: { id: string } }>(
    "/api/groups/:id/invites",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const group = getGroup(req.params.id);
      if (!group) return reply.code(404).send({ error: "group not found" });
      if (group.ownerUserId !== user.id) {
        return reply
          .code(403)
          .send({ error: "only the group owner can manage invites" });
      }
      return { invites: listGroupInvites(group.id) };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/groups/:id/invites",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const group = getGroup(req.params.id);
      if (!group) return reply.code(404).send({ error: "group not found" });
      if (group.ownerUserId !== user.id) {
        return reply
          .code(403)
          .send({ error: "only the group owner can create invites" });
      }
      const invite = createGroupInvite(group.id);
      return reply.code(201).send({ invite });
    },
  );

  app.delete<{ Params: { id: string; inviteId: string } }>(
    "/api/groups/:id/invites/:inviteId",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const group = getGroup(req.params.id);
      if (!group) return reply.code(404).send({ error: "group not found" });
      if (group.ownerUserId !== user.id) {
        return reply.code(403).send({ error: "not allowed" });
      }
      deleteGroupInvite(req.params.inviteId);
      return { ok: true };
    },
  );

  app.get<{ Params: { token: string } }>(
    "/api/group-invites/:token",
    async (req, reply) => {
      const invite = getGroupInviteByToken(req.params.token);
      if (!invite)
        return reply.code(404).send({ error: "invite not found" });
      const group = getGroup(invite.groupId);
      if (!group)
        return reply.code(404).send({ error: "group not found" });
      const memberCount = listGroupMembers(group.id).length;
      return { invite, group, memberCount };
    },
  );

  app.post<{ Params: { token: string } }>(
    "/api/group-invites/:token/accept",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const invite = getGroupInviteByToken(req.params.token);
      if (!invite)
        return reply.code(404).send({ error: "invite not found" });
      const group = getGroup(invite.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const existing = findGroupMemberByUser(group.id, user.id);
      if (existing) {
        return { group, member: existing };
      }
      const members = listGroupMembers(group.id);
      if (members.length >= MAX_MEMBERS_PER_GROUP) {
        return reply.code(400).send({ error: "group is full" });
      }
      const member = addGroupMember(
        group.id,
        user.displayName,
        user.handicap,
        user.id,
      );
      return reply.code(201).send({ group, member });
    },
  );

  // ---------- rounds ----------
  app.get("/api/rounds/recent", async () => {
    return { rounds: listRecentRounds(20) };
  });

  app.post<{
    Body: {
      courseId?: string;
      groupId?: string | null;
      memberIds?: string[];
    };
  }>("/api/rounds", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    try {
      const { courseId, groupId, memberIds } = req.body ?? {};
      if (!courseId) throw new Error("courseId is required");
      const course = getCourse(courseId, user.id);
      if (!course) throw new Error("course not found");

      if (groupId) {
        if (!isUserInGroup(groupId, user.id)) {
          return reply.code(403).send({
            error: "you must be a member of the group to start a round for it",
          });
        }
      }

      let code = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        code = generateRoomCode();
        if (!getRoundByRoomCode(code)) break;
      }
      const round = createRound(code, course.id, groupId ?? null, user.id);

      // Add the creator (round leader) as a player so they show in the lobby
      addPlayer(round.id, user.displayName, user.handicap, user.id);

      if (groupId && Array.isArray(memberIds) && memberIds.length > 0) {
        const members = listGroupMembers(groupId);
        const wanted = new Set(memberIds);
        let added = 1; // already added creator
        for (const m of members) {
          if (!wanted.has(m.id)) continue;
          if (m.userId === user.id) continue; // creator already added
          if (added >= MAX_PLAYERS_PER_ROUND) break;
          // avoid duplicate names within a round
          if (findPlayerByName(round.id, m.name)) continue;
          addPlayer(round.id, m.name, m.handicap, m.userId);
          added++;
        }
      }
      const state = buildRoundState(round.roomCode, user.id);
      return reply.code(201).send({ state });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.get<{ Params: { code: string } }>(
    "/api/rounds/:code",
    async (req, reply) => {
      const viewer = getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const state = buildRoundState(code, viewer?.id ?? null);
      if (!state) return reply.code(404).send({ error: "round not found" });
      return { state };
    },
  );

  app.post<{
    Params: { code: string };
    Body: { name?: string; handicap?: number };
  }>("/api/rounds/:code/players", async (req, reply) => {
    try {
      const viewer = getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      if (round.status === "complete") {
        return reply.code(400).send({ error: "round is already complete" });
      }

      // If signed in, idempotent rejoin by user_id
      if (viewer) {
        const existingByUser = findPlayerByUserId(round.id, viewer.id);
        if (existingByUser) {
          const state = buildRoundState(code, viewer.id);
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

      const existing = findPlayerByName(round.id, name);
      if (existing) {
        const state = buildRoundState(code, viewer?.id ?? null);
        return { player: existing, state };
      }
      const players = listPlayers(round.id);
      if (players.length >= MAX_PLAYERS_PER_ROUND) {
        return reply
          .code(400)
          .send({ error: `round is full (${MAX_PLAYERS_PER_ROUND} max)` });
      }
      const player = addPlayer(round.id, name, handicap, viewer?.id ?? null);
      const state = buildRoundState(code, viewer?.id ?? null);
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
      const viewer = getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      const player = getPlayer(req.params.playerId);
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
      updatePlayer(req.params.playerId, name, handicap);
      const state = buildRoundState(code, viewer?.id ?? null);
      if (state) broadcast(code, { type: "state", state });
      return { ok: true, state };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{
    Params: { code: string; playerId: string };
  }>("/api/rounds/:code/players/:playerId", async (req, reply) => {
    const viewer = getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const player = getPlayer(req.params.playerId);
    if (!player || player.roundId !== round.id) {
      return reply.code(404).send({ error: "player not found" });
    }
    const isLeader = viewer?.id === round.leaderUserId;
    const isSelf = viewer && player.userId === viewer.id;
    if (!isLeader && !isSelf) {
      return reply.code(403).send({ error: "not allowed" });
    }
    removePlayer(req.params.playerId);
    const state = buildRoundState(code, viewer?.id ?? null);
    if (state) broadcast(code, { type: "state", state });
    return { ok: true };
  });

  app.post<{ Params: { code: string } }>(
    "/api/rounds/:code/start",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      if (round.leaderUserId !== user.id) {
        return reply
          .code(403)
          .send({ error: "only the round leader can start this round" });
      }
      updateRoundStatus(round.id, "in_progress");
      const state = buildRoundState(code, user.id);
      if (state) broadcast(code, { type: "round_started", state });
      return { state };
    },
  );

  app.post<{ Params: { code: string } }>(
    "/api/rounds/:code/complete",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      if (round.leaderUserId !== user.id) {
        return reply
          .code(403)
          .send({ error: "only the round leader can end this round" });
      }
      updateRoundStatus(round.id, "complete");
      const state = buildRoundState(code, user.id);
      if (state) broadcast(code, { type: "round_completed", state });
      return { state };
    },
  );

  app.post<{
    Params: { code: string };
    Body: { holeNumber?: number };
  }>("/api/rounds/:code/current-hole", async (req, reply) => {
    const viewer = getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const holeNumber = Number(req.body?.holeNumber);
    const course = getCourse(round.courseId, viewer?.id ?? null);
    if (!course) return reply.code(500).send({ error: "course missing" });
    if (
      !Number.isInteger(holeNumber) ||
      holeNumber < 1 ||
      holeNumber > course.holes.length
    ) {
      return reply.code(400).send({ error: "invalid hole number" });
    }
    updateRoundCurrentHole(round.id, holeNumber);
    const state = buildRoundState(code, viewer?.id ?? null);
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
      const viewer = getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = getRoundByRoomCode(code);
      if (!round)
        return reply.code(404).send({ error: "round not found" });
      const course = getCourse(round.courseId, viewer?.id ?? null);
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
      const state = buildRoundState(code, viewer?.id ?? null);
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
    const viewer = getViewerUser(req);
    const code = normalizeRoomCode(req.params.code);
    const round = getRoundByRoomCode(code);
    if (!round) return reply.code(404).send({ error: "round not found" });
    const playerId = String(req.body?.playerId ?? "");
    const holeNumber = Number(req.body?.holeNumber);
    if (!playerId || !Number.isInteger(holeNumber)) {
      return reply.code(400).send({ error: "invalid request" });
    }
    deleteScore(playerId, holeNumber);
    const state = buildRoundState(code, viewer?.id ?? null);
    if (state) broadcast(code, { type: "state", state });
    return { ok: true };
  });
}
