import { useState } from "react";
import type { RoundState, Tee, User } from "@dad-golf/shared";
import { calculateDailyHandicap, resolvePlayerTee, totalPar } from "@dad-golf/shared";
import { api } from "../api.js";

interface Props {
  state: RoundState;
  activePlayerId: string | null;
  viewer: User | null;
  isLeader: boolean;
  onSetActivePlayer: (id: string) => void;
  onJoinAsUser: (teeId?: string) => Promise<void>;
  onJoinAsGuest: (name: string, handicap: number, teeId?: string) => Promise<void>;
  onStart: () => Promise<void>;
  onRemovePlayer: (id: string) => Promise<void>;
  onStateUpdate: (state: RoundState) => void;
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
  onStateUpdate,
}: Props) {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState<string>("18.0");
  const [joinTeeId, setJoinTeeId] = useState<string>(state.course.defaultTeeId);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const players = state.players;
  const alreadyJoined = !!viewer && players.some((p) => p.userId === viewer.id);
  const tees = state.course.tees;
  const hasMultipleTees = tees.length > 1;

  async function handleJoinGuest() {
    if (!name.trim()) return;
    const n = Number(handicap);
    if (!Number.isFinite(n) || n < 0 || n > 54) {
      setError("Handicap must be a number between 0.0 and 54.0");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await onJoinAsGuest(name.trim(), Math.round(n * 10) / 10, joinTeeId);
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
      await onJoinAsUser(joinTeeId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function handleChangeTee(playerId: string, teeId: string) {
    setError(null);
    try {
      const res = await api.setPlayerTee(state.round.roomCode, playerId, teeId);
      onStateUpdate(res.state);
    } catch (e) {
      setError((e as Error).message);
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
                Joining as <strong>{viewer.displayName}</strong> (GA HCP{" "}
                {viewer.handicap.toFixed(1)})
              </div>
              {hasMultipleTees && (
                <TeeSelect tees={tees} value={joinTeeId} onChange={setJoinTeeId} />
              )}
              <button className="btn btn-primary" onClick={handleJoinUser} disabled={joining}>
                Join
              </button>
            </div>
          )
        ) : (
          <>
            <p className="muted">
              Join as a guest with no account, or log in to track your rounds.
            </p>
            <div className="form-inline">
              <input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={54}
                value={handicap}
                onChange={(e) => setHandicap(e.target.value)}
                placeholder="GA HCP"
                style={{ width: 96 }}
              />
              {hasMultipleTees && (
                <TeeSelect tees={tees} value={joinTeeId} onChange={setJoinTeeId} />
              )}
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
            <button className="btn btn-primary" onClick={onStart} disabled={players.length === 0}>
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
          <div className="muted">No one has joined yet. Share the room code above.</div>
        ) : (
          <ul className="player-grid">
            {players.map((p) => {
              const canRemove = isLeader || (viewer != null && p.userId === viewer.id);
              const canChangeTee = isLeader || (viewer != null && p.userId === viewer.id);
              const isLeaderPlayer = p.userId != null && p.userId === state.round.leaderUserId;
              const tee = resolvePlayerTee(state.course, p);
              const dh = calculateDailyHandicap(
                p.handicap,
                tee.slope,
                tee.rating,
                totalPar(state.course),
                p.gender,
                state.course.holes.length,
              );
              return (
                <li
                  key={p.id}
                  className={`player-card ${activePlayerId === p.id ? "me" : ""}`}
                  onClick={() => onSetActivePlayer(p.id)}
                >
                  <div className="player-name">
                    {p.name}
                    {isLeaderPlayer && <span className="badge">leader</span>}
                    {p.isGuest && <span className="badge">guest</span>}
                  </div>
                  <div className="player-hcp">
                    GA {p.handicap.toFixed(1)} · DH {dh}
                    {hasMultipleTees && <span className="muted"> · {tee.name}</span>}
                  </div>
                  {hasMultipleTees && canChangeTee && (
                    <div className="player-tee-picker" onClick={(e) => e.stopPropagation()}>
                      {tees.length <= 3 ? (
                        <div className="segmented">
                          {tees.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className={`segmented-btn ${p.teeId === t.id ? "active" : ""}`}
                              onClick={() => handleChangeTee(p.id, t.id)}
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <select
                          value={p.teeId}
                          onChange={(e) => handleChangeTee(p.id, e.target.value)}
                        >
                          {tees.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  {activePlayerId === p.id && <div className="player-me-badge">you</div>}
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

function TeeSelect({
  tees,
  value,
  onChange,
}: {
  tees: Tee[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {tees.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.rating.toFixed(1)}/{t.slope})
        </option>
      ))}
    </select>
  );
}
