import { Link } from "react-router-dom";
import { api } from "../api.js";
import type { UserScheduledRound } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";
import { useAsync } from "../hooks/useAsync.js";
import { formatDate, formatTime } from "../utils/dateFormat.js";

function rsvpLabel(status: string): string {
  if (status === "accepted") return "Going";
  if (status === "tentative") return "Maybe";
  return "Can't";
}

export default function UpcomingRoundsPage() {
  const { user } = useAuth();
  const { data: rounds, error } = useAsync<UserScheduledRound[]>(
    () => (user ? api.myScheduledRounds().then((res) => res.scheduledRounds) : Promise.resolve([])),
    [user],
  );

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
