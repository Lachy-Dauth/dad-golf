import type { FastifyInstance } from "fastify";
import {
  addGroupMember,
  createGroup,
  createGroupInvite,
  deleteGroup,
  deleteGroupInvite,
  findGroupMemberByUser,
  getGroup,
  getGroupInviteByToken,
  getGroupMember,
  listGroupInvites,
  listGroupMembers,
  listGroups,
  removeGroupMember,
  updateGroupMember,
} from "../db/index.js";
import {
  MAX_MEMBERS_PER_GROUP,
  requireUser,
  validateHandicap,
  validateName,
} from "./validation.js";

export async function registerGroupRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/groups", async () => {
    const groupRows = await listGroups();
    const groups = await Promise.all(
      groupRows.map(async (g) => ({
        ...g,
        members: await listGroupMembers(g.id),
      })),
    );
    return { groups };
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id", async (req, reply) => {
    const g = await getGroup(req.params.id);
    if (!g) return reply.code(404).send({ error: "group not found" });
    const members = await listGroupMembers(g.id);
    return { group: g, members };
  });

  app.post<{ Body: { name?: string } }>("/api/groups", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const name = validateName(req.body?.name, "group name");
      const group = await createGroup(name, user.id);
      // Auto-add the creator as the first member
      await addGroupMember(group.id, user.displayName, user.handicap, user.id);
      const members = await listGroupMembers(group.id);
      return reply.code(201).send({ group, members });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/groups/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    if (group.ownerUserId !== user.id) {
      return reply.code(403).send({ error: "only the group owner can delete this group" });
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
      if (group.ownerUserId !== user.id) {
        return reply.code(403).send({ error: "only the group owner can add members" });
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
      return reply.code(400).send({ error: (e as Error).message });
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
      const isOwner = group.ownerUserId === user.id;
      const isSelf = member.userId === user.id;
      if (!isOwner && !isSelf) {
        return reply.code(403).send({ error: "not allowed" });
      }
      const name = validateName(req.body?.name);
      const handicap = validateHandicap(req.body?.handicap);
      await updateGroupMember(req.params.memberId, name, handicap);
      return { ok: true };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
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
    const isOwner = group.ownerUserId === user.id;
    const isSelf = member.userId === user.id;
    if (!isOwner && !isSelf) {
      return reply.code(403).send({ error: "not allowed" });
    }
    if (isSelf && isOwner) {
      return reply.code(400).send({ error: "owner cannot leave their own group" });
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
    if (group.ownerUserId !== user.id) {
      return reply.code(403).send({ error: "only the group owner can manage invites" });
    }
    return { invites: await listGroupInvites(group.id) };
  });

  app.post<{ Params: { id: string } }>("/api/groups/:id/invites", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    if (group.ownerUserId !== user.id) {
      return reply.code(403).send({ error: "only the group owner can create invites" });
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
      if (group.ownerUserId !== user.id) {
        return reply.code(403).send({ error: "not allowed" });
      }
      await deleteGroupInvite(req.params.inviteId);
      return { ok: true };
    },
  );

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
      return reply.code(201).send({ group, member });
    },
  );
}
