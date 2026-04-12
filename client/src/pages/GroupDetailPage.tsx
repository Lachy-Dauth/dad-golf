import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { Group, GroupInvite, GroupMember, GroupRole } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myMember = user ? members.find((m) => m.userId === user.id) : null;
  const isAdmin = myMember?.role === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const load = useCallback(() => {
    if (!id) return;
    api
      .getGroup(id)
      .then((res) => {
        setGroup(res.group);
        setMembers(res.members);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const loadInvites = useCallback(() => {
    if (!id) return;
    api
      .listGroupInvites(id)
      .then((res) => setInvites(res.invites))
      .catch(() => {
        /* ignore: only admins can list invites */
      });
  }, [id]);

  useEffect(() => load(), [id, user?.id, load]);
  useEffect(() => {
    if (isAdmin) loadInvites();
    else setInvites([]);
  }, [isAdmin, id, loadInvites]);

  async function handleRemove(memberId: string) {
    if (!id) return;
    try {
      await api.removeGroupMember(id, memberId);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleChangeRole(memberId: string, role: GroupRole) {
    if (!id) return;
    try {
      await api.updateGroupMemberRole(id, memberId, role);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCreateInvite() {
    if (!id) return;
    try {
      await api.createGroupInvite(id);
      loadInvites();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!id) return;
    if (!confirm("Revoke this invite link?")) return;
    try {
      await api.deleteGroupInvite(id, inviteId);
      loadInvites();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function inviteUrl(token: string): string {
    return `${location.origin}/groups/join/${token}`;
  }

  if (!group) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{group.name}</h1>
        <span className="badge">{members.length}</span>
      </div>
      {myMember && (
        <p className="muted">Your role: {myMember.role === "admin" ? "Admin" : "Member"}</p>
      )}

      {isAdmin && (
        <section className="section">
          <div className="section-header">
            <h2>Invite links</h2>
            <button className="btn btn-primary" onClick={handleCreateInvite}>
              + New invite
            </button>
          </div>
          <p className="muted">Share an invite link so signed-in players can join the group.</p>
          {invites.length === 0 ? (
            <div className="muted">No active invites.</div>
          ) : (
            <ul className="list">
              {invites.map((inv) => (
                <li key={inv.id}>
                  <div className="list-row">
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      <div className="list-primary mono">{inviteUrl(inv.token)}</div>
                      <div className="list-secondary">
                        Created {new Date(inv.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="row-actions">
                      <button
                        className="btn"
                        onClick={() => navigator.clipboard?.writeText(inviteUrl(inv.token))}
                      >
                        Copy
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleRevokeInvite(inv.id)}
                        aria-label="Revoke"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && <div className="error">{error}</div>}

      <section className="section">
        <h2>Members</h2>
        {members.length === 0 ? (
          <div className="muted">No members yet.</div>
        ) : (
          <ul className="list">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={
                  isAdmin
                    ? !(m.role === "admin" && adminCount <= 1 && m.userId === user?.id)
                    : !!user && m.userId === user.id
                }
                canChangeRole={isAdmin && m.userId !== null}
                isLastAdmin={m.role === "admin" && adminCount <= 1}
                onRemove={() => handleRemove(m.id)}
                onChangeRole={(role) => handleChangeRole(m.id, role)}
              />
            ))}
          </ul>
        )}
      </section>

      <Link to="/groups" className="back-link">
        ← Back
      </Link>
    </div>
  );
}

function MemberRow({
  member,
  canRemove,
  canChangeRole,
  isLastAdmin,
  onRemove,
  onChangeRole,
}: {
  member: GroupMember;
  canRemove: boolean;
  canChangeRole: boolean;
  isLastAdmin: boolean;
  onRemove: () => void;
  onChangeRole: (role: GroupRole) => void;
}) {
  return (
    <li>
      <div className="list-row">
        <div>
          <div className="list-primary">
            {member.name}
            {member.role === "admin" && <span className="badge">admin</span>}
            {member.userId === null && <span className="badge">guest</span>}
          </div>
          <div className="list-secondary">GA HCP {member.handicap.toFixed(1)}</div>
        </div>
        <div className="row-actions">
          {canChangeRole && (
            <select
              value={member.role}
              onChange={(e) => onChangeRole(e.target.value as GroupRole)}
              disabled={isLastAdmin && member.role === "admin"}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {canRemove && (
            <button className="btn-icon" onClick={onRemove} aria-label="Remove">
              ✕
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
