import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import type { Course, Group, GroupMember } from "@dad-golf/shared";
import { addRecentRound } from "../localStore.js";

export default function NewRoundPage() {
  const nav = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<
    Array<Group & { members: GroupMember[] }>
  >([]);
  const [courseId, setCourseId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [importMembers, setImportMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.listCourses(), api.listGroups()])
      .then(([c, g]) => {
        setCourses(c.courses);
        setGroups(g.groups);
        if (c.courses[0]) setCourseId(c.courses[0].id);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
        importGroupMembers: Boolean(groupId) && importMembers,
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

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
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
          <label className="field">
            <span>Course</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.holes.length} holes)
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Golf group (optional)</span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">— None —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members.length} members)
                </option>
              ))}
            </select>
          </label>

          {groupId && (
            <label className="field check">
              <input
                type="checkbox"
                checked={importMembers}
                onChange={(e) => setImportMembers(e.target.checked)}
              />
              <span>Pre-add all group members as players</span>
            </label>
          )}

          {error && <div className="error">{error}</div>}

          <div className="form-actions">
            <Link to="/" className="btn">
              Cancel
            </Link>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create round"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
