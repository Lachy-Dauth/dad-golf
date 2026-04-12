import { Link, useNavigate } from "react-router-dom";
import type { ScheduledRound, ScheduledRoundRsvp } from "@dad-golf/shared";
import { icsDownloadUrl } from "../calendarLinks.js";

interface Props {
  scheduledRound: ScheduledRound;
  rsvps: ScheduledRoundRsvp[];
  currentUserId: string | null;
}

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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ScheduledRoundCard({ scheduledRound: sr, rsvps, currentUserId }: Props) {
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
          {sr.status === "scheduled" && (
            <button
              className="calendar-icon-btn"
              title="Download .ics"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = icsDownloadUrl(sr.groupId, sr.id);
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
