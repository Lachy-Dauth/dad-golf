import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.js";

export default function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [handicap, setHandicap] = useState(18);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setHandicap(user.handicap);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="muted">You are not signed in.</div>
        <Link to="/login" className="btn btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await updateProfile(displayName.trim(), handicap);
      setMsg("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    nav("/", { replace: true });
  }

  return (
    <div className="page">
      <h1>Your profile</h1>
      <p className="muted">
        Signed in as <strong>@{user.username}</strong>
      </p>

      <div className="form">
        <label className="field">
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Handicap</span>
          <input
            type="number"
            min={0}
            max={54}
            value={handicap}
            onChange={(e) => setHandicap(Number(e.target.value))}
          />
        </label>
        {error && <div className="error">{error}</div>}
        {msg && <div className="muted">{msg}</div>}
        <div className="form-actions">
          <button className="btn" onClick={handleSignOut}>
            Sign out
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={busy || !displayName.trim()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <Link to="/" className="back-link">
        ← Home
      </Link>
    </div>
  );
}
