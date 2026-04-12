import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";
import type { RoundSummary } from "@dad-golf/shared";

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

export default function RoundsPage() {
  const { user, loading } = useAuth();
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    setFetching(true);
    api
      .listMyRounds(20, offset)
      .then((res) => {
        setRounds((prev) => (offset === 0 ? res.rounds : [...prev, ...res.rounds]));
        setTotal(res.total);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setFetching(false));
  }, [user, loading, offset]);

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>My Rounds</h1>
        <p className="muted">
          <Link to="/login">Log in</Link> to see your round history.
        </p>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>My Rounds</h1>
      {error && <div className="error">{error}</div>}

      {!fetching && rounds.length === 0 && (
        <div className="muted">No completed rounds yet. Start your first round!</div>
      )}

      {rounds.length > 0 && (
        <ul className="list">
          {rounds.map((r) => (
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

      {rounds.length < total && (
        <div className="form-actions">
          <button className="btn" onClick={() => setOffset((o) => o + 20)} disabled={fetching}>
            {fetching ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      <Link to="/" className="back-link">
        &larr; Home
      </Link>
    </div>
  );
}
