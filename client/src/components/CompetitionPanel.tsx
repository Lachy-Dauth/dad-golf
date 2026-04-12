import { useState } from "react";
import type { HoleCompetition, Player, RoundState } from "@dad-golf/shared";
import { api } from "../api.js";

interface Props {
  competition: HoleCompetition;
  activePlayer: Player | null;
  isLeader: boolean;
  roomCode: string;
  onStateUpdate: (state: RoundState) => void;
}

export default function CompetitionPanel({
  competition,
  activePlayer,
  isLeader,
  roomCode,
  onStateUpdate,
}: Props) {
  const [claimText, setClaimText] = useState(() => {
    if (!activePlayer) return "";
    const existing = competition.claims.find((c) => c.playerId === activePlayer.id);
    return existing?.claim ?? "";
  });
  const [submitting, setSubmitting] = useState(false);

  const label = competition.type === "ctp" ? "Closest to Pin" : "Longest Drive";
  const existingClaim = activePlayer
    ? competition.claims.find((c) => c.playerId === activePlayer.id)
    : null;

  async function handleSubmitClaim() {
    if (!activePlayer || !claimText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.submitClaim(roomCode, competition.id, activePlayer.id, claimText.trim());
      onStateUpdate(res.state);
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCompetition() {
    if (!confirm(`Remove this ${label} competition?`)) return;
    try {
      await api.deleteCompetition(roomCode, competition.id);
    } catch {
      /* ignore */
    }
  }

  async function handleSetWinner(playerId: string) {
    try {
      const res = await api.setCompetitionWinner(roomCode, competition.id, playerId);
      onStateUpdate(res.state);
    } catch {
      /* ignore */
    }
  }

  async function handleClearWinner() {
    try {
      await api.clearCompetitionWinner(roomCode, competition.id);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="competition-panel">
      <div className="competition-header">
        <span className={`competition-badge ${competition.type}`}>{label}</span>
        {isLeader && (
          <button className="btn-icon" onClick={handleDeleteCompetition} title="Remove competition">
            ✕
          </button>
        )}
      </div>

      {competition.claims.length > 0 && (
        <ul className="competition-claims">
          {competition.claims.map((claim) => (
            <li key={claim.id} className={`competition-claim-row ${claim.isWinner ? "winner" : ""}`}>
              <div className="claim-info">
                {claim.isWinner && <span className="winner-icon" title="Winner">&#9733;</span>}
                <span className="claim-player">{claim.playerName}</span>
                <span className="claim-text">{claim.claim}</span>
              </div>
              {isLeader && (
                <div className="claim-actions">
                  {claim.isWinner ? (
                    <button className="btn-sm" onClick={handleClearWinner}>
                      clear
                    </button>
                  ) : (
                    <button className="btn-sm btn-primary" onClick={() => handleSetWinner(claim.playerId)}>
                      winner
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {activePlayer && (
        <div className="competition-input">
          <input
            type="text"
            placeholder={competition.type === "ctp" ? 'e.g. "2.3m"' : 'e.g. "285 yards"'}
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            maxLength={100}
          />
          <button
            className="btn btn-primary"
            onClick={handleSubmitClaim}
            disabled={submitting || !claimText.trim()}
          >
            {existingClaim ? "Update" : "Claim"}
          </button>
        </div>
      )}

      {!activePlayer && competition.claims.length === 0 && (
        <div className="muted">No claims yet. Select a player to submit a claim.</div>
      )}
    </div>
  );
}
