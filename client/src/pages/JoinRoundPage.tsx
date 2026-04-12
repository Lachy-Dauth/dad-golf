import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function JoinRoundPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState("");

  useEffect(() => {
    const fromQuery = params.get("room");
    if (fromQuery) {
      nav(`/r/${fromQuery}`, { replace: true });
    }
  }, [params, nav]);

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
    </div>
  );
}
