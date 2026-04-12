import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { Course, Hole } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";

function defaultHoles(count: 9 | 18): Hole[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokeIndex: i + 1,
  }));
}

export default function NewCoursePage() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState<string>("72.0");
  const [slope, setSlope] = useState<string>("113");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<Hole[]>(defaultHoles(18));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(isEdit);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all courses for duplicate detection (only on create, not edit)
  useEffect(() => {
    if (!isEdit) {
      api
        .listCourses()
        .then((res) => setAllCourses(res.courses))
        .catch(() => {});
    }
  }, [isEdit]);

  const [debouncedName, setDebouncedName] = useState("");
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedName(name), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  const similarCourses = useMemo(() => {
    if (isEdit || debouncedName.trim().length < 3) return [];
    const q = debouncedName.toLowerCase().trim();
    return allCourses.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [allCourses, debouncedName, isEdit]);

  useEffect(() => {
    if (!id) {
      setError(null);
      setLoadingCourse(false);
      return;
    }

    setLoadingCourse(true);
    setError(null);
    setName("");
    setLocation("");
    setRating("72.0");
    setSlope("113");
    setHoleCount(18);
    setHoles(defaultHoles(18));

    api
      .getCourse(id)
      .then(({ course }) => {
        setName(course.name);
        setLocation(course.location ?? "");
        setRating(course.rating.toFixed(1));
        setSlope(String(course.slope));
        setHoleCount(course.holes.length as 9 | 18);
        setHoles(course.holes);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingCourse(false));
  }, [id]);

  function handleHoleCountChange(count: 9 | 18) {
    setHoleCount(count);
    setHoles(defaultHoles(count));
  }

  function updateHole(i: number, patch: Partial<Hole>) {
    setHoles((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Course name is required");
      return;
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 10 || ratingNum > 100) {
      setError("Course rating must be a number between 10 and 100");
      return;
    }
    const slopeNum = Number(slope);
    if (!Number.isInteger(slopeNum) || slopeNum < 55 || slopeNum > 155) {
      setError("Slope rating must be a whole number between 55 and 155");
      return;
    }
    const siSet = new Set(holes.map((h) => h.strokeIndex));
    if (siSet.size !== holes.length) {
      setError("Stroke indexes must all be unique (1–" + holes.length + ")");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        location: location.trim() || null,
        rating: ratingNum,
        slope: slopeNum,
        holes,
      };
      if (isEdit && id) {
        await api.updateCourse(id, payload);
        nav("/courses");
      } else {
        const res = await api.createCourse(payload);
        nav(`/courses/${res.course.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingCourse) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>{isEdit ? "Edit course" : "New course"}</h1>
        <p className="muted">You need to log in to {isEdit ? "edit" : "create"} a course.</p>
        <Link
          to={`/login?next=${encodeURIComponent(isEdit ? `/courses/${id}/edit` : "/courses/new")}`}
          className="btn btn-primary"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{isEdit ? "Edit course" : "New course"}</h1>
      <div className="form">
        <label className="field">
          <span>Course name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pebble Creek Municipal"
          />
        </label>
        {similarCourses.length > 0 && (
          <div className="duplicate-hint">
            <span>Similar courses already exist:</span>
            <ul>
              {similarCourses.map((c) => (
                <li key={c.id}>
                  <Link to={`/courses/${c.id}`}>
                    {c.name}
                    {c.location ? ` (${c.location})` : ""} &mdash; {c.holes.length} holes
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="field">
          <span>Location (optional)</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Wembley Downs, Perth"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Course rating</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={50}
              max={90}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="e.g. 72.4"
            />
          </label>
          <label className="field">
            <span>Slope rating</span>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min={55}
              max={155}
              value={slope}
              onChange={(e) => setSlope(e.target.value)}
              placeholder="e.g. 130"
            />
          </label>
        </div>
        <div className="field">
          <span>Holes</span>
          <div className="segmented">
            <button
              type="button"
              className={holeCount === 9 ? "active" : ""}
              onClick={() => handleHoleCountChange(9)}
            >
              9
            </button>
            <button
              type="button"
              className={holeCount === 18 ? "active" : ""}
              onClick={() => handleHoleCountChange(18)}
            >
              18
            </button>
          </div>
        </div>

        <div className="hole-grid">
          <div className="hole-grid-header">
            <span>Hole</span>
            <span>Par</span>
            <span>SI</span>
          </div>
          {holes.map((h, i) => (
            <div className="hole-row" key={h.number}>
              <span className="hole-num">{h.number}</span>
              <select
                value={h.par}
                onChange={(e) => updateHole(i, { par: Number(e.target.value) })}
              >
                {[3, 4, 5, 6].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={h.strokeIndex}
                onChange={(e) => updateHole(i, { strokeIndex: Number(e.target.value) })}
              >
                {Array.from({ length: holeCount }, (_, k) => k + 1).map((si) => (
                  <option key={si} value={si}>
                    {si}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <Link to="/courses" className="btn">
            Cancel
          </Link>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update course" : "Save course"}
          </button>
        </div>
      </div>
    </div>
  );
}
