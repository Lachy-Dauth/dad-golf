import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { GroupMember, RsvpStatus, ScheduledRound, ScheduledRoundRsvp } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";
import { addRecentRound } from "../localStore.js";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${h}h ${m}m`;
}

function RsvpSection({
  label,
  rsvps,
  className,
}: {
  label: string;
  rsvps: ScheduledRoundRsvp[];
  className: string;
}) {
  const [open, setOpen] = useState(false);

  if (rsvps.length === 0) return null;

  return (
    <div className="rsvp-section">
      <button className={`rsvp-section-header ${className}`} onClick={() => setOpen(!open)}>
        <span>
          {label} ({rsvps.length})
        </span>
        <span className="rsvp-chevron">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <ul className="rsvp-section-list">
          {rsvps.map((r) => (
            <li key={r.id}>{r.userName}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScheduledRoundPage() {
  const { groupId, id } = useParams<{ groupId: string; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sr, setSr] = useState<ScheduledRound | null>(null);
  const [rsvps, setRsvps] = useState<ScheduledRoundRsvp[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myMember = user ? members.find((m) => m.userId === user.id) : null;
  const isAdmin = myMember?.role === "admin";

  const load = useCallback(() => {
    if (!groupId || !id) return;
    api
      .getScheduledRound(groupId, id)
      .then((res) => {
        setSr(res.scheduledRound);
        setRsvps(res.rsvps);
      })
      .catch((e: Error) => setError(e.message));
    api
      .getGroup(groupId)
      .then((res) => setMembers(res.members))
      .catch(() => {});
  }, [groupId, id]);

  useEffect(() => load(), [load]);

  const myRsvp = user ? rsvps.find((r) => r.userId === user.id) : null;
  const accepted = rsvps.filter((r) => r.status === "accepted");
  const tentative = rsvps.filter((r) => r.status === "tentative");
  const declined = rsvps.filter((r) => r.status === "declined");

  async function handleRsvp(status: RsvpStatus) {
    if (!groupId || !id) return;
    try {
      await api.rsvpScheduledRound(groupId, id, status);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleStart() {
    if (!groupId || !id || !sr) return;
    if (!confirm("Start this round now? All accepted players will be added.")) return;
    try {
      const res = await api.startScheduledRound(groupId, id);
      addRecentRound({
        roomCode: res.state.round.roomCode,
        courseName: sr.courseName,
        joinedAt: new Date().toISOString(),
      });
      navigate(`/r/${res.state.round.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCancel() {
    if (!groupId || !id) return;
    if (!confirm("Cancel this scheduled round?")) return;
    try {
      await api.cancelScheduledRound(groupId, id);
      navigate(`/groups/${groupId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!sr) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{sr.courseName}</h1>

      <section className="section">
        <div className="sr-detail-row">
          <span className="sr-detail-label">Date</span>
          <span>{formatDate(sr.scheduledDate)}</span>
        </div>
        {sr.scheduledTime && (
          <div className="sr-detail-row">
            <span className="sr-detail-label">Time</span>
            <span>{formatTime(sr.scheduledTime)}</span>
          </div>
        )}
        {sr.durationMinutes && (
          <div className="sr-detail-row">
            <span className="sr-detail-label">Duration</span>
            <span>{formatDuration(sr.durationMinutes)}</span>
          </div>
        )}
        {sr.notes && (
          <div className="sr-detail-row">
            <span className="sr-detail-label">Notes</span>
            <span>{sr.notes}</span>
          </div>
        )}
        <div className="sr-detail-row">
          <span className="sr-detail-label">Scheduled by</span>
          <span>{sr.createdByName}</span>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {sr.status === "scheduled" && user && (
        <section className="section">
          <h2>Your RSVP</h2>
          <div className="rsvp-buttons">
            <button
              className={`btn-sm${myRsvp?.status === "accepted" ? " btn-primary" : ""}`}
              onClick={() => handleRsvp("accepted")}
            >
              Going
            </button>
            <button
              className={`btn-sm${myRsvp?.status === "tentative" ? " btn-primary" : ""}`}
              onClick={() => handleRsvp("tentative")}
            >
              Maybe
            </button>
            <button
              className={`btn-sm${myRsvp?.status === "declined" ? " btn-primary" : ""}`}
              onClick={() => handleRsvp("declined")}
            >
              Can't
            </button>
          </div>
        </section>
      )}

      <section className="section">
        <h2>Responses</h2>
        {rsvps.length === 0 ? (
          <div className="muted">No responses yet.</div>
        ) : (
          <div className="rsvp-sections">
            <RsvpSection label="Going" rsvps={accepted} className="rsvp-accepted" />
            <RsvpSection label="Maybe" rsvps={tentative} className="rsvp-tentative" />
            <RsvpSection label="Can't make it" rsvps={declined} className="rsvp-declined" />
          </div>
        )}
      </section>

      {isAdmin && sr.status === "scheduled" && (
        <section className="section">
          <h2>Admin</h2>
          <div className="scheduled-round-admin-actions">
            <button className="btn btn-primary" onClick={handleStart}>
              Start round
            </button>
            <button className="btn" onClick={handleCancel}>
              Cancel round
            </button>
          </div>
        </section>
      )}

      {sr.status === "started" && sr.roomCode && (
        <section className="section">
          <div className="started-round-banner">
            <span className="badge badge-active">Round started</span>
            <Link to={`/r/${sr.roomCode}`} className="btn btn-primary">
              Join round
            </Link>
          </div>
        </section>
      )}

      <Link to={`/groups/${groupId}`} className="back-link">
        ← Back to group
      </Link>
    </div>
  );
}
