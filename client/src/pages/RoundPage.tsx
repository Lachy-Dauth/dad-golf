import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { RoundState } from "@dad-golf/shared";
import { useRoundSocket } from "../useRoundSocket.js";
import {
  addRecentRound,
  clearActivePlayerId,
  getActivePlayerId,
  setActivePlayerId,
} from "../localStore.js";
import LobbyView from "../components/LobbyView.js";
import ScoringView from "../components/ScoringView.js";
import LeaderboardView from "../components/LeaderboardView.js";
import SummaryView from "../components/SummaryView.js";

type Tab = "scoring" | "leaderboard" | "players";

export default function RoundPage() {
  const { code } = useParams<{ code: string }>();
  const roomCode = code ?? null;
  const [initial, setInitial] = useState<RoundState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { state, setState, connected } = useRoundSocket(roomCode, initial);
  const [tab, setTab] = useState<Tab>("scoring");
  const [activePlayerId, setActivePlayer] = useState<string | null>(
    roomCode ? getActivePlayerId(roomCode) : null,
  );

  useEffect(() => {
    if (!roomCode) return;
    api
      .getRound(roomCode)
      .then((res) => {
        setInitial(res.state);
        addRecentRound({
          roomCode: res.state.round.roomCode,
          courseName: res.state.course.name,
          joinedAt: new Date().toISOString(),
        });
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [roomCode]);

  useEffect(() => {
    if (!state || !roomCode) return;
    // If we had stored an active player that's no longer in the round, clear
    if (activePlayerId && !state.players.some((p) => p.id === activePlayerId)) {
      setActivePlayer(null);
    }
  }, [state, activePlayerId, roomCode]);

  const activePlayer = useMemo(() => {
    if (!state || !activePlayerId) return null;
    return state.players.find((p) => p.id === activePlayerId) ?? null;
  }, [state, activePlayerId]);

  if (loadError) {
    return (
      <div className="page">
        <div className="error">{loadError}</div>
        <Link to="/" className="back-link">
          ← Home
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page">
        <div className="muted">Loading round…</div>
      </div>
    );
  }

  const { round, course, players } = state;

  function handleActivePlayer(id: string) {
    if (!id) {
      setActivePlayer(null);
      if (roomCode) clearActivePlayerId(roomCode);
      return;
    }
    setActivePlayer(id);
    if (roomCode) setActivePlayerId(roomCode, id);
  }

  async function handleJoinAs(name: string, handicap: number) {
    if (!roomCode) return;
    const res = await api.joinRound(roomCode, name, handicap);
    setState(res.state);
    handleActivePlayer(res.player.id);
  }

  async function handleStart() {
    if (!roomCode) return;
    const res = await api.startRound(roomCode);
    setState(res.state);
    setTab("scoring");
  }

  async function handleComplete() {
    if (!roomCode) return;
    if (!confirm("End this round? Scores can still be edited after.")) return;
    const res = await api.completeRound(roomCode);
    setState(res.state);
  }

  async function handleScore(holeNumber: number, strokes: number) {
    if (!roomCode || !activePlayer) return;
    const res = await api.submitScore(
      roomCode,
      activePlayer.id,
      holeNumber,
      strokes,
    );
    setState(res.state);
  }

  async function handleClearScore(holeNumber: number) {
    if (!roomCode || !activePlayer) return;
    await api.clearScore(roomCode, activePlayer.id, holeNumber);
    // WS will push the state update
  }

  async function handleSetCurrentHole(holeNumber: number) {
    if (!roomCode) return;
    const res = await api.setCurrentHole(roomCode, holeNumber);
    setState(res.state);
  }

  async function handleRemovePlayer(playerId: string) {
    if (!roomCode) return;
    if (!confirm("Remove this player from the round?")) return;
    await api.removeRoundPlayer(roomCode, playerId);
    if (playerId === activePlayerId) setActivePlayer(null);
  }

  const showLobby = round.status === "waiting";
  const showSummary = round.status === "complete";

  return (
    <div className="page round-page">
      <div className="round-header">
        <div>
          <div className="round-title">{course.name}</div>
          <div className="round-code">
            {round.roomCode}{" "}
            <button
              className="copy-btn"
              onClick={() => {
                const url = `${location.origin}/r/${round.roomCode}`;
                navigator.clipboard?.writeText(url);
              }}
              title="Copy share link"
            >
              copy link
            </button>
          </div>
        </div>
        <div className={`conn-dot ${connected ? "on" : "off"}`} title={connected ? "Live" : "Reconnecting…"} />
      </div>

      {showLobby && (
        <LobbyView
          state={state}
          activePlayerId={activePlayerId}
          onSetActivePlayer={handleActivePlayer}
          onJoin={handleJoinAs}
          onStart={handleStart}
          onRemovePlayer={handleRemovePlayer}
        />
      )}

      {!showLobby && (
        <>
          <nav className="tabs">
            <button
              className={tab === "scoring" ? "active" : ""}
              onClick={() => setTab("scoring")}
            >
              Score
            </button>
            <button
              className={tab === "leaderboard" ? "active" : ""}
              onClick={() => setTab("leaderboard")}
            >
              Leaderboard
            </button>
            <button
              className={tab === "players" ? "active" : ""}
              onClick={() => setTab("players")}
            >
              Players
            </button>
          </nav>

          {tab === "scoring" && (
            <ScoringView
              state={state}
              activePlayer={activePlayer}
              onSelectPlayer={handleActivePlayer}
              onJoin={handleJoinAs}
              onScore={handleScore}
              onClearScore={handleClearScore}
              onSetCurrentHole={handleSetCurrentHole}
            />
          )}

          {tab === "leaderboard" && (
            <LeaderboardView state={state} />
          )}

          {tab === "players" && (
            <div className="section">
              <h2>Players ({players.length})</h2>
              <ul className="list">
                {players.map((p) => (
                  <li key={p.id}>
                    <div className="list-row">
                      <div>
                        <div className="list-primary">{p.name}</div>
                        <div className="list-secondary">HCP {p.handicap}</div>
                      </div>
                      <button
                        className="btn-icon"
                        onClick={() => handleRemovePlayer(p.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showSummary && <SummaryView state={state} />}

          {!showSummary && round.status === "in_progress" && (
            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn" onClick={handleComplete}>
                End round
              </button>
            </div>
          )}
        </>
      )}

      <Link to="/" className="back-link">
        ← Home
      </Link>
    </div>
  );
}
