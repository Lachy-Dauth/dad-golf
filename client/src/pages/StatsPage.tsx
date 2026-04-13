import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import type { UserStats } from "../api.js";
import { useAuth } from "../AuthContext.js";
import { useAsync } from "../hooks/useAsync.js";
import { formatDate } from "../utils/dateFormat.js";

type StatsMode = "stableford" | "strokes";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------- SVG Trend Chart ----------

const CHART_COLORS = {
  line: "#3bc16b",
  strokesLine: "#5b9cf5",
  dot: "#3bc16b",
  strokesDot: "#5b9cf5",
};

function TrendChart({ rounds, mode }: { rounds: UserStats["recentRounds"]; mode: StatsMode }) {
  const data = useMemo(() => {
    // Reverse so oldest is left, newest is right
    return [...rounds].reverse();
  }, [rounds]);

  if (data.length < 2) return null;

  const values = data.map((r) => (mode === "stableford" ? r.totalPoints : r.totalStrokes));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padding = range * 0.1;
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

  const lineColor = mode === "stableford" ? CHART_COLORS.line : CHART_COLORS.strokesLine;
  const dotColor = mode === "stableford" ? CHART_COLORS.dot : CHART_COLORS.strokesDot;

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  // Show x-axis labels for every Nth round to avoid overlap
  const labelStep = data.length <= 10 ? 1 : data.length <= 20 ? 2 : 3;

  return (
    <div className="section">
      <h2>{mode === "stableford" ? "Points Trend" : "Strokes Trend"}</h2>
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
          {/* Area fill */}
          <polygon
            fill={lineColor}
            opacity="0.08"
            points={`${x(0)},${y(yMin)} ${points} ${x(data.length - 1)},${y(yMin)}`}
          />
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points}
          />
          {values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={dotColor} />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ---------- Scoring Distribution Bar Chart ----------

function ScoringDistribution({ stats, mode }: { stats: UserStats; mode: StatsMode }) {
  const items =
    mode === "stableford"
      ? [
          { label: "Eagle+", count: stats.eagles, color: "#c084fc" },
          { label: "Birdie", count: stats.birdies, color: "#3bc16b" },
          { label: "Par", count: stats.pars, color: "#5b9cf5" },
          { label: "Bogey", count: stats.bogeys, color: "#f5a623" },
          { label: "Dbl+", count: stats.doublePlus, color: "#e5484d" },
        ]
      : [
          { label: "Under par", count: stats.strokesUnderPar, color: "#3bc16b" },
          { label: "At par", count: stats.strokesAtPar, color: "#5b9cf5" },
          { label: "Bogey", count: stats.strokesOverOne, color: "#f5a623" },
          { label: "Double", count: stats.strokesOverTwo, color: "#fb923c" },
          { label: "Triple+", count: stats.strokesOverThreePlus, color: "#e5484d" },
        ];

  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return null;
  const maxCount = Math.max(...items.map((i) => i.count));

  return (
    <div className="section">
      <h2>{mode === "stableford" ? "Scoring Distribution" : "Strokes vs Par"}</h2>
      <div className="score-dist-chart">
        {items.map((item) => (
          <div key={item.label} className="dist-row">
            <span className="dist-label">{item.label}</span>
            <div className="dist-bar-track">
              <div
                className="dist-bar-fill"
                style={{
                  width: maxCount > 0 ? `${(item.count / maxCount) * 100}%` : "0%",
                  background: item.color,
                }}
              />
            </div>
            <span className="dist-count">{item.count}</span>
            <span className="dist-pct">
              {total > 0 ? `${Math.round((item.count / total) * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main StatsPage ----------

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<StatsMode>("stableford");
  const {
    data: stats,
    loading,
    error,
  } = useAsync(
    () => (user ? api.getStats().then((r) => r.stats) : Promise.resolve(null)),
    [user?.id],
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
        <h1>My Stats</h1>
        <p className="muted">
          <Link to="/login">Log in</Link> to see your stats.
        </p>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <h1>My Stats</h1>
        <div className="muted">Loading stats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>My Stats</h1>
        <div className="error">{error}</div>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  if (!stats || stats.totalRounds === 0) {
    return (
      <div className="page">
        <h1>My Stats</h1>
        <div className="empty-block">
          <p>No completed rounds yet.</p>
          <p className="muted">Play your first round to see stats here!</p>
        </div>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  const winRate = stats.totalRounds > 0 ? Math.round((stats.wins / stats.totalRounds) * 100) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Stats</h1>
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

      {/* Overview cards */}
      <div className="stats-overview">
        <div className="stats-card">
          <span className="stats-card-value">{stats.totalRounds}</span>
          <span className="stats-card-label">Rounds</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">{stats.wins}</span>
          <span className="stats-card-label">Wins ({winRate}%)</span>
        </div>
        {mode === "stableford" ? (
          <>
            <div className="stats-card">
              <span className="stats-card-value">{stats.avgPointsPerRound ?? "–"}</span>
              <span className="stats-card-label">Avg Points</span>
            </div>
            <div className="stats-card highlight">
              <span className="stats-card-value">{stats.bestRoundPoints ?? "–"}</span>
              <span className="stats-card-label">
                Best{stats.bestRoundCourse ? ` (${stats.bestRoundCourse})` : ""}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="stats-card">
              <span className="stats-card-value">{stats.avgStrokesPerRound ?? "–"}</span>
              <span className="stats-card-label">Avg Strokes</span>
            </div>
            <div className="stats-card highlight">
              <span className="stats-card-value">{stats.bestStrokesRoundStrokes ?? "–"}</span>
              <span className="stats-card-label">
                Best{stats.bestStrokesRoundCourse ? ` (${stats.bestStrokesRoundCourse})` : ""}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Scoring distribution */}
      <ScoringDistribution stats={stats} mode={mode} />

      {/* Trend chart */}
      <TrendChart rounds={stats.recentRounds} mode={mode} />

      {/* Performance by par */}
      <div className="section">
        <h2>By Hole Type</h2>
        <div className="par-type-grid">
          <ParTypeCard
            label="Par 3"
            avgPoints={stats.par3AvgPoints}
            avgStrokes={stats.par3AvgStrokes}
            par={3}
            mode={mode}
          />
          <ParTypeCard
            label="Par 4"
            avgPoints={stats.par4AvgPoints}
            avgStrokes={stats.par4AvgStrokes}
            par={4}
            mode={mode}
          />
          <ParTypeCard
            label="Par 5"
            avgPoints={stats.par5AvgPoints}
            avgStrokes={stats.par5AvgStrokes}
            par={5}
            mode={mode}
          />
        </div>
      </div>

      {/* Course performance */}
      {stats.courseStats.length > 0 && (
        <div className="section">
          <h2>By Course</h2>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Played</th>
                  {mode === "stableford" ? (
                    <>
                      <th>Avg Pts</th>
                      <th>Best</th>
                    </>
                  ) : (
                    <>
                      <th>Avg</th>
                      <th>Best</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {stats.courseStats.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <Link to={`/courses/${c.courseId}`} className="stats-course-link">
                        {c.courseName}
                      </Link>
                      {c.courseLocation && (
                        <span className="stats-course-loc">{c.courseLocation}</span>
                      )}
                    </td>
                    <td>{c.timesPlayed}</td>
                    {mode === "stableford" ? (
                      <>
                        <td>{c.avgPoints}</td>
                        <td className="highlight-val">{c.bestPoints}</td>
                      </>
                    ) : (
                      <>
                        <td>{c.avgStrokes}</td>
                        <td className="highlight-val">{c.bestStrokes}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent rounds */}
      {stats.recentRounds.length > 0 && (
        <div className="section">
          <h2>Recent Rounds</h2>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Date</th>
                  {mode === "stableford" ? <th>Points</th> : <th>Score</th>}
                  <th>Pos</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRounds.map((r) => (
                  <tr key={r.roomCode}>
                    <td>
                      <Link to={`/r/${r.roomCode}`} className="stats-course-link">
                        {r.courseName}
                      </Link>
                    </td>
                    <td className="stats-date">
                      {formatDate(r.completedAt).replace(/\s\d{4}$/, "")}
                    </td>
                    {mode === "stableford" ? (
                      <td className="highlight-val">{r.totalPoints}</td>
                    ) : (
                      <td className="highlight-val">
                        {r.totalStrokes}
                        <span className="stats-par-diff">
                          {r.totalStrokes - r.coursePar >= 0 ? "+" : ""}
                          {r.totalStrokes - r.coursePar}
                        </span>
                      </td>
                    )}
                    <td>
                      {ordinal(r.position)}
                      <span className="stats-of"> / {r.playerCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <Link to="/h2h" className="btn btn-primary" style={{ display: "inline-block" }}>
          Head to Head
        </Link>
      </div>

      <Link to="/" className="back-link">
        &larr; Home
      </Link>
    </div>
  );
}

// ---------- Sub-components ----------

function ParTypeCard({
  label,
  avgPoints,
  avgStrokes,
  par,
  mode,
}: {
  label: string;
  avgPoints: number | null;
  avgStrokes: number | null;
  par: number;
  mode: StatsMode;
}) {
  const hasData = mode === "stableford" ? avgPoints !== null : avgStrokes !== null;
  const value = mode === "stableford" ? avgPoints : avgStrokes;
  const subtitle =
    mode === "stableford"
      ? "avg pts/hole"
      : avgStrokes !== null
        ? `${avgStrokes > par ? "+" : ""}${(avgStrokes - par).toFixed(1)} vs par`
        : "";

  return (
    <div className="par-type-card">
      <div className="par-type-label">{label}</div>
      <div className="par-type-value">{hasData ? value : "–"}</div>
      {hasData && <div className="par-type-sub">{subtitle}</div>}
    </div>
  );
}
