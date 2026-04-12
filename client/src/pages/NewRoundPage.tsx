import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import type { Course, Group, GroupMember } from "@dad-golf/shared";
import { addRecentRound } from "../localStore.js";
import { useAuth } from "../AuthContext.js";
import CoursePicker from "../components/CoursePicker.js";

export default function NewRoundPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Array<Group & { members: GroupMember[] }>>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    Promise.all([api.listCourses(), api.listGroups()])
      .then(([c, g]) => {
        setCourses(c.courses);
        setGroups(g.groups);
        // Pre-select from query param or default to first course
        const preselect = searchParams.get("courseId");
        if (preselect && c.courses.some((course) => course.id === preselect)) {
          setCourseId(preselect);
        } else if (c.courses[0]) {
          setCourseId(c.courses[0].id);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authLoading, searchParams]);

  const myGroups = useMemo(() => {
    if (!user) return [];
    return groups.filter((g) => g.members.some((m) => m.userId === user.id));
  }, [groups, user]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId) ?? null,
    [groups, groupId],
  );

  // When the user picks a group, default to selecting only themselves; they
  // can then opt other members in.
  useEffect(() => {
    if (!selectedGroup || !user) {
      setSelectedMemberIds(new Set());
      return;
    }
    const me = selectedGroup.members.find((m) => m.userId === user.id);
    setSelectedMemberIds(new Set(me ? [me.id] : []));
  }, [selectedGroup, user]);

  function toggleMember(memberId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function selectAll() {
    if (!selectedGroup) return;
    setSelectedMemberIds(new Set(selectedGroup.members.map((m) => m.id)));
  }

  function selectNone() {
    setSelectedMemberIds(new Set());
  }

  async function handleCreate() {
    if (!courseId) {
      setError("Pick a course");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api.createRound({
        courseId,
        groupId: groupId || null,
        memberIds: Array.from(selectedMemberIds),
      });
      addRecentRound({
        roomCode: res.state.round.roomCode,
        courseName: res.state.course.name,
        joinedAt: new Date().toISOString(),
      });
      nav(`/r/${res.state.round.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

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
        <h1>Start a round</h1>
        <p className="muted">You need to log in to start a round.</p>
        <Link to={`/login?next=${encodeURIComponent("/rounds/new")}`} className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Start a round</h1>
      {courses.length === 0 ? (
        <div className="empty-block">
          <p>You need a course before you can start a round.</p>
          <Link to="/courses/new" className="btn btn-primary">
            Add your first course
          </Link>
        </div>
      ) : (
        <div className="form">
          <div className="field">
            <span>Course</span>
            <CoursePicker courses={courses} value={courseId} onChange={setCourseId} />
          </div>

          <label className="field">
            <span>Golf group (optional)</span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">— None —</option>
              {myGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members.length} members)
                </option>
              ))}
            </select>
          </label>

          {selectedGroup && (
            <section className="section">
              <div className="section-header">
                <h2>Players from group</h2>
                <div className="row-actions">
                  <button type="button" className="btn" onClick={selectAll}>
                    Add everyone
                  </button>
                  <button type="button" className="btn" onClick={selectNone}>
                    Clear
                  </button>
                </div>
              </div>
              {selectedGroup.members.length === 0 ? (
                <div className="muted">This group has no members yet.</div>
              ) : (
                <ul className="player-grid">
                  {selectedGroup.members.map((m) => {
                    const checked = selectedMemberIds.has(m.id);
                    return (
                      <li
                        key={m.id}
                        className={`player-card selectable ${checked ? "me" : ""}`}
                        onClick={() => toggleMember(m.id)}
                      >
                        <div className="player-name">{m.name}</div>
                        <div className="player-hcp">GA HCP {m.handicap.toFixed(1)}</div>
                        <div className="player-toggle">
                          {checked ? "\u2713 added" : "tap to add"}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="muted">
                You'll be added automatically as the round leader. Anyone with the link can also
                join after the round is created.
              </p>
            </section>
          )}

          {error && <div className="error">{error}</div>}

          <div className="form-actions">
            <Link to="/" className="btn">
              Cancel
            </Link>
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create round"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
