import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.js";
import { useTheme } from "../ThemeContext.js";
import type { ThemePref } from "../localStore.js";
import type { ActivityVisibility, UserBadge } from "@dad-golf/shared";
import { BADGE_DEFINITIONS } from "@dad-golf/shared";
import { api } from "../api.js";
import BadgeIcon from "../components/BadgeIcon.js";
import GoogleCalendarSection from "../components/GoogleCalendarSection.js";
import CalendarFeedSection from "../components/CalendarFeedSection.js";

export default function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [handicap, setHandicap] = useState("18.0");
  const [activityVis, setActivityVis] = useState<ActivityVisibility>("group");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pref: themePref, setPref: setThemePref } = useTheme();
  const [badges, setBadges] = useState<UserBadge[]>([]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setHandicap(user.handicap.toFixed(1));
      setActivityVis(user.activityVisibility);
      api.getUserBadges(user.username).then((res) => setBadges(res.badges)).catch(() => {});
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
      await updateProfile(displayName.trim(), Math.round(handicapNum * 10) / 10, activityVis);
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
        <label className="field">
          <span>Activity sharing</span>
          <div className="segmented">
            {(["none", "group"] as ActivityVisibility[]).map((opt) => (
              <button
                key={opt}
                className={activityVis === opt ? "active" : ""}
                onClick={() => setActivityVis(opt)}
              >
                {opt === "none" ? "Private" : "In group"}
              </button>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {activityVis === "none" && "Your activity won't appear in anyone's feed."}
            {activityVis === "group" &&
              "Activity visible to members of the group it belongs to."}
          </span>
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

      <div className="section">
        <h2>
          Badges ({badges.length} of {BADGE_DEFINITIONS.length})
        </h2>
        <div className="badge-grid">
          {BADGE_DEFINITIONS.map((badge) => {
            const earned = badges.find((b) => b.badgeId === badge.id);
            return (
              <BadgeIcon
                key={badge.id}
                badge={badge}
                earned={!!earned}
                earnedAt={earned?.earnedAt}
              />
            );
          })}
        </div>
        <Link to={`/user/${user.username}`} style={{ fontSize: 14, color: "var(--primary)" }}>
          View public profile &rarr;
        </Link>
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

      <GoogleCalendarSection />
      <CalendarFeedSection />

      <Link to="/" className="back-link">
        ← Home
      </Link>
    </div>
  );
}
