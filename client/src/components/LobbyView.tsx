import { useState } from "react";
import type { RoundState, User } from "@dad-golf/shared";

interface Props {
  state: RoundState;
  activePlayerId: string | null;
  viewer: User | null;
  isLeader: boolean;
  onSetActivePlayer: (id: string) => void;
  onJoinAsUser: () => Promise<void>;
  onJoinAsGuest: (name: string, handicap: number) => Promise<void>;
  onStart: () => Promise<void>;
  onRemovePlayer: (id: string) => Promise<void>;
}

export default function LobbyView({
  state,
  activePlayerId,
  viewer,
  isLeader,
  onSetActivePlayer,
  onJoinAsUser,
  onJoinAsGuest,
  onStart,
  onRemovePlayer,
}: Props) {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState<number>(18);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const players = state.players;
  const alreadyJoined =
    !!viewer && players.some((p) => p.userId === viewer.id);

  async function handleJoinGuest() {
    if (!name.trim()) return;
    setJoining(true);
    setError(null);
    try {
      await onJoinAsGuest(name.trim(), handicap);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function handleJoinUser() {
    setJoining(true);
    setError(null);
    try {
      await onJoinAsUser();
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
        {viewer ? (
          alreadyJoined ? (
            <div className="muted">You're already in this round.</div>
          ) : (
            <div className="form-inline">
              <div>
                Joining as <strong>{viewer.displayName}</strong> (HCP{" "}
                {viewer.handicap})
              </div>
              <button
                className="btn btn-primary"
                onClick={handleJoinUser}
                disabled={joining}
              >
                Join
              </button>
            </div>
          )
        ) : (
          <>
            <p className="muted">
              Join as a guest with no account, or sign in to track your rounds.
            </p>
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
                onClick={handleJoinGuest}
                disabled={joining || !name.trim()}
              >
                Join as guest
              </button>
            </div>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Players ({players.length})</h2>
          {isLeader ? (
            <button
              className="btn btn-primary"
              onClick={onStart}
              disabled={players.length === 0}
            >
              Start round
            </button>
          ) : (
            <span className="muted">
              {state.round.leaderName
                ? `Waiting for ${state.round.leaderName} to start`
                : "Waiting for leader"}
            </span>
          )}
        </div>

        {players.length === 0 ? (
          <div className="muted">
            No one has joined yet. Share the room code above.
          </div>
        ) : (
          <ul className="player-grid">
            {players.map((p) => {
              const canRemove =
                isLeader || (viewer != null && p.userId === viewer.id);
              const isLeaderPlayer =
                p.userId != null && p.userId === state.round.leaderUserId;
              return (
                <li
                  key={p.id}
                  className={`player-card ${activePlayerId === p.id ? "me" : ""}`}
                  onClick={() => onSetActivePlayer(p.id)}
                >
                  <div className="player-name">
                    {p.name}
                    {isLeaderPlayer && (
                      <span className="badge">leader</span>
                    )}
                    {p.isGuest && <span className="badge">guest</span>}
                  </div>
                  <div className="player-hcp">HCP {p.handicap}</div>
                  {activePlayerId === p.id && (
                    <div className="player-me-badge">you</div>
                  )}
                  {canRemove && (
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
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
