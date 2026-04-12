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

function HalfTable({
  label,
  holes,
  playerData,
}: {
  label: string;
  holes: PlayerHoleResult[];
  playerData: {
    name: string;
    holes: PlayerHoleResult[];
    subtotalStrokes: number;
    subtotalPoints: number;
  }[];
}) {
  return (
    <div className="scorecard-wrapper">
      <table className="scorecard">
        <thead>
          <tr>
            <th className="player-name-col">{label}</th>
            {holes.map((h) => (
              <th key={h.holeNumber}>{h.holeNumber}</th>
            ))}
            <th className="subtotal-col">Tot</th>
            <th className="subtotal-col">Pts</th>
          </tr>
          <tr className="par-row">
            <td className="player-name-col">Par</td>
            {holes.map((h) => (
              <td key={h.holeNumber}>{h.par}</td>
            ))}
            <td className="subtotal-col">{holes.reduce((s, h) => s + h.par, 0)}</td>
            <td className="subtotal-col"></td>
          </tr>
        </thead>
        <tbody>
          {playerData.map((pd) => (
            <tr key={pd.name}>
              <td className="player-name-col">{pd.name}</td>
              {pd.holes.map((h) => (
                <td key={h.holeNumber} className={scoreClass(h.points, h.strokes != null)}>
                  {h.strokes ?? "–"}
                </td>
              ))}
              <td className="subtotal-col">{pd.subtotalStrokes || "–"}</td>
              <td className="subtotal-col">{pd.subtotalPoints}</td>
            </tr>
          ))}
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
    // Reference holes from first player (all players share the same course)
    const refHoles = allPlayerHoles[0]?.holes.slice(start, end) ?? [];
    const playerData = allPlayerHoles.map(({ player, holes }) => {
      const slice = holes.slice(start, end);
      const subtotalStrokes = slice.reduce((s, h) => s + (h.strokes ?? 0), 0);
      const subtotalPoints = slice.reduce((s, h) => s + h.points, 0);
      return { name: player.name, holes: slice, subtotalStrokes, subtotalPoints };
    });
    return { refHoles, playerData };
  }

  const frontData = buildHalf(0, front);

  // Totals row (for full 18-hole rounds)
  const totals = isFull
    ? allPlayerHoles.map(({ player, holes }) => ({
        name: player.name,
        strokes: holes.reduce((s, h) => s + (h.strokes ?? 0), 0),
        points: holes.reduce((s, h) => s + h.points, 0),
      }))
    : null;

  return (
    <div className="section">
      <h2>Scorecard</h2>
      <HalfTable
        label={isFull ? "Front 9" : "Holes"}
        holes={frontData.refHoles}
        playerData={frontData.playerData}
      />
      {isFull &&
        (() => {
          const backData = buildHalf(9, numHoles);
          return (
            <>
              <HalfTable
                label="Back 9"
                holes={backData.refHoles}
                playerData={backData.playerData}
              />
              <div className="scorecard-wrapper">
                <table className="scorecard scorecard-totals">
                  <thead>
                    <tr>
                      <th className="player-name-col">Total</th>
                      <th>Strokes</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals!.map((t) => (
                      <tr key={t.name}>
                        <td className="player-name-col">{t.name}</td>
                        <td>{t.strokes || "–"}</td>
                        <td className="subtotal-col">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
    </div>
  );
}
