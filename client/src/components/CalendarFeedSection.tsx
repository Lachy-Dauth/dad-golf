import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";

export default function CalendarFeedSection() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .calendarFeedStatus()
      .then((res) => {
        setEnabled(res.enabled);
        setUrl(res.url);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !user) return null;

  async function handleEnable() {
    setError(null);
    try {
      const res = await api.calendarFeedEnable();
      setEnabled(true);
      setUrl(res.url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDisable() {
    if (!confirm("Disable calendar feed? Apps subscribed to this URL will stop receiving updates."))
      return;
    setError(null);
    try {
      await api.calendarFeedDisable();
      setEnabled(false);
      setUrl(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function webcalUrl(): string {
    if (!url) return "";
    return url.replace(/^https?:\/\//, "webcal://");
  }

  if (!enabled) {
    return (
      <section className="section">
        <h2>Calendar Feed</h2>
        <div className="gcal-section">
          <p className="muted">
            Subscribe to your upcoming rounds in any calendar app. The feed updates automatically
            when rounds are added, changed, or cancelled.
          </p>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" onClick={handleEnable}>
            Enable Calendar Feed
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>Calendar Feed</h2>
      <div className="gcal-section">
        <p className="muted">Add this URL to your calendar app to auto-sync upcoming rounds.</p>
        {error && <div className="error">{error}</div>}
        <div className="feed-url-row">
          <input className="feed-url-input" type="text" value={url ?? ""} readOnly />
          <button className="btn" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="feed-actions">
          <a className="btn btn-primary" href={webcalUrl()}>
            Subscribe
          </a>
          <button className="btn" onClick={handleDisable}>
            Disable
          </button>
        </div>
      </div>
    </section>
  );
}
