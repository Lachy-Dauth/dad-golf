import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { Group, GroupMember } from "@dad-golf/shared";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newHandicap, setNewHandicap] = useState<number>(18);
  const [adding, setAdding] = useState(false);

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
  useEffect(() => load(), [id]);

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
  onRemove,
  onSave,
}: {
  member: GroupMember;
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
          <div className="list-primary">{member.name}</div>
          <div className="list-secondary">HCP {member.handicap}</div>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn-icon" onClick={onRemove} aria-label="Remove">
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
