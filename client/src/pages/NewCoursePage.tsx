import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import type { Hole } from "@dad-golf/shared";
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
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState<string>("72.0");
  const [slope, setSlope] = useState<string>("113");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<Hole[]>(defaultHoles(18));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleHoleCountChange(count: 9 | 18) {
    setHoleCount(count);
    setHoles(defaultHoles(count));
  }

  function updateHole(i: number, patch: Partial<Hole>) {
    setHoles((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    );
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Course name is required");
      return;
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 50 || ratingNum > 90) {
      setError("Course rating must be a number between 50.0 and 90.0");
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
      await api.createCourse({
        name: name.trim(),
        location: location.trim() || null,
        rating: ratingNum,
        slope: slopeNum,
        holes,
      });
      nav("/courses");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>New course</h1>
        <p className="muted">You need to log in to create a course.</p>
        <Link
          to={`/login?next=${encodeURIComponent("/courses/new")}`}
          className="btn btn-primary"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>New course</h1>
      <div className="form">
        <label className="field">
          <span>Course name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pebble Creek Municipal"
          />
        </label>
        <label className="field">
          <span>Location (optional)</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State"
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
                onChange={(e) =>
                  updateHole(i, { par: Number(e.target.value) })
                }
              >
                {[3, 4, 5, 6].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={h.strokeIndex}
                onChange={(e) =>
                  updateHole(i, { strokeIndex: Number(e.target.value) })
                }
              >
                {Array.from({ length: holeCount }, (_, k) => k + 1).map(
                  (si) => (
                    <option key={si} value={si}>
                      {si}
                    </option>
                  ),
                )}
              </select>
            </div>
          ))}
        </div>

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <Link to="/courses" className="btn">
            Cancel
          </Link>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save course"}
          </button>
        </div>
      </div>
    </div>
  );
}
