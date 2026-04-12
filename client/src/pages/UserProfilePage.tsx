import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { BADGE_DEFINITIONS } from "@dad-golf/shared";
import type { PublicUserProfile } from "@dad-golf/shared";
import BadgeIcon from "../components/BadgeIcon.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    api
      .getUserProfile(username)
      .then((res) => setProfile(res.profile))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page">
        <h1>Profile</h1>
        <div className="error">{error ?? "User not found"}</div>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  const earnedBadgeIds = new Set(profile.badges.map((b) => b.badgeId));
  const earnedCount = profile.badges.length;

  const initials = profile.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-avatar-lg">{initials}</div>
        <h1>{profile.displayName}</h1>
        <p className="muted">
          @{profile.username} &middot; Handicap {profile.handicap.toFixed(1)}
        </p>
        <p className="muted">Member since {formatDate(profile.createdAt)}</p>
      </div>

      <h2>
        Badges ({earnedCount} of {BADGE_DEFINITIONS.length})
      </h2>
      <div className="badge-grid">
        {BADGE_DEFINITIONS.map((badge) => {
          const earned = profile.badges.find((b) => b.badgeId === badge.id);
          return (
            <BadgeIcon
              key={badge.id}
              badge={badge}
              earned={earnedBadgeIds.has(badge.id)}
              earnedAt={earned?.earnedAt}
            />
          );
        })}
      </div>

      <h2>Recent Rounds ({profile.totalRounds} total)</h2>
      {profile.recentRounds.length === 0 ? (
        <div className="muted">No rounds yet.</div>
      ) : (
        <ul className="list">
          {profile.recentRounds.map((r) => (
            <li key={r.roomCode}>
              <Link to={`/r/${r.roomCode}`} className="list-row">
                <div>
                  <div className="list-primary">{r.courseName}</div>
                  <div className="list-secondary">
                    {formatDate(r.date)} &middot; {r.playerCount} player
                    {r.playerCount !== 1 ? "s" : ""}
                    {r.viewerPosition != null && (
                      <>
                        {" "}
                        &middot; {ordinal(r.viewerPosition)} &middot; {r.viewerPoints} pts
                      </>
                    )}
                    {r.winnerName && r.viewerPosition !== 1 && <> &middot; Won by {r.winnerName}</>}
                  </div>
                </div>
                <span className="chevron">&rsaquo;</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/" className="back-link">
        &larr; Home
      </Link>
    </div>
  );
}
