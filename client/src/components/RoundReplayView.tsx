import { useMemo } from "react";
import type { RoundState, PlayerHoleResult } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";
import ProgressionChart from "./ProgressionChart.js";
import PlayerStatsView from "./PlayerStatsView.js";
import { formatDate, formatElapsedTime } from "../utils/dateFormat.js";

interface Props {
  state: RoundState;
}

export default function RoundReplayView({ state }: Props) {
  const { leaderboard, players, course, scores, round } = state;
  const winner = leaderboard[0];

  const playerHolesMap = useMemo(() => {
    const map = new Map<string, PlayerHoleResult[]>();
    for (const p of players) {
      map.set(p.id, computePlayerHoles(course, p, scores));
    }
    return map;
  }, [course, players, scores]);

  const bestHole = useMemo(() => {
    let best: { name: string; holeNumber: number; points: number } | null = null;
    for (const p of players) {
      const holes = playerHolesMap.get(p.id) ?? [];
      for (const h of holes) {
        if (h.strokes != null && (best === null || h.points > best.points)) {
          best = { name: p.name, holeNumber: h.holeNumber, points: h.points };
        }
      }
    }
    return best;
  }, [players, playerHolesMap]);

  const dateStr = formatDate(round.completedAt ?? round.startedAt ?? round.createdAt);
  const duration = formatElapsedTime(round.startedAt, round.completedAt);

  return (
    <div className="round-replay">
      <section className="section summary">
        <h2>Round complete</h2>
        {winner && (
          <div className="winner-card">
            <div className="winner-label">Winner</div>
            <div className="winner-name">{winner.name}</div>
            <div className="winner-points">{winner.totalPoints} points</div>
            <div className="round-context">
              {course.name} &middot; {dateStr}
              {duration && <> &middot; {duration}</>}
            </div>
          </div>
        )}
        {bestHole && (
          <div className="stat-card">
            <div>Best hole</div>
            <strong>
              {bestHole.name} &middot; hole {bestHole.holeNumber} &middot; {bestHole.points} pts
            </strong>
          </div>
        )}
        {(state.competitions ?? []).map((comp) => {
          const compWinner = comp.claims.find((c) => c.isWinner);
          const label = comp.type === "ctp" ? "Closest to Pin" : "Longest Drive";
          return (
            <div key={comp.id} className="stat-card">
              <div>
                {label} &middot; Hole {comp.holeNumber}
              </div>
              {compWinner ? (
                <strong>
                  {compWinner.playerName} &middot; {compWinner.claim}
                </strong>
              ) : (
                <span className="muted">
                  {comp.claims.length > 0
                    ? `${comp.claims.length} claim${comp.claims.length > 1 ? "s" : ""} — no winner selected`
                    : "No claims"}
                </span>
              )}
            </div>
          );
        })}
      </section>

      {players.length >= 2 && <ProgressionChart state={state} playerHolesMap={playerHolesMap} />}

      <PlayerStatsView state={state} playerHolesMap={playerHolesMap} />
    </div>
  );
}
