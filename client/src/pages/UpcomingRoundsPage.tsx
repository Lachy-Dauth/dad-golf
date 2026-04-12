import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import type { UserScheduledRound } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";

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

export default function UpcomingRoundsPage() {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<UserScheduledRound[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      api
        .myScheduledRounds()
        .then((res) => setRounds(res.scheduledRounds))
        .catch((e: Error) => setError(e.message));
    }
  }, [user]);

  return (
    <div className="page">
      <h1>Upcoming rounds</h1>
      <p className="muted">Scheduled rounds across all your groups.</p>

      {!user && (
        <div className="muted">
          <Link to="/login">Log in</Link> to see your upcoming rounds.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {user && !rounds && <div className="muted">Loading…</div>}
      {rounds && rounds.length === 0 && (
        <div className="muted">No upcoming rounds. Check your groups to RSVP to a round.</div>
      )}
      {rounds && rounds.length > 0 && (
        <ul className="list">
          {rounds.map((sr) => (
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
                <span className="badge">
                  {sr.rsvpStatus ? rsvpLabel(sr.rsvpStatus) : "No RSVP"}
                </span>
              </Link>
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
