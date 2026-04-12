import type { RsvpStatus, ScheduledRound, ScheduledRoundRsvp } from "@dad-golf/shared";

interface Props {
  scheduledRound: ScheduledRound;
  rsvps: ScheduledRoundRsvp[];
  currentUserId: string | null;
  isAdmin: boolean;
  onRsvp: (status: RsvpStatus) => void;
  onStart: () => void;
  onCancel: () => void;
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

export default function ScheduledRoundCard({
  scheduledRound: sr,
  rsvps,
  currentUserId,
  isAdmin,
  onRsvp,
  onStart,
  onCancel,
}: Props) {
  const accepted = rsvps.filter((r) => r.status === "accepted");
  const tentative = rsvps.filter((r) => r.status === "tentative");
  const declined = rsvps.filter((r) => r.status === "declined");
  const myRsvp = currentUserId ? rsvps.find((r) => r.userId === currentUserId) : null;

  return (
    <div className="scheduled-round-card">
      <div className="scheduled-round-header">
        <div>
          <div className="list-primary">{sr.courseName}</div>
          <div className="list-secondary">
            {formatDate(sr.scheduledDate)}
            {sr.scheduledTime && ` at ${formatTime(sr.scheduledTime)}`}
            {sr.durationMinutes && ` · ${formatDuration(sr.durationMinutes)}`}
          </div>
          {sr.notes && <div className="list-secondary">{sr.notes}</div>}
        </div>
      </div>

      <div className="rsvp-summary">
        {accepted.length > 0 && (
          <span className="rsvp-count rsvp-accepted">{accepted.length} going</span>
        )}
        {tentative.length > 0 && (
          <span className="rsvp-count rsvp-tentative">{tentative.length} maybe</span>
        )}
        {declined.length > 0 && (
          <span className="rsvp-count rsvp-declined">{declined.length} can't</span>
        )}
        {rsvps.length === 0 && <span className="muted">No responses yet</span>}
      </div>

      {rsvps.length > 0 && (
        <div className="rsvp-names muted">
          {accepted.map((r) => r.userName).join(", ")}
          {accepted.length > 0 && tentative.length > 0 ? " | " : ""}
          {tentative.length > 0 && `Maybe: ${tentative.map((r) => r.userName).join(", ")}`}
        </div>
      )}

      <div className="scheduled-round-actions-row">
        {currentUserId && (
          <div className="rsvp-buttons">
            <button
              className={`btn-sm${myRsvp?.status === "accepted" ? " btn-primary" : ""}`}
              onClick={() => onRsvp("accepted")}
            >
              Going
            </button>
            <button
              className={`btn-sm${myRsvp?.status === "tentative" ? " btn-primary" : ""}`}
              onClick={() => onRsvp("tentative")}
            >
              Maybe
            </button>
            <button
              className={`btn-sm${myRsvp?.status === "declined" ? " btn-primary" : ""}`}
              onClick={() => onRsvp("declined")}
            >
              Can't
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="scheduled-round-admin-actions">
            <button className="btn-sm btn-primary" onClick={onStart}>
              Start round
            </button>
            <button className="btn-sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
