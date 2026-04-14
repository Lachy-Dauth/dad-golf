import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.js";
import {
  api,
  type AdminStats,
  type AdminUser,
  type AdminRound,
  type AdminCourse,
  type AdminCourseReport,
  type AdminGroup,
  type ActivityEvent,
} from "../api.js";
import { DashboardTab } from "./admin/DashboardTab.js";
import { UsersTab } from "./admin/UsersTab.js";
import { RoundsTab } from "./admin/RoundsTab.js";
import { CoursesTab } from "./admin/CoursesTab.js";
import { GroupsTab } from "./admin/GroupsTab.js";
import { ReportsTab } from "./admin/ReportsTab.js";
import { ActivityTab } from "./admin/ActivityTab.js";

type Tab = "dashboard" | "users" | "rounds" | "courses" | "groups" | "reports" | "activity";

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
  const [reports, setReports] = useState<AdminCourseReport[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

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
      case "reports":
        api
          .adminCourseReports()
          .then((r) => setReports(r.reports))
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

  async function handleDismissReports(courseId: string) {
    if (!confirm("Dismiss all reports for this course?")) return;
    try {
      await api.adminDismissCourseReports(courseId);
      setReports((prev) => prev.filter((r) => r.courseId !== courseId));
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

  async function handleSeedActivity() {
    setSeeding(true);
    setSeedResult(null);
    setError(null);
    try {
      const result = await api.adminSeedActivity();
      setSeedResult(result.summary);
      // Refresh stats and activity
      api
        .adminStats()
        .then(setStats)
        .catch(() => {});
      api
        .adminActivity(20)
        .then((r) => setEvents(r.events))
        .catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "users", label: "Users" },
    { key: "rounds", label: "Rounds" },
    { key: "courses", label: "Courses" },
    { key: "groups", label: "Groups" },
    { key: "reports", label: "Reports" },
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
        {tab === "dashboard" && (
          <DashboardTab
            stats={stats}
            events={events}
            onSeed={handleSeedActivity}
            seeding={seeding}
            seedResult={seedResult}
          />
        )}
        {tab === "users" && (
          <UsersTab users={users} currentUserId={user.id} onDelete={handleDeleteUser} />
        )}
        {tab === "rounds" && (
          <RoundsTab rounds={rounds} total={roundsTotal} onDelete={handleDeleteRound} />
        )}
        {tab === "courses" && <CoursesTab courses={courses} />}
        {tab === "groups" && <GroupsTab groups={groups} />}
        {tab === "reports" && <ReportsTab reports={reports} onDismiss={handleDismissReports} />}
        {tab === "activity" && <ActivityTab events={events} />}
      </div>
      <Link to="/" className="back-link">
        Home
      </Link>
    </div>
  );
}
