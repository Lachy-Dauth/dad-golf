import type { RoundState } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";
import ProgressionChart from "./ProgressionChart.js";
import PlayerStatsView from "./PlayerStatsView.js";

interface Props {
  state: RoundState;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function RoundReplayView({ state }: Props) {
  const { leaderboard, players, course, scores, round } = state;
  const winner = leaderboard[0];

  const bestHole = (() => {
    let best: { name: string; holeNumber: number; points: number } | null = null;
    for (const p of players) {
      const holes = computePlayerHoles(course, p, scores);
      for (const h of holes) {
        if (h.strokes != null && (best === null || h.points > best.points)) {
          best = { name: p.name, holeNumber: h.holeNumber, points: h.points };
        }
      }
    }
    return best;
  })();

  const dateStr = formatDate(round.completedAt ?? round.startedAt ?? round.createdAt);
  const duration = formatDuration(round.startedAt, round.completedAt);

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

      {players.length >= 2 && <ProgressionChart state={state} />}

      <PlayerStatsView state={state} />
    </div>
  );
}
