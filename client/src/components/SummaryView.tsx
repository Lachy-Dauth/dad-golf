import type { RoundState } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";

interface Props {
  state: RoundState;
}

export default function SummaryView({ state }: Props) {
  const { leaderboard, players, course, scores } = state;
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

  return (
    <section className="section summary">
      <h2>Round complete</h2>
      {winner && (
        <div className="winner-card">
          <div className="winner-label">🏆 Winner</div>
          <div className="winner-name">{winner.name}</div>
          <div className="winner-points">{winner.totalPoints} points</div>
        </div>
      )}
      {bestHole && (
        <div className="stat-card">
          <div>Best hole</div>
          <strong>
            {bestHole.name} · hole {bestHole.holeNumber} · {bestHole.points} pts
          </strong>
        </div>
      )}
      {(state.competitions ?? []).map((comp) => {
        const winner = comp.claims.find((c) => c.isWinner);
        const label = comp.type === "ctp" ? "Closest to Pin" : "Longest Drive";
        return (
          <div key={comp.id} className="stat-card">
            <div>
              {label} · Hole {comp.holeNumber}
            </div>
            {winner ? (
              <strong>
                {winner.playerName} · {winner.claim}
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
  );
}
