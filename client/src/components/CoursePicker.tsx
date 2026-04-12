import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Course } from "@dad-golf/shared";

interface Props {
  courses: Course[];
  value: string;
  onChange: (courseId: string) => void;
}

export default function CoursePicker({ courses, value, onChange }: Props) {
  const [search, setSearch] = useState("");

  const { favorites, rest } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q ? courses.filter((c) => c.name.toLowerCase().includes(q)) : courses;
    const favs = filtered.filter((c) => c.isFavorite).sort((a, b) => a.name.localeCompare(b.name));
    const others = filtered
      .filter((c) => !c.isFavorite)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { favorites: favs, rest: others };
  }, [courses, search]);

  return (
    <div className="course-picker">
      <input
        className="course-picker-search"
        type="text"
        placeholder="Search courses..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="course-picker-list">
        {favorites.length > 0 && (
          <>
            <div className="course-picker-group-label">Favourites</div>
            {favorites.map((c) => (
              <label
                key={c.id}
                className={`course-picker-item ${value === c.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="course"
                  checked={value === c.id}
                  onChange={() => onChange(c.id)}
                />
                <span className="course-picker-name">{c.name}</span>
                <span className="course-picker-holes">({c.holes.length} holes)</span>
              </label>
            ))}
          </>
        )}
        {rest.length > 0 && (
          <>
            <div className="course-picker-group-label">
              {favorites.length > 0 ? "All Courses" : "Courses"}
            </div>
            {rest.map((c) => (
              <label
                key={c.id}
                className={`course-picker-item ${value === c.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="course"
                  checked={value === c.id}
                  onChange={() => onChange(c.id)}
                />
                <span className="course-picker-name">{c.name}</span>
                <span className="course-picker-holes">({c.holes.length} holes)</span>
              </label>
            ))}
          </>
        )}
        {favorites.length === 0 && rest.length === 0 && (
          <div className="muted" style={{ padding: "8px 0" }}>
            No courses match your search.
          </div>
        )}
      </div>
      <Link to="/courses/new" className="course-picker-add">
        + Add a new course
      </Link>
    </div>
  );
}
