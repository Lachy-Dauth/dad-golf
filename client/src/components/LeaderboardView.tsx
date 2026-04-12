import type { RoundState } from "@dad-golf/shared";

interface Props {
  state: RoundState;
}

export default function LeaderboardView({ state }: Props) {
  const { leaderboard, course } = state;

  if (leaderboard.length === 0) {
    return <div className="muted">No players in this round yet.</div>;
  }

  return (
    <div className="leaderboard">
      <div className="lb-header">
        <span className="lb-pos">#</span>
        <span className="lb-name">Player</span>
        <span className="lb-num">Holes</span>
        <span className="lb-num">Strokes</span>
        <span className="lb-num">Pts</span>
        <span className="lb-num">Back</span>
      </div>
      {leaderboard.map((row) => (
        <div key={row.playerId} className={`lb-row ${row.position === 1 ? "lead" : ""}`}>
          <span className="lb-pos">{row.position}</span>
          <span className="lb-name">
            <div className="lb-primary">{row.name}</div>
            <div className="lb-secondary">
              GA {row.handicap.toFixed(1)} · DH {row.dailyHandicap}
            </div>
          </span>
          <span className="lb-num">
            {row.holesPlayed}/{course.holes.length}
          </span>
          <span className="lb-num lb-strokes">{row.totalStrokes > 0 ? row.totalStrokes : "–"}</span>
          <span className="lb-num lb-points">{row.totalPoints}</span>
          <span className="lb-num">{row.position === 1 ? "—" : `-${row.pointsBack}`}</span>
        </div>
      ))}
    </div>
  );
}
