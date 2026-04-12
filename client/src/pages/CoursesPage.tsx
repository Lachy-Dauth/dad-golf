import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import type { Course } from "@dad-golf/shared";
import { totalPar } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";
import StarRating from "../components/StarRating.js";
import { useAsync } from "../hooks/useAsync.js";

type Filter = "all" | "9" | "18" | "favorites" | "mine";
type Sort = "popular" | "top-rated" | "newest" | "az";

const PAGE_SIZE = 20;

export default function CoursesPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const {
    data: courses,
    error,
    execute: load,
  } = useAsync(() => api.listCourses().then((res) => res.courses), [user?.id]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("popular");
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Reset auth-dependent filters when user logs out
  useEffect(() => {
    if (!user && (filter === "favorites" || filter === "mine")) {
      setFilter("all");
    }
  }, [user, filter]);

  const filtered = useMemo(() => {
    if (!courses) return [];
    const q = search.toLowerCase().trim();
    let result = courses;

    // Search
    if (q) {
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.location?.toLowerCase().includes(q) ?? false),
      );
    }

    // Filter
    switch (filter) {
      case "9":
        result = result.filter((c) => c.holes.length === 9);
        break;
      case "18":
        result = result.filter((c) => c.holes.length === 18);
        break;
      case "favorites":
        result = result.filter((c) => c.isFavorite);
        break;
      case "mine":
        result = result.filter((c) => user && c.createdByUserId === user.id);
        break;
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "popular":
          return b.favoriteCount - a.favoriteCount || a.name.localeCompare(b.name);
        case "top-rated": {
          const ra = a.avgRating ?? -1;
          const rb = b.avgRating ?? -1;
          return rb - ra || b.ratingCount - a.ratingCount || a.name.localeCompare(b.name);
        }
        case "newest":
          return b.createdAt.localeCompare(a.createdAt);
        case "az":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [courses, search, filter, sort, user]);

  const visible = filtered.slice(0, displayCount);

  async function handleDelete(e: React.MouseEvent, c: Course) {
    e.stopPropagation();
    if (!user?.isAdmin && c.favoriteCount > 0) {
      setActionError("This course has favourites and cannot be deleted.");
      return;
    }
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await api.deleteCourse(c.id);
      load();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handleToggleFav(e: React.MouseEvent, c: Course) {
    e.stopPropagation();
    if (!user) {
      setActionError("Log in to favourite courses.");
      return;
    }
    try {
      if (c.isFavorite) await api.unfavoriteCourse(c.id);
      else await api.favoriteCourse(c.id);
      load();
    } catch (err) {
      setActionError((err as Error).message);
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
          <Link to="/login">Log in</Link> to add or favourite courses.
        </div>
      )}

      {/* Search */}
      <input
        className="course-search"
        type="text"
        placeholder="Search by name or location..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setDisplayCount(PAGE_SIZE);
        }}
      />

      {/* Filter tabs */}
      <div className="course-filters">
        {(
          [
            ["all", "All"],
            ["9", "9 Holes"],
            ["18", "18 Holes"],
            ...(user
              ? [["favorites", "Favourites"] as const, ["mine", "My Courses"] as const]
              : []),
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`course-filter-btn ${filter === key ? "active" : ""}`}
            onClick={() => {
              setFilter(key);
              setDisplayCount(PAGE_SIZE);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="course-sort">
        <label>
          Sort:{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="popular">Popular</option>
            <option value="top-rated">Top Rated</option>
            <option value="newest">Newest</option>
            <option value="az">A-Z</option>
          </select>
        </label>
      </div>

      {(error || actionError) && <div className="error">{error || actionError}</div>}
      {!courses && !error && <div className="muted">Loading...</div>}
      {courses && filtered.length === 0 && (
        <div className="muted">
          {courses.length === 0
            ? "No courses yet. Add one to get started."
            : "No courses match your search."}
        </div>
      )}

      {visible.length > 0 && (
        <ul className="course-list">
          {visible.map((c) => {
            const isOwner = user && c.createdByUserId === user.id;
            const isAdmin = user?.isAdmin ?? false;
            const canManage = isOwner || isAdmin;
            const canDelete = canManage && (isAdmin || c.favoriteCount === 0);
            return (
              <li key={c.id}>
                <div
                  className="course-card"
                  onClick={() => nav(`/courses/${c.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") nav(`/courses/${c.id}`);
                  }}
                >
                  <div className="course-card-body">
                    <div className="course-card-name">{c.name}</div>
                    {c.location && <div className="course-card-location">{c.location}</div>}
                    <div className="course-card-meta">
                      {c.holes.length} holes &middot; par {totalPar(c)} &middot; R{" "}
                      {c.rating.toFixed(1)} &middot; S {c.slope}
                    </div>
                    <div className="course-card-stats">
                      {c.avgRating != null ? (
                        <>
                          <StarRating value={Math.round(c.avgRating)} size="sm" />
                          <span>
                            {c.avgRating.toFixed(1)} ({c.ratingCount})
                          </span>
                        </>
                      ) : (
                        <span className="muted">No ratings</span>
                      )}
                      {c.favoriteCount > 0 && (
                        <span className="course-card-favs">&hearts; {c.favoriteCount}</span>
                      )}
                    </div>
                    {c.createdByName && (
                      <div className="course-card-creator">by {c.createdByName}</div>
                    )}
                  </div>
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    {user && (
                      <button
                        className={`btn-icon fav ${c.isFavorite ? "active" : ""}`}
                        onClick={(e) => handleToggleFav(e, c)}
                        title={c.isFavorite ? "Unfavourite" : "Favourite"}
                        aria-label="Favourite"
                      >
                        {c.isFavorite ? "\u2605" : "\u2606"}
                      </button>
                    )}
                    {canManage && (
                      <>
                        <Link
                          to={`/courses/${c.id}/edit`}
                          className="btn-icon"
                          title="Edit"
                          aria-label="Edit"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ✎
                        </Link>
                        <button
                          className="btn-icon"
                          onClick={(e) => handleDelete(e, c)}
                          disabled={!canDelete}
                          title={canDelete ? "Delete" : "Cannot delete: has favourites"}
                          aria-label="Delete"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length < filtered.length && (
        <button className="btn" onClick={() => setDisplayCount((n) => n + PAGE_SIZE)}>
          Load more ({filtered.length - visible.length} remaining)
        </button>
      )}

      <Link to="/" className="back-link">
        &larr; Back
      </Link>
    </div>
  );
}
