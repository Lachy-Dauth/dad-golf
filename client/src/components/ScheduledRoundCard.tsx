import { Link, useNavigate } from "react-router-dom";
import type { ScheduledRound, ScheduledRoundRsvp } from "@dad-golf/shared";
import { downloadIcsFile } from "../calendarLinks.js";
import { formatDate, formatTime, formatDuration } from "../utils/dateFormat.js";

interface Props {
  scheduledRound: ScheduledRound;
  rsvps: ScheduledRoundRsvp[];
  currentUserId: string | null;
  googleCalendarConnected?: boolean;
}

export default function ScheduledRoundCard({
  scheduledRound: sr,
  rsvps,
  currentUserId,
  googleCalendarConnected,
}: Props) {
  const navigate = useNavigate();
  const accepted = rsvps.filter((r) => r.status === "accepted").length;
  const tentative = rsvps.filter((r) => r.status === "tentative").length;
  const declined = rsvps.filter((r) => r.status === "declined").length;
  const myRsvp = currentUserId ? rsvps.find((r) => r.userId === currentUserId) : null;

  return (
    <Link
      to={`/groups/${sr.groupId}/schedule/${sr.id}`}
      className="scheduled-round-card"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="scheduled-round-header">
        <div>
          <div className="list-primary">{sr.courseName}</div>
          <div className="list-secondary">
            {formatDate(sr.scheduledDate)}
            {sr.scheduledTime && ` at ${formatTime(sr.scheduledTime)}`}
            {sr.durationMinutes && ` · ${formatDuration(sr.durationMinutes)}`}
          </div>
        </div>
        <div className="rsvp-summary">
          {sr.status === "scheduled" && !googleCalendarConnected && currentUserId && (
            <button
              className="calendar-icon-btn"
              title="Download .ics"
              aria-label="Download calendar file"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                downloadIcsFile(sr.groupId, sr.id).catch(() => {});
              }}
            >
              {"\uD83D\uDCC5"}
            </button>
          )}
          {sr.status === "started" && sr.roomCode ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/r/${sr.roomCode}`);
              }}
            >
              Join round
            </button>
          ) : (
            <>
              {accepted > 0 && <span className="rsvp-count rsvp-accepted">{accepted}</span>}
              {tentative > 0 && <span className="rsvp-count rsvp-tentative">{tentative}</span>}
              {declined > 0 && <span className="rsvp-count rsvp-declined">{declined}</span>}
              {myRsvp && (
                <span className="badge">
                  {myRsvp.status === "accepted"
                    ? "Going"
                    : myRsvp.status === "tentative"
                      ? "Maybe"
                      : "Can't"}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
