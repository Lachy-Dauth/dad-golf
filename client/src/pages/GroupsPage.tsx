import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import type { Group, GroupMember } from "@dad-golf/shared";

export default function GroupsPage() {
  const [groups, setGroups] = useState<
    Array<Group & { members: GroupMember[] }> | null
  >(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    api
      .listGroups()
      .then((res) => setGroups(res.groups))
      .catch((e: Error) => setError(e.message));
  };
  useEffect(() => load(), []);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createGroup(name.trim());
      setName("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this group? Members will be removed.")) return;
    try {
      await api.deleteGroup(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <h1>Golf groups</h1>
      <p className="muted">
        Save your regular players as a group, then import them when starting a
        round. Up to 64 members per group.
      </p>

      <div className="form-inline">
        <input
          placeholder="New group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={creating || !name.trim()}
        >
          Create
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {!groups && <div className="muted">Loading…</div>}
      {groups && groups.length === 0 && (
        <div className="muted">No groups yet.</div>
      )}
      {groups && groups.length > 0 && (
        <ul className="list">
          {groups.map((g) => (
            <li key={g.id}>
              <div className="list-row">
                <Link to={`/groups/${g.id}`} className="list-link">
                  <div className="list-primary">{g.name}</div>
                  <div className="list-secondary">
                    {g.members.length}{" "}
                    {g.members.length === 1 ? "member" : "members"}
                  </div>
                </Link>
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(g.id)}
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link to="/" className="back-link">
        ← Back
      </Link>
    </div>
  );
}
