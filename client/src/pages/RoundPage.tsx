import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { RoundState } from "@dad-golf/shared";
import { useRoundSocket } from "../hooks/useRoundSocket.js";
import {
  addRecentRound,
  clearActivePlayerId,
  getActivePlayerId,
  setActivePlayerId,
} from "../localStore.js";
import { useAuth } from "../AuthContext.js";
import LobbyView from "../components/LobbyView.js";
import ScoringView from "../components/ScoringView.js";
import LeaderboardView from "../components/LeaderboardView.js";
import RoundReplayView from "../components/RoundReplayView.js";
import ScorecardView from "../components/ScorecardView.js";
import WeatherWidget from "../components/WeatherWidget.js";

type Tab = "scoring" | "leaderboard" | "players";
type CompletedTab = "summary" | "scorecard" | "leaderboard";

export default function RoundPage() {
  const { code } = useParams<{ code: string }>();
  const roomCode = code ?? null;
  const { user: viewer } = useAuth();
  const [initial, setInitial] = useState<RoundState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { state, setState } = useRoundSocket(roomCode, initial);
  const [tab, setTab] = useState<Tab>("scoring");
  const [completedTab, setCompletedTab] = useState<CompletedTab>("summary");
  const [activePlayerId, setActivePlayer] = useState<string | null>(
    roomCode ? getActivePlayerId(roomCode) : null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

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
  }, [roomCode, viewer?.id]);

  // Auto-bind active player to the signed in user when they're in the round
  useEffect(() => {
    if (!state || !viewer) return;
    const me = state.players.find((p) => p.userId === viewer.id);
    if (me && activePlayerId !== me.id) {
      setActivePlayer(me.id);
      if (roomCode) setActivePlayerId(roomCode, me.id);
    }
  }, [state, viewer, activePlayerId, roomCode]);

  useEffect(() => {
    if (!state || !roomCode) return;
    if (activePlayerId && !state.players.some((p) => p.id === activePlayerId)) {
      setActivePlayer(null);
    }
  }, [state, activePlayerId, roomCode]);

  const activePlayer = useMemo(() => {
    if (!state || !activePlayerId) return null;
    return state.players.find((p) => p.id === activePlayerId) ?? null;
  }, [state, activePlayerId]);

  const isLeader = !!(state && viewer && state.round.leaderUserId === viewer.id);

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

  async function handleJoinAsUser(teeId?: string) {
    if (!roomCode) return;
    const res = await api.joinRound(roomCode, teeId ? { teeId } : undefined);
    setState(res.state);
    handleActivePlayer(res.player.id);
  }

  async function handleJoinAsGuest(name: string, handicap: number, teeId?: string) {
    if (!roomCode) return;
    const res = await api.joinRound(roomCode, { name, handicap, teeId });
    setState(res.state);
    handleActivePlayer(res.player.id);
  }

  async function handleStart() {
    if (!roomCode) return;
    try {
      const res = await api.startRound(roomCode);
      setState(res.state);
      setTab("scoring");
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function handleComplete() {
    if (!roomCode) return;
    if (!confirm("End this round? Scores can still be edited after.")) return;
    try {
      const res = await api.completeRound(roomCode);
      setState(res.state);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function handleScore(holeNumber: number, strokes: number) {
    if (!roomCode || !activePlayer) return;
    const res = await api.submitScore(roomCode, activePlayer.id, holeNumber, strokes);
    setState(res.state);
  }

  async function handleSetCurrentHole(holeNumber: number) {
    if (!roomCode) return;
    const res = await api.setCurrentHole(roomCode, holeNumber);
    setState(res.state);
  }

  async function handleRemovePlayer(playerId: string) {
    if (!roomCode) return;
    if (!confirm("Remove this player from the round?")) return;
    try {
      await api.removeRoundPlayer(roomCode, playerId);
      if (playerId === activePlayerId) setActivePlayer(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  const showLobby = round.status === "waiting";
  const showSummary = round.status === "complete";
  const canRemoveAnyPlayer = (playerUserId: string | null) =>
    isLeader || (viewer != null && playerUserId === viewer.id);

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
              title="Copy share link (anyone can join, no log-in required)"
            >
              copy link
            </button>
          </div>
          <div className="round-meta muted">
            Rating {course.rating.toFixed(1)} · Slope {course.slope}
          </div>
          {round.leaderName && <div className="round-meta muted">Leader: {round.leaderName}</div>}
        </div>
        {roomCode && <WeatherWidget roomCode={roomCode} courseLocation={course.location} />}
      </div>

      {actionError && <div className="error">{actionError}</div>}

      {showLobby && (
        <LobbyView
          state={state}
          activePlayerId={activePlayerId}
          viewer={viewer}
          isLeader={isLeader}
          onSetActivePlayer={handleActivePlayer}
          onJoinAsUser={handleJoinAsUser}
          onJoinAsGuest={handleJoinAsGuest}
          onStart={handleStart}
          onRemovePlayer={handleRemovePlayer}
          onStateUpdate={setState}
        />
      )}

      {!showLobby && showSummary && (
        <>
          <nav className="tabs">
            <button
              className={completedTab === "summary" ? "active" : ""}
              onClick={() => setCompletedTab("summary")}
            >
              Summary
            </button>
            <button
              className={completedTab === "scorecard" ? "active" : ""}
              onClick={() => setCompletedTab("scorecard")}
            >
              Scorecard
            </button>
            <button
              className={completedTab === "leaderboard" ? "active" : ""}
              onClick={() => setCompletedTab("leaderboard")}
            >
              Leaderboard
            </button>
          </nav>

          {completedTab === "summary" && <RoundReplayView state={state} />}
          {completedTab === "scorecard" && <ScorecardView state={state} />}
          {completedTab === "leaderboard" && <LeaderboardView state={state} />}
        </>
      )}

      {!showLobby && !showSummary && (
        <>
          <nav className="tabs">
            <button className={tab === "scoring" ? "active" : ""} onClick={() => setTab("scoring")}>
              Score
            </button>
            <button
              className={tab === "leaderboard" ? "active" : ""}
              onClick={() => setTab("leaderboard")}
            >
              Leaderboard
            </button>
            <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>
              Players
            </button>
          </nav>

          {tab === "scoring" && (
            <ScoringView
              state={state}
              activePlayer={activePlayer}
              onSelectPlayer={handleActivePlayer}
              onJoinAsUser={handleJoinAsUser}
              onJoinAsGuest={handleJoinAsGuest}
              viewer={viewer}
              isLeader={isLeader}
              roomCode={roomCode!}
              onScore={handleScore}
              onSetCurrentHole={handleSetCurrentHole}
              onStateUpdate={setState}
            />
          )}

          {tab === "leaderboard" && <LeaderboardView state={state} />}

          {tab === "players" && (
            <div className="section">
              <h2>Players ({players.length})</h2>
              <ul className="list">
                {players.map((p) => (
                  <li key={p.id}>
                    <div className="list-row">
                      <div>
                        <div className="list-primary">
                          {p.name}
                          {p.userId != null && p.userId === round.leaderUserId && (
                            <span className="badge">leader</span>
                          )}
                          {p.isGuest && <span className="badge">guest</span>}
                        </div>
                        <div className="list-secondary">GA HCP {p.handicap.toFixed(1)}</div>
                      </div>
                      {canRemoveAnyPlayer(p.userId) && (
                        <button className="btn-icon" onClick={() => handleRemovePlayer(p.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {round.status === "in_progress" && isLeader && (
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
