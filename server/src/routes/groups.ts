import type { FastifyInstance } from "fastify";
import type { GroupRole } from "@dad-golf/shared";
import {
  addGroupMember,
  countGroupAdmins,
  createGroup,
  createGroupInvite,
  deleteGroup,
  deleteGroupInvite,
  findGroupMemberByUser,
  getGroup,
  getGroupInviteByToken,
  getGroupMember,
  getUserRoleInGroup,
  isUserInGroup,
  listGroupCompletedRounds,
  listGroupInvites,
  listGroupMembers,
  listGroups,
  removeGroupMember,
  updateGroupMember,
  updateGroupMemberRole,
  createActivityEvent,
} from "../db/index.js";
import { evaluateBadges } from "../badgeEvaluator.js";
import {
  MAX_MEMBERS_PER_GROUP,
  errorMessage,
  fireAndForget,
  getViewerUser,
  parsePagination,
  requireUser,
  validateHandicap,
  validateName,
} from "./validation.js";

const VALID_ROLES: GroupRole[] = ["admin", "member"];

export async function registerGroupRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/groups", async (req) => {
    const viewer = await getViewerUser(req);
    const groupRows = await listGroups();
    const groups = await Promise.all(
      groupRows.map(async (g) => ({
        ...g,
        members: await listGroupMembers(g.id),
      })),
    );
    if (!viewer) return { groups: [] };
    return { groups: groups.filter((g) => g.members.some((m) => m.userId === viewer.id)) };
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const g = await getGroup(req.params.id);
    if (!g) return reply.code(404).send({ error: "group not found" });
    if (!(await isUserInGroup(g.id, user.id))) {
      return reply.code(403).send({ error: "you must be a member of this group" });
    }
    const members = await listGroupMembers(g.id);
    return { group: g, members };
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    "/api/groups/:id/rounds",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const g = await getGroup(req.params.id);
      if (!g) return reply.code(404).send({ error: "group not found" });
      if (!(await isUserInGroup(g.id, user.id))) {
        return reply.code(403).send({ error: "you must be a member of this group" });
      }
      const { limit, offset } = parsePagination(req.query);
      return listGroupCompletedRounds(g.id, user.id, limit, offset);
    },
  );

  app.post<{ Body: { name?: string } }>("/api/groups", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const name = validateName(req.body?.name, "group name");
      const group = await createGroup(name, user.id);
      // Auto-add the creator as the first admin member
      await addGroupMember(group.id, user.displayName, user.handicap, user.id, "admin");
      const members = await listGroupMembers(group.id);
      return reply.code(201).send({ group, members });
    } catch (e) {
      return reply.code(400).send({ error: errorMessage(e) });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/groups/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const role = await getUserRoleInGroup(group.id, user.id);
    if (role !== "admin") {
      return reply.code(403).send({ error: "only group admins can delete this group" });
    }
    await deleteGroup(req.params.id);
    return { ok: true };
  });

  app.post<{
    Params: { id: string };
    Body: { name?: string; handicap?: number };
  }>("/api/groups/:id/members", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const group = await getGroup(req.params.id);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (role !== "admin") {
        return reply.code(403).send({ error: "only group admins can add members" });
      }
      const existing = await listGroupMembers(group.id);
      if (existing.length >= MAX_MEMBERS_PER_GROUP) {
        return reply
          .code(400)
          .send({ error: `group can hold up to ${MAX_MEMBERS_PER_GROUP} members` });
      }
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      const member = await addGroupMember(group.id, name, handicap);
      return reply.code(201).send({ member });
    } catch (e) {
      return reply.code(400).send({ error: errorMessage(e) });
    }
  });

  app.patch<{
    Params: { id: string; memberId: string };
    Body: { name?: string; handicap?: number };
  }>("/api/groups/:id/members/:memberId", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const group = await getGroup(req.params.id);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const member = await getGroupMember(req.params.memberId);
      if (!member || member.groupId !== group.id) {
        return reply.code(404).send({ error: "member not found" });
      }
      const callerRole = await getUserRoleInGroup(group.id, user.id);
      const isSelf = member.userId === user.id;
      if (callerRole !== "admin" && !isSelf) {
        return reply.code(403).send({ error: "not allowed" });
      }
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      await updateGroupMember(req.params.memberId, name, handicap);
      return { ok: true };
    } catch (e) {
      return reply.code(400).send({ error: errorMessage(e) });
    }
  });

  app.delete<{
    Params: { id: string; memberId: string };
  }>("/api/groups/:id/members/:memberId", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const member = await getGroupMember(req.params.memberId);
    if (!member || member.groupId !== group.id) {
      return reply.code(404).send({ error: "member not found" });
    }
    const callerRole = await getUserRoleInGroup(group.id, user.id);
    const isSelf = member.userId === user.id;
    if (callerRole !== "admin" && !isSelf) {
      return reply.code(403).send({ error: "not allowed" });
    }
    // Prevent the last admin from leaving
    if (isSelf && callerRole === "admin") {
      const adminCount = await countGroupAdmins(group.id);
      if (adminCount <= 1) {
        return reply.code(400).send({ error: "the last admin cannot leave the group" });
      }
    }
    await removeGroupMember(req.params.memberId);
    return { ok: true };
  });

  // ---------- group invites ----------
  app.get<{ Params: { id: string } }>("/api/groups/:id/invites", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const role = await getUserRoleInGroup(group.id, user.id);
    if (role !== "admin") {
      return reply.code(403).send({ error: "only group admins can manage invites" });
    }
    return { invites: await listGroupInvites(group.id) };
  });

  app.post<{ Params: { id: string } }>("/api/groups/:id/invites", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const role = await getUserRoleInGroup(group.id, user.id);
    if (role !== "admin") {
      return reply.code(403).send({ error: "only group admins can create invites" });
    }
    const invite = await createGroupInvite(group.id);
    return reply.code(201).send({ invite });
  });

  app.delete<{ Params: { id: string; inviteId: string } }>(
    "/api/groups/:id/invites/:inviteId",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const group = await getGroup(req.params.id);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (role !== "admin") {
        return reply.code(403).send({ error: "not allowed" });
      }
      await deleteGroupInvite(req.params.inviteId);
      return { ok: true };
    },
  );

  // ---------- member role management ----------
  app.patch<{
    Params: { id: string; memberId: string };
    Body: { role?: string };
  }>("/api/groups/:id/members/:memberId/role", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const callerRole = await getUserRoleInGroup(group.id, user.id);
    if (callerRole !== "admin") {
      return reply.code(403).send({ error: "only group admins can change roles" });
    }
    const member = await getGroupMember(req.params.memberId);
    if (!member || member.groupId !== group.id) {
      return reply.code(404).send({ error: "member not found" });
    }
    const newRole = req.body?.role;
    if (!newRole || !VALID_ROLES.includes(newRole as GroupRole)) {
      return reply.code(400).send({ error: "role must be admin or member" });
    }
    // Prevent demoting the last admin
    if (member.role === "admin" && newRole !== "admin") {
      const adminCount = await countGroupAdmins(group.id);
      if (adminCount <= 1) {
        return reply.code(400).send({ error: "cannot demote the last admin" });
      }
    }
    // Guest members cannot be promoted to admin
    if (member.userId === null && newRole !== "member") {
      return reply.code(400).send({ error: "guest members cannot be given admin role" });
    }
    await updateGroupMemberRole(member.id, newRole as GroupRole);
    return { ok: true };
  });

  app.get<{ Params: { token: string } }>("/api/group-invites/:token", async (req, reply) => {
    const invite = await getGroupInviteByToken(req.params.token);
    if (!invite) return reply.code(404).send({ error: "invite not found" });
    const group = await getGroup(invite.groupId);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const memberCount = (await listGroupMembers(group.id)).length;
    return { invite, group, memberCount };
  });

  app.post<{ Params: { token: string } }>(
    "/api/group-invites/:token/accept",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const invite = await getGroupInviteByToken(req.params.token);
      if (!invite) return reply.code(404).send({ error: "invite not found" });
      const group = await getGroup(invite.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const existing = await findGroupMemberByUser(group.id, user.id);
      if (existing) {
        return { group, member: existing };
      }
      const members = await listGroupMembers(group.id);
      if (members.length >= MAX_MEMBERS_PER_GROUP) {
        return reply.code(400).send({ error: "group is full" });
      }
      const member = await addGroupMember(group.id, user.displayName, user.handicap, user.id);
      // Fire activity event and evaluate badges
      fireAndForget(
        createActivityEvent("member_joined", user.id, group.id, null, user.activityVisibility, {
          groupName: group.name,
        }),
        req.log,
        "member_joined activity event",
      );
      fireAndForget(
        evaluateBadges({
          trigger: "member_joined",
          userId: user.id,
          groupId: group.id,
          visibility: user.activityVisibility,
        }),
        req.log,
        "member_joined badge evaluation",
      );
      return reply.code(201).send({ group, member });
    },
  );
}
