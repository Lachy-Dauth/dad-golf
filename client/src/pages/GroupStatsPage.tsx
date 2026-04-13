import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { GroupStats, GroupMemberStats } from "../api.js";
import type { Group } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";
import { formatDate } from "../utils/dateFormat.js";

type StatsMode = "stableford" | "strokes";

const CHART_COLORS = [
  "#3bc16b",
  "#5b9cf5",
  "#f5a623",
  "#e5484d",
  "#c084fc",
  "#38bdf8",
  "#fb923c",
  "#a3e635",
  "#f472b6",
  "#22d3ee",
];

function recordLabel(type: string): string {
  switch (type) {
    case "best_points":
      return "Best Round (Points)";
    case "best_strokes":
      return "Best Round (Strokes)";
    case "most_eagles_round":
      return "Most Eagles in a Round";
    default:
      return type;
  }
}

// ---------- Member Leaderboard Bar Chart ----------

function LeaderboardChart({ members, mode }: { members: GroupMemberStats[]; mode: StatsMode }) {
  if (members.length === 0) return null;

  // Sort: for stableford, highest avg first; for strokes, lowest avg first (filtered to > 0)
  const sorted = [...members]
    .filter((m) => m.roundsPlayed > 0)
    .sort((a, b) =>
      mode === "stableford" ? b.avgPoints - a.avgPoints : a.avgStrokes - b.avgStrokes,
    );

  const values = sorted.map((m) => (mode === "stableford" ? m.avgPoints : m.avgStrokes));
  const maxVal = Math.max(...values, 1);

  return (
    <div className="section">
      <h2>
        All-Time Leaderboard{" "}
        <span className="section-sub">
          ({mode === "stableford" ? "avg pts/round" : "avg strokes/round"})
        </span>
      </h2>
      <div className="group-lb-chart">
        {sorted.map((m, i) => {
          const val = mode === "stableford" ? m.avgPoints : m.avgStrokes;
          const pct =
            mode === "stableford" ? (val / maxVal) * 100 : maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={m.playerId} className="group-lb-row">
              <span className="group-lb-pos">{i + 1}</span>
              <span className="group-lb-name">
                {m.userId ? (
                  <Link
                    to={`/user/${encodeURIComponent(m.playerName)}`}
                    className="stats-course-link"
                  >
                    {m.playerName}
                  </Link>
                ) : (
                  m.playerName
                )}
              </span>
              <div className="group-lb-bar-track">
                <div
                  className="group-lb-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
              <span className="group-lb-val">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Member Stats Table ----------

function MemberStatsTable({ members, mode }: { members: GroupMemberStats[]; mode: StatsMode }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (members.length === 0) return null;

  const sorted = [...members]
    .filter((m) => m.roundsPlayed > 0)
    .sort((a, b) =>
      mode === "stableford" ? b.avgPoints - a.avgPoints : a.avgStrokes - b.avgStrokes,
    );

  return (
    <div className="section">
      <h2>Member Breakdown</h2>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rounds</th>
              <th>Wins</th>
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
            {sorted.map((m, i) => (
              <>
                <tr
                  key={m.playerId}
                  className={`member-row ${expandedId === m.playerId ? "expanded" : ""}`}
                  onClick={() => setExpandedId(expandedId === m.playerId ? null : m.playerId)}
                >
                  <td>{i + 1}</td>
                  <td>
                    <span className="stats-course-link">{m.playerName}</span>
                  </td>
                  <td>{m.roundsPlayed}</td>
                  <td>{m.wins}</td>
                  {mode === "stableford" ? (
                    <>
                      <td className="highlight-val">{m.avgPoints}</td>
                      <td>{m.bestPoints}</td>
                    </>
                  ) : (
                    <>
                      <td className="highlight-val">{m.avgStrokes}</td>
                      <td>{m.bestStrokes || "–"}</td>
                    </>
                  )}
                </tr>
                {expandedId === m.playerId && (
                  <tr key={`${m.playerId}-detail`} className="member-detail-row">
                    <td colSpan={6}>
                      <MemberDetail member={m} mode={mode} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberDetail({ member: m, mode }: { member: GroupMemberStats; mode: StatsMode }) {
  const items =
    mode === "stableford"
      ? [
          { label: "Eagle+", count: m.eagles, color: "#c084fc" },
          { label: "Birdie", count: m.birdies, color: "#3bc16b" },
          { label: "Par", count: m.pars, color: "#5b9cf5" },
          { label: "Bogey", count: m.bogeys, color: "#f5a623" },
          { label: "Dbl+", count: m.doublePlus, color: "#e5484d" },
        ]
      : [
          { label: "Under", count: m.strokesUnderPar, color: "#3bc16b" },
          { label: "At par", count: m.strokesAtPar, color: "#5b9cf5" },
          { label: "Bogey", count: m.strokesOverOne, color: "#f5a623" },
          { label: "Double", count: m.strokesOverTwo, color: "#fb923c" },
          { label: "Triple+", count: m.strokesOverThreePlus, color: "#e5484d" },
        ];

  const total = items.reduce((sum, i) => sum + i.count, 0);
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="member-detail">
      <div className="member-detail-bars">
        {items.map((item) => (
          <div key={item.label} className="dist-row compact">
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
              {total > 0 ? `${Math.round((item.count / total) * 100)}%` : "–"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main Page ----------

export default function GroupStatsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StatsMode>("stableford");

  useEffect(() => {
    if (!id || !user) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getGroup(id).then((r) => setGroup(r.group)),
      api.getGroupStats(id).then((r) => setStats(r.stats)),
    ])
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  if (authLoading || loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Group Stats</h1>
        <p className="muted">
          <Link to="/login">Log in</Link> to see group stats.
        </p>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Group Stats</h1>
        <div className="error">{error}</div>
        <Link to={`/groups/${id}`} className="back-link">
          &larr; Back to group
        </Link>
      </div>
    );
  }

  if (!stats || stats.totalRounds === 0) {
    return (
      <div className="page">
        <h1>{group?.name ?? "Group"} Stats</h1>
        <div className="empty-block">
          <p>No completed rounds yet.</p>
          <p className="muted">Play your first group round to see stats here!</p>
        </div>
        <Link to={`/groups/${id}`} className="back-link">
          &larr; Back to group
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{group?.name ?? "Group"} Stats</h1>
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
          <span className="stats-card-value">{stats.memberStats.length}</span>
          <span className="stats-card-label">Players</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">{stats.totalHolesPlayed}</span>
          <span className="stats-card-label">Holes Played</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">{stats.courseStats.length}</span>
          <span className="stats-card-label">Courses</span>
        </div>
      </div>

      {/* Records */}
      {stats.records.length > 0 && (
        <div className="section">
          <h2>Group Records</h2>
          <div className="group-records">
            {stats.records.map((r) => (
              <Link to={`/r/${r.roomCode}`} key={r.type} className="group-record-card">
                <div className="group-record-type">{recordLabel(r.type)}</div>
                <div className="group-record-value">{r.value}</div>
                <div className="group-record-meta">
                  {r.playerName} at {r.courseName}
                </div>
                <div className="group-record-date">{formatDate(r.date)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All-time leaderboard */}
      <LeaderboardChart members={stats.memberStats} mode={mode} />

      {/* Member breakdown */}
      <MemberStatsTable members={stats.memberStats} mode={mode} />

      {/* Course breakdown */}
      {stats.courseStats.length > 0 && (
        <div className="section">
          <h2>Courses Played</h2>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Played</th>
                  {mode === "stableford" ? <th>Avg Winner Pts</th> : <th>Avg Strokes</th>}
                </tr>
              </thead>
              <tbody>
                {stats.courseStats.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <Link to={`/courses/${c.courseId}`} className="stats-course-link">
                        {c.courseName}
                      </Link>
                    </td>
                    <td>{c.timesPlayed}</td>
                    <td className="highlight-val">
                      {mode === "stableford" ? c.avgPoints : c.avgStrokes || "–"}
                    </td>
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
                  <th>Winner</th>
                  <th>{mode === "stableford" ? "Pts" : "Players"}</th>
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
                    <td>{r.winnerName ?? "–"}</td>
                    <td className="highlight-val">
                      {mode === "stableford" ? (r.winnerPoints ?? "–") : r.playerCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link to={`/groups/${id}`} className="back-link">
        &larr; Back to group
      </Link>
    </div>
  );
}
