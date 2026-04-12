import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.js";
import {
  api,
  type AdminStats,
  type AdminUser,
  type AdminRound,
  type AdminCourse,
  type AdminGroup,
  type ActivityEvent,
} from "../api.js";

type Tab = "dashboard" | "users" | "rounds" | "courses" | "groups" | "activity";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "badge badge-complete"
      : status === "in_progress"
        ? "badge badge-active"
        : "badge badge-waiting";
  const label =
    status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cls}>{label}</span>;
}

// ---------- Tab content components ----------

function DashboardTab({ stats, events }: { stats: AdminStats | null; events: ActivityEvent[] }) {
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

function UsersTab({
  users,
  currentUserId,
  onDelete,
}: {
  users: AdminUser[];
  currentUserId: string;
  onDelete: (id: string, username: string) => void;
}) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Display Name</th>
            <th>Handicap</th>
            <th>Rounds</th>
            <th>Courses</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                @{u.username}
                {u.isAdmin && (
                  <span className="badge badge-active" style={{ marginLeft: 6 }}>
                    admin
                  </span>
                )}
              </td>
              <td>{u.displayName}</td>
              <td>{u.handicap.toFixed(1)}</td>
              <td>{u.roundCount}</td>
              <td>{u.courseCount}</td>
              <td>{formatDate(u.createdAt)}</td>
              <td>
                {u.id !== currentUserId && (
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDelete(u.id, u.username)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoundsTab({
  rounds,
  total,
  onDelete,
}: {
  rounds: AdminRound[];
  total: number;
  onDelete: (id: string, roomCode: string) => void;
}) {
  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>
        {total} total round{total !== 1 ? "s" : ""}
      </div>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Course</th>
              <th>Leader</th>
              <th>Players</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/r/${r.roomCode}`}>{r.roomCode}</Link>
                </td>
                <td>{r.courseName}</td>
                <td>{r.leaderName ?? "-"}</td>
                <td>{r.playerCount}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{formatDate(r.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDelete(r.id, r.roomCode)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CoursesTab({ courses }: { courses: AdminCourse[] }) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Holes</th>
            <th>Creator</th>
            <th>Favorites</th>
            <th>Rounds</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.location ?? "-"}</td>
              <td>{c.holeCount}</td>
              <td>{c.createdByName ?? "-"}</td>
              <td>{c.favoriteCount}</td>
              <td>{c.roundCount}</td>
              <td>{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupsTab({ groups }: { groups: AdminGroup[] }) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Members</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td>{g.ownerName ?? "-"}</td>
              <td>{g.memberCount}</td>
              <td>{formatDate(g.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return <div className="muted">No activity yet.</div>;
  return (
    <div className="list">
      {events.map((e) => (
        <div key={`${e.timestamp}-${e.type}-${e.description}`} className="list-row">
          <div>
            <div className="list-primary">{e.description}</div>
            <div className="list-secondary">{formatDateTime(e.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Main AdminPage ----------

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [roundsTotal, setRoundsTotal] = useState(0);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadTab = useCallback((t: Tab) => {
    setError(null);
    switch (t) {
      case "dashboard":
        api
          .adminStats()
          .then(setStats)
          .catch((e) => setError((e as Error).message));
        api
          .adminActivity(20)
          .then((r) => setEvents(r.events))
          .catch(() => {});
        break;
      case "users":
        api
          .adminUsers()
          .then((r) => setUsers(r.users))
          .catch((e) => setError((e as Error).message));
        break;
      case "rounds":
        api
          .adminRounds(100, 0)
          .then((r) => {
            setRounds(r.rounds);
            setRoundsTotal(r.total);
          })
          .catch((e) => setError((e as Error).message));
        break;
      case "courses":
        api
          .adminCourses()
          .then((r) => setCourses(r.courses))
          .catch((e) => setError((e as Error).message));
        break;
      case "groups":
        api
          .adminGroups()
          .then((r) => setGroups(r.groups))
          .catch((e) => setError((e as Error).message));
        break;
      case "activity":
        api
          .adminActivity(100)
          .then((r) => setEvents(r.events))
          .catch((e) => setError((e as Error).message));
        break;
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) return;
    loadTab(tab);
  }, [tab, user, loadTab]);

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="muted">You must be logged in to view this page.</div>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="page">
        <h1>Access Denied</h1>
        <div className="muted">You do not have admin privileges.</div>
        <Link to="/" className="back-link">
          Home
        </Link>
      </div>
    );
  }

  async function handleDeleteRound(id: string, roomCode: string) {
    if (!confirm(`Delete round ${roomCode}? This will also delete all players and scores.`)) return;
    try {
      await api.adminDeleteRound(id);
      setRounds((prev) => prev.filter((r) => r.id !== id));
      setRoundsTotal((prev) => prev - 1);
      api
        .adminStats()
        .then(setStats)
        .catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDeleteUser(id: string, username: string) {
    if (
      !confirm(
        `Delete user @${username}? This will delete their account. Some related content may remain but no longer be associated with this user.`,
      )
    )
      return;
    try {
      await api.adminDeleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      // Refresh stats
      api
        .adminStats()
        .then(setStats)
        .catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "users", label: "Users" },
    { key: "rounds", label: "Rounds" },
    { key: "courses", label: "Courses" },
    { key: "groups", label: "Groups" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="page">
      <h1>Admin</h1>
      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`admin-tab${tab === t.key ? " admin-tab-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="admin-content">
        {tab === "dashboard" && <DashboardTab stats={stats} events={events} />}
        {tab === "users" && (
          <UsersTab users={users} currentUserId={user.id} onDelete={handleDeleteUser} />
        )}
        {tab === "rounds" && (
          <RoundsTab rounds={rounds} total={roundsTotal} onDelete={handleDeleteRound} />
        )}
        {tab === "courses" && <CoursesTab courses={courses} />}
        {tab === "groups" && <GroupsTab groups={groups} />}
        {tab === "activity" && <ActivityTab events={events} />}
      </div>
      <Link to="/" className="back-link">
        Home
      </Link>
    </div>
  );
}
