import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";
import type { ActiveRoundSummary } from "@dad-golf/shared";

export default function JoinRoundPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState("");
  const [activeRounds, setActiveRounds] = useState<ActiveRoundSummary[]>([]);

  useEffect(() => {
    const fromQuery = params.get("room");
    if (fromQuery) {
      nav(`/r/${fromQuery}`, { replace: true });
    }
  }, [params, nav]);

  useEffect(() => {
    if (user) {
      api
        .myActiveRounds()
        .then((res) => setActiveRounds(res.rounds))
        .catch(() => {});
    }
  }, [user]);

  function handleJoin() {
    if (!code.trim()) return;
    const clean = code.trim().toUpperCase();
    nav(`/r/${clean}`);
  }

  return (
    <div className="page">
      <h1>Join a round</h1>
      <div className="form">
        <label className="field">
          <span>Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="GOLF-XXXX"
            autoCapitalize="characters"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </label>
        <div className="form-actions">
          <Link to="/" className="btn">
            Cancel
          </Link>
          <button className="btn btn-primary" disabled={!code.trim()} onClick={handleJoin}>
            Join
          </button>
        </div>
      </div>

      {activeRounds.length > 0 && (
        <section className="section">
          <h2>Your active rounds</h2>
          <ul className="list">
            {activeRounds.map((r) => (
              <li key={r.roomCode}>
                <Link to={`/r/${r.roomCode}`} className="list-row">
                  <div>
                    <div className="list-primary">{r.courseName}</div>
                    <div className="list-secondary">
                      {r.roomCode} · {r.playerCount} player{r.playerCount !== 1 ? "s" : ""} ·{" "}
                      {r.status === "waiting" ? "Waiting" : "In progress"}
                    </div>
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
