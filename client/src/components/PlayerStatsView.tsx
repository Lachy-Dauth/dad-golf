import type { RoundState, PlayerHoleResult } from "@dad-golf/shared";

interface Props {
  state: RoundState;
  playerHolesMap: Map<string, PlayerHoleResult[]>;
}

export default function PlayerStatsView({ state, playerHolesMap }: Props) {
  const { course, players, leaderboard } = state;

  return (
    <div className="section">
      <h2>Player Stats</h2>
      <div className="player-stats-grid">
        {players.map((p) => {
          const holes = playerHolesMap.get(p.id) ?? [];
          const played = holes.filter((h) => h.strokes != null);
          const lbRow = leaderboard.find((r) => r.playerId === p.id);

          const best = played.length
            ? played.reduce((a, b) => (b.points > a.points ? b : a))
            : null;
          const worst = played.length
            ? played.reduce((a, b) => (b.points < a.points ? b : a))
            : null;

          let eagles = 0;
          let birdies = 0;
          let pars = 0;
          let bogeys = 0;
          let doubles = 0;
          for (const h of played) {
            if (h.points >= 4) eagles++;
            else if (h.points === 3) birdies++;
            else if (h.points === 2) pars++;
            else if (h.points === 1) bogeys++;
            else doubles++;
          }

          return (
            <div key={p.id} className="player-stat-card">
              <div className="player-stat-header">
                {p.name}
                <span className="player-stat-hcp">GA {p.handicap.toFixed(1)}</span>
              </div>
              <div className="stat-row">
                <div className="stat-item">
                  <span className="stat-value">{lbRow?.totalPoints ?? 0}</span>
                  <span className="stat-label">Points</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{lbRow?.totalStrokes || "–"}</span>
                  <span className="stat-label">Strokes</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {played.length}/{course.holes.length}
                  </span>
                  <span className="stat-label">Holes</span>
                </div>
                {best && (
                  <div className="stat-item">
                    <span className="stat-value">{best.points}pts</span>
                    <span className="stat-label">Best (H{best.holeNumber})</span>
                  </div>
                )}
                {worst && (
                  <div className="stat-item">
                    <span className="stat-value">{worst.points}pts</span>
                    <span className="stat-label">Worst (H{worst.holeNumber})</span>
                  </div>
                )}
              </div>
              {played.length > 0 && (
                <div className="score-dist">
                  {eagles > 0 && (
                    <span className="score-dist-item score-eagle">
                      {eagles} Eagle{eagles > 1 ? "s" : ""}
                    </span>
                  )}
                  {birdies > 0 && (
                    <span className="score-dist-item score-birdie">
                      {birdies} Birdie{birdies > 1 ? "s" : ""}
                    </span>
                  )}
                  {pars > 0 && (
                    <span className="score-dist-item score-par-chip">
                      {pars} Par{pars > 1 ? "s" : ""}
                    </span>
                  )}
                  {bogeys > 0 && (
                    <span className="score-dist-item score-bogey">
                      {bogeys} Bogey{bogeys > 1 ? "s" : ""}
                    </span>
                  )}
                  {doubles > 0 && (
                    <span className="score-dist-item score-double">{doubles} Dbl+</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
