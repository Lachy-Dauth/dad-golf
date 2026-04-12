import type { RoundState } from "@dad-golf/shared";
import { computePlayerHoles } from "@dad-golf/shared";
import type { PlayerHoleResult } from "@dad-golf/shared";

interface Props {
  state: RoundState;
}

function scoreClass(points: number, hasScore: boolean): string {
  if (!hasScore) return "";
  if (points >= 4) return "score-eagle";
  if (points === 3) return "score-birdie";
  if (points === 2) return "score-par";
  if (points === 1) return "score-bogey";
  return "score-double";
}

interface PlayerHoleData {
  playerId: string;
  name: string;
  holes: PlayerHoleResult[];
  subtotalStrokes: number;
  subtotalPoints: number;
}

function VerticalHalfTable({
  label,
  holes,
  playerData,
}: {
  label: string;
  holes: PlayerHoleResult[];
  playerData: PlayerHoleData[];
}) {
  return (
    <div className="scorecard-wrapper">
      <table className="scorecard scorecard-vertical">
        <thead>
          <tr>
            <th className="hole-col">{label}</th>
            <th className="hole-col">Par</th>
            {playerData.map((pd) => (
              <th key={pd.playerId} className="player-col">
                {pd.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holes.map((h, hi) => (
            <tr key={h.holeNumber}>
              <td className="hole-col">{h.holeNumber}</td>
              <td className="hole-col par-cell">{h.par}</td>
              {playerData.map((pd) => {
                const ph = pd.holes[hi];
                return (
                  <td key={pd.playerId} className={scoreClass(ph.points, ph.strokes != null)}>
                    {ph.strokes ?? "–"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="subtotal-row">
            <td className="hole-col">Tot</td>
            <td className="hole-col par-cell">{holes.reduce((s, h) => s + h.par, 0)}</td>
            {playerData.map((pd) => (
              <td key={pd.playerId} className="subtotal-cell">
                {pd.subtotalStrokes || "–"}
              </td>
            ))}
          </tr>
          <tr className="subtotal-row">
            <td className="hole-col">Pts</td>
            <td className="hole-col"></td>
            {playerData.map((pd) => (
              <td key={pd.playerId} className="subtotal-cell">
                {pd.subtotalPoints}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function ScorecardView({ state }: Props) {
  const { course, players, scores } = state;
  const numHoles = course.holes.length;
  const isFull = numHoles > 9;

  const allPlayerHoles = players.map((p) => ({
    player: p,
    holes: computePlayerHoles(course, p, scores),
  }));

  const front = isFull ? 9 : numHoles;

  function buildHalf(start: number, end: number) {
    const refHoles = allPlayerHoles[0]?.holes.slice(start, end) ?? [];
    const playerData: PlayerHoleData[] = allPlayerHoles.map(({ player, holes }) => {
      const slice = holes.slice(start, end);
      const subtotalStrokes = slice.reduce((s, h) => s + (h.strokes ?? 0), 0);
      const subtotalPoints = slice.reduce((s, h) => s + h.points, 0);
      return {
        playerId: player.id,
        name: player.name,
        holes: slice,
        subtotalStrokes,
        subtotalPoints,
      };
    });
    return { refHoles, playerData };
  }

  const frontData = buildHalf(0, front);

  return (
    <div className="section">
      <h2>Scorecard</h2>
      <VerticalHalfTable
        label={isFull ? "Front 9" : "Hole"}
        holes={frontData.refHoles}
        playerData={frontData.playerData}
      />
      {isFull &&
        (() => {
          const backData = buildHalf(9, numHoles);
          const totals: PlayerHoleData[] = allPlayerHoles.map(({ player, holes }) => ({
            playerId: player.id,
            name: player.name,
            holes,
            subtotalStrokes: holes.reduce((s, h) => s + (h.strokes ?? 0), 0),
            subtotalPoints: holes.reduce((s, h) => s + h.points, 0),
          }));
          return (
            <>
              <VerticalHalfTable
                label="Back 9"
                holes={backData.refHoles}
                playerData={backData.playerData}
              />
              <div className="scorecard-wrapper">
                <table className="scorecard scorecard-vertical scorecard-totals">
                  <thead>
                    <tr>
                      <th className="hole-col">Total</th>
                      {totals.map((t) => (
                        <th key={t.playerId} className="player-col">
                          {t.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="hole-col">Strokes</td>
                      {totals.map((t) => (
                        <td key={t.playerId}>{t.subtotalStrokes || "–"}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="hole-col">Points</td>
                      {totals.map((t) => (
                        <td key={t.playerId} className="subtotal-cell">
                          {t.subtotalPoints}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
    </div>
  );
}
