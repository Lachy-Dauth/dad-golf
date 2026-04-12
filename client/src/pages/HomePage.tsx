import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentRounds } from "../localStore.js";
import { useAuth } from "../AuthContext.js";
import { api } from "../api.js";
import type { UserScheduledRound } from "@dad-golf/shared";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m}${suffix}`;
}

function rsvpLabel(status: string): string {
  if (status === "accepted") return "Going";
  if (status === "tentative") return "Maybe";
  return "Can't";
}

export default function HomePage() {
  const { user } = useAuth();
  const recent = getRecentRounds();
  const [upcoming, setUpcoming] = useState<UserScheduledRound[]>([]);

  useEffect(() => {
    if (user) {
      api
        .myScheduledRounds()
        .then((res) => setUpcoming(res.scheduledRounds))
        .catch(() => {});
    }
  }, [user]);

  return (
    <div className="page">
      <div className="hero">
        <h1>Stableford scoring for casual rounds</h1>
        <p className="muted">
          Up to 32 players per round. Everyone scores on their own phone, the leaderboard updates
          live.
        </p>
      </div>

      <div className="action-grid">
        <Link to="/rounds/new" className="action-tile primary">
          <span className="action-icon">⛳</span>
          <span className="action-label">Start a round</span>
          <span className="action-sub">Pick a course and get a room code</span>
        </Link>
        <Link to="/join" className="action-tile">
          <span className="action-icon">🔑</span>
          <span className="action-label">Join a round</span>
          <span className="action-sub">Enter a room code</span>
        </Link>
        <Link to="/courses" className="action-tile">
          <span className="action-icon">🗺️</span>
          <span className="action-label">Courses</span>
          <span className="action-sub">Manage saved courses</span>
        </Link>
        <Link to="/groups" className="action-tile">
          <span className="action-icon">👥</span>
          <span className="action-label">Golf groups</span>
          <span className="action-sub">Save your regulars</span>
        </Link>
      </div>

      <div className="home-footer">
        <Link to="/help" className="help-link">
          How to use Stableford →
        </Link>
      </div>

      {upcoming.length > 0 && (
        <section className="section">
          <h2>Upcoming rounds</h2>
          <ul className="list">
            {upcoming.map((sr) => (
              <li key={sr.id}>
                <Link to={`/groups/${sr.groupId}/schedule/${sr.id}`} className="list-row">
                  <div>
                    <div className="list-primary">{sr.courseName}</div>
                    <div className="list-secondary">
                      {formatDate(sr.scheduledDate)}
                      {sr.scheduledTime && ` at ${formatTime(sr.scheduledTime)}`}
                      {" · "}
                      {sr.groupName}
                    </div>
                  </div>
                  <span className="badge">{rsvpLabel(sr.rsvpStatus)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <h2>Recent rounds on this device</h2>
          <ul className="list">
            {recent.map((r) => (
              <li key={r.roomCode}>
                <Link to={`/r/${r.roomCode}`} className="list-row">
                  <div>
                    <div className="list-primary">{r.courseName}</div>
                    <div className="list-secondary">{r.roomCode}</div>
                  </div>
                  <span className="chevron">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
