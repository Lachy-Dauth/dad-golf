import { useMemo } from "react";
import type { RoundState, PlayerHoleResult } from "@dad-golf/shared";

interface Props {
  state: RoundState;
  playerHolesMap: Map<string, PlayerHoleResult[]>;
}

const COLORS = [
  "#3bc16b",
  "#5b9cf5",
  "#f5a623",
  "#e5484d",
  "#c084fc",
  "#38bdf8",
  "#fb923c",
  "#a3e635",
];

export default function ProgressionChart({ state, playerHolesMap }: Props) {
  const { course, players } = state;

  const data = useMemo(() => {
    return players.map((p, i) => {
      const holes = playerHolesMap.get(p.id) ?? [];
      const cumulative = [0];
      let running = 0;
      for (const h of holes) {
        running += h.points;
        cumulative.push(running);
      }
      return { name: p.name, cumulative, color: COLORS[i % COLORS.length] };
    });
  }, [players, playerHolesMap]);

  const numHoles = course.holes.length;
  const maxPoints = Math.max(...data.map((d) => d.cumulative[d.cumulative.length - 1]), 1);
  const yMax = Math.ceil(maxPoints / 5) * 5;

  // SVG dimensions
  const W = 600;
  const H = 300;
  const pad = { top: 20, right: 20, bottom: 30, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  function x(hole: number) {
    return pad.left + (hole / numHoles) * plotW;
  }
  function y(pts: number) {
    return pad.top + plotH - (pts / yMax) * plotH;
  }

  // Gridlines
  const gridStep = yMax <= 10 ? 2 : yMax <= 30 ? 5 : 10;
  const gridLines: number[] = [];
  for (let v = 0; v <= yMax; v += gridStep) gridLines.push(v);

  return (
    <div className="section">
      <h2>Progression</h2>
      <div className="progression-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Gridlines */}
          {gridLines.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                y1={y(v)}
                x2={W - pad.right}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={pad.left - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-dim)"
              >
                {v}
              </text>
            </g>
          ))}

          {/* X-axis hole labels */}
          {Array.from({ length: numHoles }, (_, i) => i + 1).map((h) => (
            <text
              key={h}
              x={x(h)}
              y={H - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-dim)"
            >
              {h}
            </text>
          ))}

          {/* Player lines */}
          {data.map((d) => (
            <polyline
              key={d.name}
              fill="none"
              stroke={d.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={d.cumulative.map((pts, i) => `${x(i)},${y(pts)}`).join(" ")}
            />
          ))}

          {/* Endpoint dots */}
          {data.map((d) =>
            d.cumulative.map((pts, i) =>
              i > 0 ? (
                <circle key={`${d.name}-${i}`} cx={x(i)} cy={y(pts)} r="3" fill={d.color} />
              ) : null,
            ),
          )}
        </svg>
        <div className="chart-legend">
          {data.map((d) => (
            <div key={d.name} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: d.color }} />
              <span>{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
