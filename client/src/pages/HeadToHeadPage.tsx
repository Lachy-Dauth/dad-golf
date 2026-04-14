import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import type { HeadToHeadStats, H2HPlayerStats, Opponent } from "../api.js";
import { useAuth } from "../AuthContext.js";
import { useAsync } from "../hooks/useAsync.js";
import { formatDate } from "../utils/dateFormat.js";

type StatsMode = "stableford" | "strokes";

// ---------- Win/Loss Record ----------

function WinLossBar({ stats }: { stats: HeadToHeadStats }) {
  const total = stats.sharedRounds;
  if (total === 0) return null;
  const p1Pct = (stats.player1.wins / total) * 100;
  const drawPct = (stats.draws / total) * 100;
  const p2Pct = (stats.player2.wins / total) * 100;

  return (
    <div className="h2h-winloss">
      <div className="h2h-winloss-labels">
        <span className="h2h-winloss-count h2h-p1">{stats.player1.wins}W</span>
        {stats.draws > 0 && <span className="h2h-winloss-count h2h-draw">{stats.draws}D</span>}
        <span className="h2h-winloss-count h2h-p2">{stats.player2.wins}W</span>
      </div>
      <div className="h2h-winloss-bar">
        <div className="h2h-winloss-seg h2h-p1" style={{ width: `${p1Pct}%` }} />
        <div className="h2h-winloss-seg h2h-draw" style={{ width: `${drawPct}%` }} />
        <div className="h2h-winloss-seg h2h-p2" style={{ width: `${p2Pct}%` }} />
      </div>
      <div className="h2h-winloss-names">
        <span>{stats.player1.displayName}</span>
        <span>{stats.player2.displayName}</span>
      </div>
    </div>
  );
}

// ---------- Stat Comparison Row ----------

function CompareRow({
  label,
  v1,
  v2,
  higherIsBetter = true,
}: {
  label: string;
  v1: number | string | null;
  v2: number | string | null;
  higherIsBetter?: boolean;
}) {
  const n1 = typeof v1 === "number" ? v1 : null;
  const n2 = typeof v2 === "number" ? v2 : null;
  let winner: "p1" | "p2" | "none" = "none";
  if (n1 !== null && n2 !== null && n1 !== n2) {
    winner = higherIsBetter ? (n1 > n2 ? "p1" : "p2") : n1 < n2 ? "p1" : "p2";
  }
  return (
    <div className="h2h-compare-row">
      <span className={`h2h-compare-val ${winner === "p1" ? "winner" : ""}`}>{v1 ?? "–"}</span>
      <span className="h2h-compare-label">{label}</span>
      <span className={`h2h-compare-val ${winner === "p2" ? "winner" : ""}`}>{v2 ?? "–"}</span>
    </div>
  );
}

// ---------- Scoring Distribution Comparison ----------

function DistributionCompare({
  p1,
  p2,
  mode,
}: {
  p1: H2HPlayerStats;
  p2: H2HPlayerStats;
  mode: StatsMode;
}) {
  const items =
    mode === "stableford"
      ? [
          { label: "Eagle+", c1: p1.eagles, c2: p2.eagles, color: "#c084fc" },
          { label: "Birdie", c1: p1.birdies, c2: p2.birdies, color: "#3bc16b" },
          { label: "Par", c1: p1.pars, c2: p2.pars, color: "#5b9cf5" },
          { label: "Bogey", c1: p1.bogeys, c2: p2.bogeys, color: "#f5a623" },
          { label: "Dbl+", c1: p1.doublePlus, c2: p2.doublePlus, color: "#e5484d" },
        ]
      : [
          { label: "Under", c1: p1.strokesUnderPar, c2: p2.strokesUnderPar, color: "#3bc16b" },
          { label: "At par", c1: p1.strokesAtPar, c2: p2.strokesAtPar, color: "#5b9cf5" },
          { label: "Bogey", c1: p1.strokesOverOne, c2: p2.strokesOverOne, color: "#f5a623" },
          { label: "Double", c1: p1.strokesOverTwo, c2: p2.strokesOverTwo, color: "#fb923c" },
          {
            label: "Triple+",
            c1: p1.strokesOverThreePlus,
            c2: p2.strokesOverThreePlus,
            color: "#e5484d",
          },
        ];

  const maxCount = Math.max(...items.map((i) => Math.max(i.c1, i.c2)), 1);

  return (
    <div className="section">
      <h2>{mode === "stableford" ? "Scoring Distribution" : "Strokes vs Par"}</h2>
      <div className="h2h-dist">
        {items.map((item) => (
          <div key={item.label} className="h2h-dist-row">
            <span className="h2h-dist-val">{item.c1}</span>
            <div className="h2h-dist-bar-track right">
              <div
                className="h2h-dist-bar-fill"
                style={{
                  width: maxCount > 0 ? `${(item.c1 / maxCount) * 100}%` : "0%",
                  background: item.color,
                }}
              />
            </div>
            <span className="h2h-dist-label">{item.label}</span>
            <div className="h2h-dist-bar-track left">
              <div
                className="h2h-dist-bar-fill"
                style={{
                  width: maxCount > 0 ? `${(item.c2 / maxCount) * 100}%` : "0%",
                  background: item.color,
                }}
              />
            </div>
            <span className="h2h-dist-val">{item.c2}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Round History Trend Chart ----------

function H2HTrendChart({ stats, mode }: { stats: HeadToHeadStats; mode: StatsMode }) {
  const data = useMemo(() => [...stats.rounds].reverse(), [stats.rounds]);

  if (data.length < 2) return null;

  const p1Values = data.map((r) => (mode === "stableford" ? r.p1Points : r.p1Strokes));
  const p2Values = data.map((r) => (mode === "stableford" ? r.p2Points : r.p2Strokes));
  const allValues = [...p1Values, ...p2Values];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  const padding = range * 0.15;
  const yMin = Math.floor(minVal - padding);
  const yMax = Math.ceil(maxVal + padding);
  const yRange = yMax - yMin || 1;

  const W = 600;
  const H = 240;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  function x(i: number) {
    return pad.left + (i / (data.length - 1)) * plotW;
  }
  function y(val: number) {
    return pad.top + plotH - ((val - yMin) / yRange) * plotH;
  }

  const gridStep = yRange <= 10 ? 2 : yRange <= 30 ? 5 : yRange <= 60 ? 10 : 20;
  const gridLines: number[] = [];
  for (let v = Math.ceil(yMin / gridStep) * gridStep; v <= yMax; v += gridStep) {
    gridLines.push(v);
  }

  const p1Points = p1Values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const p2Points = p2Values.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  const labelStep = data.length <= 10 ? 1 : data.length <= 20 ? 2 : 3;

  return (
    <div className="section">
      <h2>{mode === "stableford" ? "Points Trend" : "Strokes Trend"}</h2>
      <div className="h2h-legend">
        <span className="h2h-legend-item">
          <span className="h2h-legend-dot" style={{ background: "#3bc16b" }} />
          {stats.player1.displayName}
        </span>
        <span className="h2h-legend-item">
          <span className="h2h-legend-dot" style={{ background: "#5b9cf5" }} />
          {stats.player2.displayName}
        </span>
      </div>
      <div className="stats-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
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
          {data.map((r, i) =>
            i % labelStep === 0 || i === data.length - 1 ? (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-dim)"
                transform={`rotate(-30, ${x(i)}, ${H - 6})`}
              >
                {formatDate(r.completedAt).replace(/\s\d{4}$/, "")}
              </text>
            ) : null,
          )}
          {/* Player 1 line */}
          <polyline
            fill="none"
            stroke="#3bc16b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={p1Points}
          />
          {p1Values.map((v, i) => (
            <circle key={`p1-${i}`} cx={x(i)} cy={y(v)} r="4" fill="#3bc16b" />
          ))}
          {/* Player 2 line */}
          <polyline
            fill="none"
            stroke="#5b9cf5"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={p2Points}
          />
          {p2Values.map((v, i) => (
            <circle key={`p2-${i}`} cx={x(i)} cy={y(v)} r="4" fill="#5b9cf5" />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ---------- Opponent Picker ----------

function OpponentPicker({
  opponents,
  onSelect,
}: {
  opponents: Opponent[];
  onSelect: (id: string) => void;
}) {
  if (opponents.length === 0) {
    return (
      <div className="empty-block">
        <p>No opponents found.</p>
        <p className="muted">Play rounds with other registered users to compare stats!</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>Choose an Opponent</h2>
      <ul className="list">
        {opponents.map((opp) => (
          <li key={opp.userId}>
            <button className="list-row h2h-opponent-btn" onClick={() => onSelect(opp.userId)}>
              <div>
                <div className="list-primary">{opp.displayName}</div>
                <div className="list-secondary">
                  @{opp.username} &middot; {opp.sharedRounds} shared round
                  {opp.sharedRounds !== 1 ? "s" : ""}
                </div>
              </div>
              <span className="chevron">&rsaquo;</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Main Page ----------

export default function HeadToHeadPage() {
  const { opponentId } = useParams<{ opponentId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<StatsMode>("stableford");

  const {
    data: opponents,
    loading: opponentsLoading,
    error: opponentsError,
  } = useAsync(
    () => (user ? api.getOpponents().then((r) => r.opponents) : Promise.resolve(null)),
    [user?.id],
  );

  const {
    data: h2hStats,
    loading: h2hLoading,
    error: h2hError,
  } = useAsync(
    () =>
      user && opponentId
        ? api.getHeadToHead(opponentId).then((r) => r.stats)
        : Promise.resolve(null),
    [user?.id, opponentId],
  );

  if (authLoading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Head to Head</h1>
        <p className="muted">
          <Link to="/login">Log in</Link> to compare stats.
        </p>
        <Link to="/stats" className="back-link">
          &larr; My Stats
        </Link>
      </div>
    );
  }

  // No opponent selected — show picker
  if (!opponentId) {
    if (opponentsLoading) {
      return (
        <div className="page">
          <h1>Head to Head</h1>
          <div className="muted">Loading opponents...</div>
        </div>
      );
    }
    if (opponentsError) {
      return (
        <div className="page">
          <h1>Head to Head</h1>
          <div className="error">{opponentsError}</div>
          <Link to="/stats" className="back-link">
            &larr; My Stats
          </Link>
        </div>
      );
    }
    return (
      <div className="page">
        <div className="page-header">
          <h1>Head to Head</h1>
        </div>
        <OpponentPicker opponents={opponents ?? []} onSelect={(id) => navigate(`/h2h/${id}`)} />
        <Link to="/stats" className="back-link">
          &larr; My Stats
        </Link>
      </div>
    );
  }

  // Opponent selected — show rivalry
  if (h2hLoading) {
    return (
      <div className="page">
        <h1>Head to Head</h1>
        <div className="muted">Loading rivalry...</div>
      </div>
    );
  }

  if (h2hError) {
    return (
      <div className="page">
        <h1>Head to Head</h1>
        <div className="error">{h2hError}</div>
        <Link to="/h2h" className="back-link">
          &larr; Pick opponent
        </Link>
      </div>
    );
  }

  if (!h2hStats || h2hStats.sharedRounds === 0) {
    return (
      <div className="page">
        <h1>Head to Head</h1>
        <div className="empty-block">
          <p>No shared rounds yet.</p>
          <p className="muted">Play a round together to see the rivalry!</p>
        </div>
        <Link to="/h2h" className="back-link">
          &larr; Pick opponent
        </Link>
      </div>
    );
  }

  const { player1: p1, player2: p2 } = h2hStats;

  return (
    <div className="page">
      <div className="page-header">
        <h1>
          {p1.displayName} vs {p2.displayName}
        </h1>
      </div>

      {/* Mode toggle */}
      <div className="stats-mode-toggle">
        <button
          className={`stats-mode-btn ${mode === "stableford" ? "active" : ""}`}
          onClick={() => setMode("stableford")}
        >
          Stableford
        </button>
        <button
          className={`stats-mode-btn ${mode === "strokes" ? "active" : ""}`}
          onClick={() => setMode("strokes")}
        >
          Strokes
        </button>
      </div>

      {/* Win/Loss bar */}
      <WinLossBar stats={h2hStats} />

      {/* Overview cards */}
      <div className="stats-overview">
        <div className="stats-card">
          <span className="stats-card-value">{h2hStats.sharedRounds}</span>
          <span className="stats-card-label">Rounds</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">
            {p1.wins}-{h2hStats.draws}-{p2.wins}
          </span>
          <span className="stats-card-label">W-D-L</span>
        </div>
        {mode === "stableford" ? (
          <>
            <div className="stats-card">
              <span className="stats-card-value">{p1.avgPoints}</span>
              <span className="stats-card-label">{p1.displayName} Avg</span>
            </div>
            <div className="stats-card">
              <span className="stats-card-value">{p2.avgPoints}</span>
              <span className="stats-card-label">{p2.displayName} Avg</span>
            </div>
          </>
        ) : (
          <>
            <div className="stats-card">
              <span className="stats-card-value">{p1.avgStrokes}</span>
              <span className="stats-card-label">{p1.displayName} Avg</span>
            </div>
            <div className="stats-card">
              <span className="stats-card-value">{p2.avgStrokes}</span>
              <span className="stats-card-label">{p2.displayName} Avg</span>
            </div>
          </>
        )}
      </div>

      {/* Stat comparison */}
      <div className="section">
        <h2>Comparison</h2>
        <div className="h2h-compare-header">
          <span>{p1.displayName}</span>
          <span>{p2.displayName}</span>
        </div>
        {mode === "stableford" ? (
          <>
            <CompareRow label="Avg Points" v1={p1.avgPoints} v2={p2.avgPoints} />
            <CompareRow label="Best Round" v1={p1.bestPoints} v2={p2.bestPoints} />
            <CompareRow label="Total Points" v1={p1.totalPoints} v2={p2.totalPoints} />
          </>
        ) : (
          <>
            <CompareRow
              label="Avg Strokes"
              v1={p1.avgStrokes}
              v2={p2.avgStrokes}
              higherIsBetter={false}
            />
            <CompareRow
              label="Best Round"
              v1={p1.bestStrokes || null}
              v2={p2.bestStrokes || null}
              higherIsBetter={false}
            />
            <CompareRow
              label="Total Strokes"
              v1={p1.totalStrokes}
              v2={p2.totalStrokes}
              higherIsBetter={false}
            />
          </>
        )}
      </div>

      {/* By hole type comparison */}
      <div className="section">
        <h2>By Hole Type</h2>
        <div className="h2h-compare-header">
          <span>{p1.displayName}</span>
          <span>{p2.displayName}</span>
        </div>
        {mode === "stableford" ? (
          <>
            <CompareRow label="Par 3 Avg" v1={p1.par3AvgPoints} v2={p2.par3AvgPoints} />
            <CompareRow label="Par 4 Avg" v1={p1.par4AvgPoints} v2={p2.par4AvgPoints} />
            <CompareRow label="Par 5 Avg" v1={p1.par5AvgPoints} v2={p2.par5AvgPoints} />
          </>
        ) : (
          <>
            <CompareRow
              label="Par 3 Avg"
              v1={p1.par3AvgStrokes}
              v2={p2.par3AvgStrokes}
              higherIsBetter={false}
            />
            <CompareRow
              label="Par 4 Avg"
              v1={p1.par4AvgStrokes}
              v2={p2.par4AvgStrokes}
              higherIsBetter={false}
            />
            <CompareRow
              label="Par 5 Avg"
              v1={p1.par5AvgStrokes}
              v2={p2.par5AvgStrokes}
              higherIsBetter={false}
            />
          </>
        )}
      </div>

      {/* Scoring distribution comparison */}
      <DistributionCompare p1={p1} p2={p2} mode={mode} />

      {/* Trend chart */}
      <H2HTrendChart stats={h2hStats} mode={mode} />

      {/* Round history */}
      {h2hStats.rounds.length > 0 && (
        <div className="section">
          <h2>Round History</h2>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Date</th>
                  <th>{p1.displayName.split(" ")[0]}</th>
                  <th>{p2.displayName.split(" ")[0]}</th>
                </tr>
              </thead>
              <tbody>
                {h2hStats.rounds.map((r) => (
                  <tr key={r.roomCode}>
                    <td>
                      <Link to={`/r/${r.roomCode}`} className="stats-course-link">
                        {r.courseName}
                      </Link>
                    </td>
                    <td className="stats-date">
                      {formatDate(r.completedAt).replace(/\s\d{4}$/, "")}
                    </td>
                    <td
                      className={`highlight-val ${r.winnerId === p1.userId ? "h2h-winner-cell" : ""}`}
                    >
                      {mode === "stableford" ? r.p1Points : r.p1Strokes}
                    </td>
                    <td
                      className={`highlight-val ${r.winnerId === p2.userId ? "h2h-winner-cell" : ""}`}
                    >
                      {mode === "stableford" ? r.p2Points : r.p2Strokes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link to="/h2h" className="back-link">
        &larr; Pick opponent
      </Link>
    </div>
  );
}
