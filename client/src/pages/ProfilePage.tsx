import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.js";
import { useTheme } from "../ThemeContext.js";
import type { ThemePref } from "../localStore.js";

export default function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [handicap, setHandicap] = useState("18.0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pref: themePref, setPref: setThemePref } = useTheme();

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setHandicap(user.handicap.toFixed(1));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="muted">You are not logged in.</div>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const handicapNum = Number(handicap);
      if (!Number.isFinite(handicapNum) || handicapNum < 0 || handicapNum > 54) {
        throw new Error("Handicap must be a number between 0.0 and 54.0");
      }
      await updateProfile(displayName.trim(), Math.round(handicapNum * 10) / 10);
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
        Logged in as <strong>@{user.username}</strong>
      </p>

      <div className="form">
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="field">
          <span>Golf Australia handicap</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={54}
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            placeholder="e.g. 12.3"
          />
        </label>
        <Link to="/handicap" style={{ fontSize: 14, color: "var(--primary)" }}>
          Manage handicap tracker &rarr;
        </Link>
        {user.handicapAutoAdjust && (
          <div className="muted" style={{ fontSize: 13 }}>
            Your handicap is auto-calculated from recent rounds.
          </div>
        )}
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

      <div className="form theme-section">
        <label className="field">
          <span>Theme</span>
          <div className="segmented">
            {(["system", "light", "dark"] as ThemePref[]).map((opt) => (
              <button
                key={opt}
                className={themePref === opt ? "active" : ""}
                onClick={() => setThemePref(opt)}
              >
                {opt === "system" ? "System" : opt === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </label>
      </div>
      <Link to="/" className="back-link">
        ← Home
      </Link>
    </div>
  );
}
