import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { Group, GroupInvite, GroupMember } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newHandicap, setNewHandicap] = useState<number>(18);
  const [adding, setAdding] = useState(false);

  const isOwner = !!(user && group && group.ownerUserId === user.id);

  const load = () => {
    if (!id) return;
    api
      .getGroup(id)
      .then((res) => {
        setGroup(res.group);
        setMembers(res.members);
      })
      .catch((e: Error) => setError(e.message));
  };

  const loadInvites = () => {
    if (!id) return;
    api
      .listGroupInvites(id)
      .then((res) => setInvites(res.invites))
      .catch(() => {
        /* ignore: only owner can list invites */
      });
  };

  useEffect(() => load(), [id, user?.id]);
  useEffect(() => {
    if (isOwner) loadInvites();
    else setInvites([]);
  }, [isOwner, id]);

  async function handleAdd() {
    if (!id || !newName.trim()) return;
    setAdding(true);
    try {
      await api.addGroupMember(id, newName.trim(), newHandicap);
      setNewName("");
      setNewHandicap(18);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!id) return;
    try {
      await api.removeGroupMember(id, memberId);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUpdate(m: GroupMember, name: string, handicap: number) {
    if (!id) return;
    try {
      await api.updateGroupMember(id, m.id, name, handicap);
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
      <p className="muted">
        {group.ownerName ? `Owned by ${group.ownerName}` : "No owner"}
      </p>

      {isOwner && (
        <section className="section">
          <h2>Add member</h2>
          <div className="form-inline">
            <input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="number"
              min={0}
              max={54}
              placeholder="HCP"
              value={newHandicap}
              onChange={(e) => setNewHandicap(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
            >
              Add
            </button>
          </div>
        </section>
      )}

      {isOwner && (
        <section className="section">
          <div className="section-header">
            <h2>Invite links</h2>
            <button className="btn btn-primary" onClick={handleCreateInvite}>
              + New invite
            </button>
          </div>
          <p className="muted">
            Share an invite link so signed-in players can join the group.
          </p>
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
                        onClick={() =>
                          navigator.clipboard?.writeText(inviteUrl(inv.token))
                        }
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
                canEdit={isOwner || (!!user && m.userId === user.id)}
                canRemove={
                  isOwner ? m.userId !== group.ownerUserId : !!user && m.userId === user.id
                }
                onRemove={() => handleRemove(m.id)}
                onSave={(name, h) => handleUpdate(m, name, h)}
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
  canEdit,
  canRemove,
  onRemove,
  onSave,
}: {
  member: GroupMember;
  canEdit: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onSave: (name: string, handicap: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [handicap, setHandicap] = useState(member.handicap);

  if (editing) {
    return (
      <li>
        <div className="list-row">
          <div className="edit-row">
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <input
              type="number"
              min={0}
              max={54}
              value={handicap}
              onChange={(e) => setHandicap(Number(e.target.value))}
              style={{ width: 70 }}
            />
          </div>
          <div className="row-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave(name.trim(), handicap);
                setEditing(false);
              }}
            >
              Save
            </button>
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="list-row">
        <div>
          <div className="list-primary">
            {member.name}
            {member.userId === null && <span className="badge">guest</span>}
          </div>
          <div className="list-secondary">HCP {member.handicap}</div>
        </div>
        <div className="row-actions">
          {canEdit && (
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
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
