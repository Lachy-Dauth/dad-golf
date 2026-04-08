import type { RoundState } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";

interface Props {
  state: RoundState;
}

export default function SummaryView({ state }: Props) {
  const { leaderboard, players, course, scores } = state;
  const winner = leaderboard[0];

  const bestHole = (() => {
    let best: { name: string; holeNumber: number; points: number } | null =
      null;
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
    </section>
  );
}
