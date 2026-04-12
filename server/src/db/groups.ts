import { randomBytes } from "node:crypto";
import type { Group, GroupInvite, GroupMember, GroupRole } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";
import { getUser } from "./users.js";

// ---------- groups ----------
interface GroupRow {
  id: string;
  name: string;
  created_at: string;
  owner_user_id: string | null;
}
interface GroupListRow extends GroupRow {
  owner_name: string | null;
}

function rowToGroup(row: GroupListRow): Group {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
  };
}

export async function createGroup(name: string, ownerUserId: string): Promise<Group> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO groups (id, name, created_at, owner_user_id) VALUES ($1, $2, $3, $4)`,
    [id, name, createdAt, ownerUserId],
  );
  const owner = await getUser(ownerUserId);
  return {
    id,
    name,
    createdAt,
    ownerUserId,
    ownerName: owner?.displayName ?? null,
  };
}

export async function listGroups(): Promise<Group[]> {
  const { rows } = await pool.query(
    `SELECT g.*, u.display_name AS owner_name
       FROM groups g
       LEFT JOIN users u ON u.id = g.owner_user_id
       ORDER BY g.name ASC`,
  );
  return (rows as GroupListRow[]).map(rowToGroup);
}

export async function getGroup(id: string): Promise<Group | null> {
  const { rows } = await pool.query(
    `SELECT g.*, u.display_name AS owner_name
       FROM groups g
       LEFT JOIN users u ON u.id = g.owner_user_id
       WHERE g.id = $1`,
    [id],
  );
  const row = rows[0] as GroupListRow | undefined;
  return row ? rowToGroup(row) : null;
}

export async function deleteGroup(id: string): Promise<void> {
  await pool.query(`DELETE FROM groups WHERE id = $1`, [id]);
}

// ---------- group members ----------
interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  handicap: number;
  role: string;
  created_at: string;
}

function rowToGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    name: row.name,
    handicap: Number(row.handicap),
    role: row.role as GroupRole,
    createdAt: row.created_at,
  };
}

export async function addGroupMember(
  groupId: string,
  name: string,
  handicap: number,
  userId: string | null = null,
  role: GroupRole = "member",
): Promise<GroupMember> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO group_members (id, group_id, user_id, name, handicap, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, groupId, userId, name, handicap, role, createdAt],
  );
  return { id, groupId, userId, name, handicap, role, createdAt };
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { rows } = await pool.query(
    `SELECT * FROM group_members WHERE group_id = $1 ORDER BY created_at ASC`,
    [groupId],
  );
  return (rows as GroupMemberRow[]).map(rowToGroupMember);
}

export async function getGroupMember(memberId: string): Promise<GroupMember | null> {
  const { rows } = await pool.query(`SELECT * FROM group_members WHERE id = $1`, [memberId]);
  const row = rows[0] as GroupMemberRow | undefined;
  return row ? rowToGroupMember(row) : null;
}

export async function findGroupMemberByUser(
  groupId: string,
  userId: string,
): Promise<GroupMember | null> {
  const { rows } = await pool.query(
    `SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  const row = rows[0] as GroupMemberRow | undefined;
  return row ? rowToGroupMember(row) : null;
}

export async function isUserInGroup(groupId: string, userId: string): Promise<boolean> {
  if (!groupId || !userId) return false;
  const { rows: memberRows } = await pool.query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
    [groupId, userId],
  );
  if (memberRows.length > 0) return true;
  const { rows: ownerRows } = await pool.query(`SELECT owner_user_id FROM groups WHERE id = $1`, [
    groupId,
  ]);
  const owner = ownerRows[0] as { owner_user_id: string | null } | undefined;
  return owner?.owner_user_id === userId;
}

export async function updateGroupMember(
  memberId: string,
  name: string,
  handicap: number,
): Promise<void> {
  await pool.query(`UPDATE group_members SET name = $1, handicap = $2 WHERE id = $3`, [
    name,
    handicap,
    memberId,
  ]);
}

export async function removeGroupMember(memberId: string): Promise<void> {
  await pool.query(`DELETE FROM group_members WHERE id = $1`, [memberId]);
}

export async function updateGroupMemberRole(memberId: string, role: GroupRole): Promise<void> {
  await pool.query(`UPDATE group_members SET role = $1 WHERE id = $2`, [role, memberId]);
}

export async function getUserRoleInGroup(
  groupId: string,
  userId: string,
): Promise<GroupRole | null> {
  const { rows } = await pool.query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  const row = rows[0] as { role: string } | undefined;
  return row ? (row.role as GroupRole) : null;
}

export async function countGroupAdmins(groupId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM group_members WHERE group_id = $1 AND role = 'admin'`,
    [groupId],
  );
  return Number((rows[0] as { count: string }).count);
}

// ---------- group invites ----------
export async function createGroupInvite(groupId: string): Promise<GroupInvite> {
  const id = newId();
  const token = randomBytes(12).toString("hex");
  const createdAt = now();
  await pool.query(
    `INSERT INTO group_invites (id, group_id, token, created_at) VALUES ($1, $2, $3, $4)`,
    [id, groupId, token, createdAt],
  );
  return { id, groupId, token, createdAt };
}

interface GroupInviteRow {
  id: string;
  group_id: string;
  token: string;
  created_at: string;
}

function rowToGroupInvite(row: GroupInviteRow): GroupInvite {
  return {
    id: row.id,
    groupId: row.group_id,
    token: row.token,
    createdAt: row.created_at,
  };
}

export async function listGroupInvites(groupId: string): Promise<GroupInvite[]> {
  const { rows } = await pool.query(
    `SELECT * FROM group_invites WHERE group_id = $1 ORDER BY created_at DESC`,
    [groupId],
  );
  return (rows as GroupInviteRow[]).map(rowToGroupInvite);
}

export async function getGroupInviteByToken(token: string): Promise<GroupInvite | null> {
  const { rows } = await pool.query(`SELECT * FROM group_invites WHERE token = $1`, [token]);
  const row = rows[0] as GroupInviteRow | undefined;
  return row ? rowToGroupInvite(row) : null;
}

export async function deleteGroupInvite(id: string): Promise<void> {
  await pool.query(`DELETE FROM group_invites WHERE id = $1`, [id]);
}
