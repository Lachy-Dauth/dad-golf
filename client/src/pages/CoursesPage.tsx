import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import type { Course } from "@dad-golf/shared";
import { totalPar } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";

export default function CoursesPage() {
  const { user } = useAuth();
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
  }, [user?.id]);

  async function handleDelete(c: Course) {
    if (c.favoriteCount > 0) {
      alert("This course has favourites and cannot be deleted.");
      return;
    }
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await api.deleteCourse(c.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleToggleFav(c: Course) {
    if (!user) {
      alert("Sign in to favourite courses.");
      return;
    }
    try {
      if (c.isFavorite) await api.unfavoriteCourse(c.id);
      else await api.favoriteCourse(c.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Courses</h1>
        {user && (
          <Link to="/courses/new" className="btn btn-primary">
            + New course
          </Link>
        )}
      </div>
      {!user && (
        <div className="muted">
          <Link to="/login">Sign in</Link> to add or favourite courses.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {!courses && <div className="muted">Loading…</div>}
      {courses && courses.length === 0 && (
        <div className="muted">No courses yet. Add one to get started.</div>
      )}
      {courses && courses.length > 0 && (
        <ul className="list">
          {courses.map((c) => {
            const isOwner = user && c.createdByUserId === user.id;
            const canDelete = isOwner && c.favoriteCount === 0;
            return (
              <li key={c.id}>
                <div className="list-row">
                  <div>
                    <div className="list-primary">{c.name}</div>
                    <div className="list-secondary">
                      {c.location ? `${c.location} · ` : ""}
                      {c.holes.length} holes · par {totalPar(c)}
                      {c.createdByName && ` · by ${c.createdByName}`}
                      {c.favoriteCount > 0 &&
                        ` · ★ ${c.favoriteCount}`}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button
                      className={`btn-icon fav ${c.isFavorite ? "active" : ""}`}
                      onClick={() => handleToggleFav(c)}
                      title={c.isFavorite ? "Unfavourite" : "Favourite"}
                      aria-label="Favourite"
                    >
                      {c.isFavorite ? "★" : "☆"}
                    </button>
                    {isOwner && (
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(c)}
                        disabled={!canDelete}
                        title={
                          canDelete
                            ? "Delete"
                            : "Cannot delete: has favourites"
                        }
                        aria-label="Delete"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Link to="/" className="back-link">
        ← Back
      </Link>
    </div>
  );
}
