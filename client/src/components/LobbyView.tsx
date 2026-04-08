import { useState } from "react";
import type { RoundState } from "@dad-golf/shared";

interface Props {
  state: RoundState;
  activePlayerId: string | null;
  onSetActivePlayer: (id: string) => void;
  onJoin: (name: string, handicap: number) => Promise<void>;
  onStart: () => Promise<void>;
  onRemovePlayer: (id: string) => Promise<void>;
}

export default function LobbyView({
  state,
  activePlayerId,
  onSetActivePlayer,
  onJoin,
  onStart,
  onRemovePlayer,
}: Props) {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState<number>(18);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const players = state.players;

  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    setError(null);
    try {
      await onJoin(name.trim(), handicap);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div>
      <section className="section">
        <h2>Join this round</h2>
        <div className="form-inline">
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            min={0}
            max={54}
            value={handicap}
            onChange={(e) => setHandicap(Number(e.target.value))}
            placeholder="HCP"
            style={{ width: 80 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={joining || !name.trim()}
          >
            Join
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Players ({players.length})</h2>
          <button
            className="btn btn-primary"
            onClick={onStart}
            disabled={players.length === 0}
          >
            Start round
          </button>
        </div>

        {players.length === 0 ? (
          <div className="muted">
            No one has joined yet. Share the room code above.
          </div>
        ) : (
          <ul className="player-grid">
            {players.map((p) => (
              <li
                key={p.id}
                className={`player-card ${activePlayerId === p.id ? "me" : ""}`}
                onClick={() => onSetActivePlayer(p.id)}
              >
                <div className="player-name">{p.name}</div>
                <div className="player-hcp">HCP {p.handicap}</div>
                {activePlayerId === p.id && (
                  <div className="player-me-badge">you</div>
                )}
                <button
                  className="btn-icon remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(p.id);
                  }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
