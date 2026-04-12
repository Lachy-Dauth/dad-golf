import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";

interface CalendarEntry {
  id: string;
  name: string;
  primary: boolean;
}

export default function GoogleCalendarSection() {
  const { user, refreshProfile } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    api
      .googleCalendarAvailable()
      .then((res) => {
        setAvailable(res.available);
        if (res.available && user) {
          return api.googleCalendarStatus().then((status) => {
            setConnected(status.connected);
            setEmail(status.email);
            setCalendarId(status.calendarId);
            if (status.connected) {
              return api
                .googleCalendarCalendars()
                .then((c) => setCalendars(c.calendars))
                .catch(() => {});
            }
          });
        }
      })
      .catch(() => setAvailable(false))
      .finally(() => setLoading(false));
  }, [user]);

  // Handle ?google=connected redirect from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get("google");
    if (googleParam === "connected") {
      setSuccess("Google Calendar connected successfully!");
      refreshProfile();
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url.pathname);
    } else if (googleParam === "error") {
      setError("Failed to connect Google Calendar. Please try again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [refreshProfile]);

  if (loading || available === null || !available) return null;

  async function handleConnect() {
    setError(null);
    try {
      const res = await api.googleCalendarAuthUrl();
      window.location.href = res.url;
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Calendar? Events will no longer sync automatically.")) return;
    setDisconnecting(true);
    setError(null);
    try {
      await api.googleCalendarDisconnect();
      setConnected(false);
      setEmail(null);
      setCalendarId(null);
      setCalendars([]);
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleCalendarChange(newCalendarId: string) {
    setError(null);
    try {
      await api.googleCalendarUpdateSettings(newCalendarId);
      setCalendarId(newCalendarId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!connected) {
    return (
      <section className="section">
        <h2>Google Calendar</h2>
        <div className="gcal-section">
          <p className="muted">
            Automatically sync scheduled rounds to your Google Calendar when you RSVP.
          </p>
          {error && <div className="error">{error}</div>}
          {success && <div className="muted">{success}</div>}
          <button className="btn btn-primary" onClick={handleConnect}>
            Connect Google Calendar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>Google Calendar</h2>
      <div className="gcal-section">
        {success && <div className="muted">{success}</div>}
        {error && <div className="error">{error}</div>}
        <div className="gcal-status">
          <span className="gcal-connected-dot" />
          Connected as <strong>{email}</strong>
        </div>
        {calendars.length > 0 && (
          <label className="field">
            <span>Calendar</span>
            <select
              value={calendarId ?? "primary"}
              onChange={(e) => handleCalendarChange(e.target.value)}
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="btn" onClick={handleDisconnect} disabled={disconnecting}>
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    </section>
  );
}
