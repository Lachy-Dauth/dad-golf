import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import type { Course, Hole, Tee } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";

function defaultHoles(count: 9 | 18): Hole[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokeIndex: i + 1,
  }));
}

interface TeeDraft {
  id: string;
  name: string;
  rating: string;
  slope: string;
}

function makeTeeDraft(partial?: Partial<TeeDraft>): TeeDraft {
  return {
    id:
      partial?.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tee-${Math.random().toString(36).slice(2, 10)}`),
    name: partial?.name ?? "",
    rating: partial?.rating ?? "72.0",
    slope: partial?.slope ?? "113",
  };
}

interface LocationSuggestion {
  latitude: number;
  longitude: number;
  name: string;
  displayName: string;
}

export default function NewCoursePage() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationWrapperRef = useRef<HTMLDivElement>(null);
  const [tees, setTees] = useState<TeeDraft[]>(() => [
    makeTeeDraft({ name: "Default", rating: "72.0", slope: "113" }),
  ]);
  const [defaultTeeId, setDefaultTeeId] = useState<string>(() => "");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<Hole[]>(defaultHoles(18));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(isEdit);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!defaultTeeId && tees.length > 0) {
      setDefaultTeeId(tees[0].id);
    }
  }, [tees, defaultTeeId]);

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

  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (selectedCoords || location.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    locationDebounceRef.current = setTimeout(() => {
      api
        .searchLocations(location.trim())
        .then((res) => {
          setLocationSuggestions(res.locations);
          setShowLocationDropdown(res.locations.length > 0);
        })
        .catch(() => {
          setLocationSuggestions([]);
          setShowLocationDropdown(false);
        })
        .finally(() => setLocationLoading(false));
    }, 350);
    return () => {
      if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    };
  }, [location, selectedCoords]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (locationWrapperRef.current && !locationWrapperRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelectLocation(suggestion: LocationSuggestion) {
    setLocation(suggestion.displayName);
    setSelectedCoords({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setShowLocationDropdown(false);
    setLocationSuggestions([]);
  }

  function handleLocationChange(value: string) {
    setLocation(value);
    setSelectedCoords(null);
  }

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
    setHoleCount(18);
    setHoles(defaultHoles(18));

    api
      .getCourse(id)
      .then(({ course }) => {
        setName(course.name);
        setLocation(course.location ?? "");
        if (course.latitude != null && course.longitude != null) {
          setSelectedCoords({ latitude: course.latitude, longitude: course.longitude });
        }
        const teeDrafts: TeeDraft[] = (course.tees ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          rating: t.rating.toFixed(1),
          slope: String(t.slope),
        }));
        if (teeDrafts.length > 0) {
          setTees(teeDrafts);
          setDefaultTeeId(course.defaultTeeId || teeDrafts[0].id);
        } else {
          const fallback = makeTeeDraft({
            name: "Default",
            rating: course.rating.toFixed(1),
            slope: String(course.slope),
          });
          setTees([fallback]);
          setDefaultTeeId(fallback.id);
        }
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

  function updateTee(idx: number, patch: Partial<TeeDraft>) {
    setTees((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function addTee() {
    const t = makeTeeDraft({
      name: "",
      rating: "72.0",
      slope: "113",
    });
    setTees((prev) => [...prev, t]);
  }

  function removeTee(idx: number) {
    setTees((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((t) => t.id === defaultTeeId)) {
        setDefaultTeeId(next[0].id);
      }
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Course name is required");
      return;
    }
    if (tees.length === 0) {
      setError("At least one tee is required");
      return;
    }
    const teesClean: Tee[] = [];
    const nameSet = new Set<string>();
    for (const [i, t] of tees.entries()) {
      const nm = t.name.trim();
      if (!nm) {
        setError(`Tee ${i + 1} needs a name`);
        return;
      }
      if (nameSet.has(nm.toLowerCase())) {
        setError(`Duplicate tee name "${nm}"`);
        return;
      }
      nameSet.add(nm.toLowerCase());
      const r = Number(t.rating);
      if (!Number.isFinite(r) || r < 10 || r > 100) {
        setError(`Tee "${nm}" rating must be between 10 and 100`);
        return;
      }
      const s = Number(t.slope);
      if (!Number.isInteger(s) || s < 55 || s > 155) {
        setError(`Tee "${nm}" slope must be an integer 55–155`);
        return;
      }
      teesClean.push({
        id: t.id,
        name: nm,
        rating: Math.round(r * 10) / 10,
        slope: s,
      });
    }
    const resolvedDefault = teesClean.some((t) => t.id === defaultTeeId)
      ? defaultTeeId
      : teesClean[0].id;
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
        latitude: selectedCoords?.latitude ?? null,
        longitude: selectedCoords?.longitude ?? null,
        tees: teesClean,
        defaultTeeId: resolvedDefault,
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
        <div className="field" ref={locationWrapperRef}>
          <label htmlFor="course-location">Location (optional)</label>
          <div className="location-autocomplete">
            <input
              id="course-location"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => {
                if (locationSuggestions.length > 0) setShowLocationDropdown(true);
              }}
              placeholder="Search suburb, address or postcode..."
              autoComplete="off"
            />
            {locationLoading && <span className="location-loading">Searching...</span>}
            {showLocationDropdown && locationSuggestions.length > 0 && (
              <ul className="location-dropdown">
                {locationSuggestions.map((s, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => handleSelectLocation(s)}>
                      {s.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="field">
          <span>Tees</span>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            Add each tee box with its own course rating and slope. Pick one as the default.
          </p>
          <div className="tee-editor">
            {tees.map((t, i) => (
              <div className="tee-editor-row" key={t.id}>
                <label className="tee-default-label" title="Default tee">
                  <input
                    type="radio"
                    name="default-tee"
                    checked={defaultTeeId === t.id}
                    onChange={() => setDefaultTeeId(t.id)}
                  />
                  <span className="visually-hidden">Default</span>
                </label>
                <input
                  className="tee-name-input"
                  placeholder={`Tee ${i + 1}`}
                  value={t.name}
                  onChange={(e) => updateTee(i, { name: e.target.value })}
                />
                <input
                  className="tee-rating-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={10}
                  max={100}
                  value={t.rating}
                  onChange={(e) => updateTee(i, { rating: e.target.value })}
                  placeholder="Rating"
                />
                <input
                  className="tee-slope-input"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min={55}
                  max={155}
                  value={t.slope}
                  onChange={(e) => updateTee(i, { slope: e.target.value })}
                  placeholder="Slope"
                />
                <button
                  type="button"
                  className="btn-icon"
                  aria-label="Remove tee"
                  disabled={tees.length <= 1}
                  onClick={() => removeTee(i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-small" onClick={addTee} disabled={tees.length >= 8}>
              + Add tee
            </button>
          </div>
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
