import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.js";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handicap, setHandicap] = useState(18);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next =
    new URLSearchParams(loc.search).get("next") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signIn(username.trim(), password);
      } else {
        await signUp({
          username: username.trim(),
          password,
          displayName: displayName.trim() || username.trim(),
          handicap,
        });
      }
      nav(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <p className="muted">
        Stableford keeps your courses, groups and rounds tied to your account.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete={mode === "signin" ? "username" : "new-username"}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            required
          />
        </label>
        {mode === "signup" && (
          <>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Shown to other players"
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
          </>
        )}
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <Link to="/" className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </div>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        {mode === "signin" ? (
          <>
            New to Stableford?{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode("signup")}
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
