import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import type { Course } from "@dad-golf/shared";
import { totalPar } from "@dad-golf/shared";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .listCourses()
      .then((res) => setCourses(res.courses))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this course?")) return;
    try {
      await api.deleteCourse(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Courses</h1>
        <Link to="/courses/new" className="btn btn-primary">
          + New course
        </Link>
      </div>
      {error && <div className="error">{error}</div>}
      {!courses && <div className="muted">Loading…</div>}
      {courses && courses.length === 0 && (
        <div className="muted">No courses yet. Add one to get started.</div>
      )}
      {courses && courses.length > 0 && (
        <ul className="list">
          {courses.map((c) => (
            <li key={c.id}>
              <div className="list-row">
                <div>
                  <div className="list-primary">{c.name}</div>
                  <div className="list-secondary">
                    {c.location ? `${c.location} · ` : ""}
                    {c.holes.length} holes · par {totalPar(c)}
                  </div>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(c.id)}
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link to="/" className="back-link">
        ← Back
      </Link>
    </div>
  );
}
