import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Group } from "@dad-golf/shared";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getInvite(token)
      .then((res) => {
        setGroup(res.group);
        setMemberCount(res.memberCount);
      })
      .catch((e) => setError((e as Error).message));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await api.acceptInvite(token);
      nav(`/groups/${res.group.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="page">
        <div className="error">{error}</div>
        <Link to="/" className="back-link">
          ← Home
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page">
        <div className="muted">Loading invite…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Join {group.name}</h1>
        <p className="muted">
          You've been invited to <strong>{group.name}</strong>
          {group.ownerName ? ` by ${group.ownerName}` : ""}. Log in or create
          an account to accept.
        </p>
        <div className="form-actions">
          <Link
            to={`/login?next=${encodeURIComponent(`/groups/join/${token}`)}`}
            className="btn btn-primary"
          >
            Log in to accept
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Join {group.name}</h1>
      <p className="muted">
        {memberCount} {memberCount === 1 ? "member" : "members"}
        {group.ownerName ? ` · owned by ${group.ownerName}` : ""}
      </p>
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <Link to="/" className="btn">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? "Joining…" : "Accept invite"}
        </button>
      </div>
    </div>
  );
}
