import type { AdminStats, ActivityEvent } from "../../api.js";
import { formatDateTime } from "../../utils/dateFormat.js";

export interface DashboardTabProps {
  stats: AdminStats | null;
  events: ActivityEvent[];
  onSeed: () => void;
  seeding: boolean;
  seedResult: string | null;
}

export function DashboardTab({ stats, events, onSeed, seeding, seedResult }: DashboardTabProps) {
  if (!stats) return <div className="muted">Loading...</div>;
  return (
    <>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.users}</div>
          <div className="admin-stat-label">Users</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.rounds.total}</div>
          <div className="admin-stat-label">Rounds</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.rounds.inProgress}</div>
          <div className="admin-stat-label">Active Rounds</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.courses}</div>
          <div className="admin-stat-label">Courses</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.groups}</div>
          <div className="admin-stat-label">Groups</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.scores}</div>
          <div className="admin-stat-label">Scores</div>
        </div>
      </div>
      <h2 style={{ marginTop: 24 }}>Seed Demo Data</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        Create fake users, groups, activity events, and badges for testing.
      </p>
      <button className="btn btn-primary" onClick={onSeed} disabled={seeding}>
        {seeding ? "Seeding..." : "Seed Demo Data"}
      </button>
      {seedResult && (
        <div className="success" style={{ marginTop: 8 }}>
          {seedResult}
        </div>
      )}
      <h2 style={{ marginTop: 24 }}>Recent Activity</h2>
      {events.length === 0 ? (
        <div className="muted">No activity yet.</div>
      ) : (
        <div className="list">
          {events.slice(0, 10).map((e) => (
            <div key={`${e.timestamp}-${e.description}`} className="list-row">
              <div>
                <div className="list-primary">{e.description}</div>
                <div className="list-secondary">{formatDateTime(e.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
