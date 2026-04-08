import { useState } from "react";
import type { Player, RoundState, User } from "@dad-golf/shared";
import {
  calculateDailyHandicap,
  stablefordPoints,
  strokesReceived,
  computePlayerHoles,
} from "@dad-golf/shared";

interface Props {
  state: RoundState;
  activePlayer: Player | null;
  viewer: User | null;
  onSelectPlayer: (id: string) => void;
  onJoinAsUser: () => Promise<void>;
  onJoinAsGuest: (name: string, handicap: number) => Promise<void>;
  onScore: (holeNumber: number, strokes: number) => Promise<void>;
  onClearScore: (holeNumber: number) => Promise<void>;
  onSetCurrentHole: (holeNumber: number) => Promise<void>;
}

export default function ScoringView({
  state,
  activePlayer,
  viewer,
  onSelectPlayer,
  onJoinAsUser,
  onJoinAsGuest,
  onScore,
  onClearScore,
  onSetCurrentHole,
}: Props) {
  const [currentHole, setCurrentHole] = useState<number>(
    state.round.currentHole,
  );
  const [submitting, setSubmitting] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinHcp, setJoinHcp] = useState("18.0");

  const hole = state.course.holes.find((h) => h.number === currentHole);
  if (!hole) return <div className="muted">Invalid hole</div>;

  function goHole(n: number) {
    if (n < 1 || n > state.course.holes.length) return;
    setCurrentHole(n);
    // Persist current hole to server (nice to broadcast but not required)
    onSetCurrentHole(n).catch(() => {});
  }

  function joinControls() {
    if (viewer) {
      return (
        <div className="form-inline">
          <div>
            Join as <strong>{viewer.displayName}</strong> (GA HCP{" "}
            {viewer.handicap.toFixed(1)})
          </div>
          <button className="btn btn-primary" onClick={onJoinAsUser}>
            Join
          </button>
        </div>
      );
    }
    return (
      <div className="form-inline">
        <input
          placeholder="Your name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={0}
          max={54}
          value={joinHcp}
          onChange={(e) => setJoinHcp(e.target.value)}
          placeholder="GA HCP"
          style={{ width: 96 }}
        />
        <button
          className="btn btn-primary"
          disabled={!joinName.trim()}
          onClick={() => {
            const n = Number(joinHcp);
            if (!Number.isFinite(n) || n < 0 || n > 54) return;
            onJoinAsGuest(joinName.trim(), Math.round(n * 10) / 10);
          }}
        >
          Join as guest
        </button>
      </div>
    );
  }

  if (state.players.length === 0) {
    return (
      <section className="section">
        <h2>No players yet</h2>
        <p className="muted">Add yourself to start scoring.</p>
        {joinControls()}
      </section>
    );
  }

  if (!activePlayer) {
    return (
      <section className="section">
        <h2>Who are you?</h2>
        <p className="muted">Tap your name to score on this device.</p>
        <ul className="player-grid">
          {state.players.map((p) => {
            const dh = calculateDailyHandicap(p.handicap, state.course.slope);
            return (
              <li
                key={p.id}
                className="player-card"
                onClick={() => onSelectPlayer(p.id)}
              >
                <div className="player-name">{p.name}</div>
                <div className="player-hcp">
                  GA {p.handicap.toFixed(1)} · DH {dh}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="section">
          <h3>Or join as a new player</h3>
          {joinControls()}
        </div>
      </section>
    );
  }

  const dailyHandicap = calculateDailyHandicap(
    activePlayer.handicap,
    state.course.slope,
  );
  const holes = computePlayerHoles(state.course, activePlayer, state.scores);
  const holeResult = holes.find((h) => h.holeNumber === currentHole);
  const currentStrokes = holeResult?.strokes ?? null;
  const received = strokesReceived(dailyHandicap, hole.strokeIndex);

  async function handleStrokes(n: number) {
    setSubmitting(true);
    try {
      await onScore(currentHole, n);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    setSubmitting(true);
    try {
      await onClearScore(currentHole);
    } finally {
      setSubmitting(false);
    }
  }

  const choices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const totalPoints = holes.reduce((s, h) => s + h.points, 0);
  const played = holes.filter((h) => h.strokes != null).length;

  return (
    <div>
      <div className="scoring-player">
        <div>
          <div className="scoring-name">{activePlayer.name}</div>
          <div className="scoring-sub">
            GA {activePlayer.handicap.toFixed(1)} · DH {dailyHandicap} ·{" "}
            {played}/{state.course.holes.length} holes · {totalPoints} pts
          </div>
        </div>
        <button
          className="btn"
          onClick={() => onSelectPlayer("")}
          title="Switch player"
          style={{ visibility: state.players.length > 1 ? "visible" : "hidden" }}
        >
          switch
        </button>
      </div>

      <div className="hole-nav">
        <button
          className="btn-icon big"
          disabled={currentHole <= 1}
          onClick={() => goHole(currentHole - 1)}
        >
          ‹
        </button>
        <div className="hole-info">
          <div className="hole-label">Hole {hole.number}</div>
          <div className="hole-meta">
            Par {hole.par} · SI {hole.strokeIndex}
            {received > 0 && ` · +${received} stroke${received > 1 ? "s" : ""}`}
          </div>
        </div>
        <button
          className="btn-icon big"
          disabled={currentHole >= state.course.holes.length}
          onClick={() => goHole(currentHole + 1)}
        >
          ›
        </button>
      </div>

      <div className="stroke-grid">
        {choices.map((n) => {
          const pts = stablefordPoints(
            n,
            hole.par,
            dailyHandicap,
            hole.strokeIndex,
          );
          return (
            <button
              key={n}
              className={`stroke-btn ${currentStrokes === n ? "selected" : ""}`}
              onClick={() => handleStrokes(n)}
              disabled={submitting}
            >
              <span className="stroke-num">{n}</span>
              <span className="stroke-pts">
                {pts} pt{pts === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {currentStrokes != null && (
        <div className="current-score">
          <div>
            Scored <strong>{currentStrokes}</strong> (
            {holeResult?.points ?? 0} pts)
          </div>
          <button className="btn" onClick={handleClear} disabled={submitting}>
            Clear
          </button>
        </div>
      )}

      <div className="hole-chips">
        {holes.map((h) => (
          <button
            key={h.holeNumber}
            className={`hole-chip ${h.holeNumber === currentHole ? "active" : ""} ${h.strokes != null ? "played" : ""}`}
            onClick={() => goHole(h.holeNumber)}
          >
            <span className="chip-num">{h.holeNumber}</span>
            <span className="chip-pts">
              {h.strokes != null ? h.points : "–"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
