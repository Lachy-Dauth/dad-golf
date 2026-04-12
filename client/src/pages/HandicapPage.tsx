import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { calculateScoreDifferential } from "@dad-golf/shared";
import type { HandicapRound } from "@dad-golf/shared";
import type { HandicapCalculation } from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";
import { api } from "../api.js";

interface FormData {
  date: string;
  courseName: string;
  adjustedGrossScore: string;
  courseRating: string;
  slopeRating: string;
}

const emptyForm: FormData = {
  date: new Date().toISOString().split("T")[0],
  courseName: "",
  adjustedGrossScore: "",
  courseRating: "72.0",
  slopeRating: "113",
};

export default function HandicapPage() {
  const { user, refreshProfile } = useAuth();
  const [rounds, setRounds] = useState<HandicapRound[]>([]);
  const [calculation, setCalculation] = useState<HandicapCalculation | null>(null);
  const [autoAdjust, setAutoAdjust] = useState(false);
  const [currentHandicap, setCurrentHandicap] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Add/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await api.getHandicap();
      setRounds(data.rounds);
      setCalculation(data.calculation);
      setAutoAdjust(data.autoAdjust);
      setCurrentHandicap(data.currentHandicap);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAutoAdjust() {
    setBusy(true);
    setError(null);
    try {
      await api.updateHandicapSettings(!autoAdjust);
      setAutoAdjust(!autoAdjust);
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyHandicap() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await api.applyHandicap();
      setCalculation(res.calculation);
      setCurrentHandicap(res.user.handicap);
      await refreshProfile();
      setMsg("Handicap updated to " + res.calculation.handicapIndex.toFixed(1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openAddForm() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEditForm(r: HandicapRound) {
    setEditId(r.id);
    setForm({
      date: r.date,
      courseName: r.courseName,
      adjustedGrossScore: String(r.adjustedGrossScore),
      courseRating: String(r.courseRating),
      slopeRating: String(r.slopeRating),
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSaveForm() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const payload = {
        date: form.date,
        courseName: form.courseName,
        adjustedGrossScore: Number(form.adjustedGrossScore),
        courseRating: Number(form.courseRating),
        slopeRating: Number(form.slopeRating),
      };

      if (editId) {
        const res = await api.updateHandicapRound(editId, payload);
        setCalculation(res.calculation);
      } else {
        const res = await api.addHandicapRound(payload);
        setCalculation(res.calculation);
      }

      // Reload all rounds to get correct order
      const data = await api.getHandicap();
      setRounds(data.rounds);
      setCalculation(data.calculation);
      setCurrentHandicap(data.currentHandicap);
      setShowForm(false);
      setEditId(null);
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await api.deleteHandicapRound(id);
      setCalculation(res.calculation);
      setRounds((prev) => prev.filter((r) => r.id !== id));
      // Reload to get updated handicap
      const data = await api.getHandicap();
      setCurrentHandicap(data.currentHandicap);
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rounds.length) return;
    setBusy(true);
    setError(null);
    try {
      const reordered = [...rounds];
      [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
      setRounds(reordered);

      const res = await api.reorderHandicapRounds(reordered.map((r) => r.id));
      setRounds(res.rounds);
      setCalculation(res.calculation);
      const data = await api.getHandicap();
      setCurrentHandicap(data.currentHandicap);
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="page">
        <div className="muted">You must be logged in to use the handicap tracker.</div>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  const usedIds = new Set(calculation?.usedRoundIds ?? []);

  const previewDiff =
    form.adjustedGrossScore && form.courseRating && form.slopeRating
      ? calculateScoreDifferential(
          Number(form.adjustedGrossScore),
          Number(form.courseRating),
          Number(form.slopeRating),
        )
      : null;

  return (
    <div className="page">
      <h1>Handicap Tracker</h1>

      {/* Summary card */}
      <div className="form">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
              CURRENT PROFILE HANDICAP
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{currentHandicap.toFixed(1)}</div>
          </div>
          {calculation && (
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                CALCULATED INDEX
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>
                {calculation.handicapIndex.toFixed(1)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Best {calculation.roundsUsed} of {calculation.totalRounds} rounds
                {calculation.adjustment > 0 && ` (-${calculation.adjustment.toFixed(1)} adj)`}
              </div>
            </div>
          )}
        </div>
        {!calculation && rounds.length < 3 && (
          <div className="muted">Add at least {3 - rounds.length} more round(s) to calculate.</div>
        )}
        {calculation && calculation.handicapIndex !== currentHandicap && (
          <button className="btn btn-primary" onClick={handleApplyHandicap} disabled={busy}>
            Apply {calculation.handicapIndex.toFixed(1)} to profile
          </button>
        )}
      </div>

      {/* Auto-adjust toggle */}
      <div className="form">
        <label className="field check" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoAdjust}
            onChange={handleToggleAutoAdjust}
            disabled={busy}
            style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
          />
          <span>Auto-update handicap when rounds complete</span>
        </label>
        <div className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          Completed rounds will be added to your history and your handicap will be recalculated
          automatically.
        </div>
      </div>

      {msg && <div className="muted">{msg}</div>}
      {error && <div className="error">{error}</div>}

      {/* Round list */}
      <div className="section">
        <div className="section-header">
          <h2>Round History ({rounds.length}/20)</h2>
          <button
            className="btn"
            onClick={openAddForm}
            disabled={busy || rounds.length >= 20}
            style={{ fontSize: 14, padding: "8px 14px", minHeight: 36 }}
          >
            + Add Round
          </button>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div
            style={{
              padding: 16,
              background: "var(--surface-2)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 600 }}>{editId ? "Edit Round" : "Add Round"}</div>
            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Course Name</span>
                <input
                  value={form.courseName}
                  onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                  placeholder="e.g. Royal Melbourne"
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Gross Score</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.adjustedGrossScore}
                  onChange={(e) => setForm({ ...form, adjustedGrossScore: e.target.value })}
                  placeholder="e.g. 95"
                />
              </label>
              <label className="field">
                <span>Course Rating</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={form.courseRating}
                  onChange={(e) => setForm({ ...form, courseRating: e.target.value })}
                  placeholder="72.0"
                />
              </label>
              <label className="field">
                <span>Slope</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.slopeRating}
                  onChange={(e) => setForm({ ...form, slopeRating: e.target.value })}
                  placeholder="113"
                />
              </label>
            </div>
            {previewDiff !== null && (
              <div className="muted" style={{ fontSize: 13 }}>
                Score Differential: <strong>{previewDiff.toFixed(1)}</strong>
              </div>
            )}
            <div className="form-actions">
              <button
                className="btn"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveForm}
                disabled={busy || !form.courseName.trim() || !form.adjustedGrossScore}
              >
                {busy ? "Saving..." : editId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        )}

        {rounds.length === 0 && !showForm && (
          <div className="muted" style={{ textAlign: "center", padding: 24 }}>
            No rounds yet. Add your recent rounds to calculate your handicap.
          </div>
        )}

        {rounds.map((r, i) => (
          <div
            key={r.id}
            style={{
              padding: "12px 0",
              borderBottom: i < rounds.length - 1 ? "1px solid var(--border-dim)" : undefined,
              borderLeft: usedIds.has(r.id) ? "3px solid var(--primary)" : "3px solid transparent",
              paddingLeft: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.courseName}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {r.date} &middot; Score: {r.adjustedGrossScore} &middot; CR {r.courseRating} / SL{" "}
                  {r.slopeRating}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: usedIds.has(r.id) ? "var(--primary)" : "var(--text)",
                    }}
                  >
                    Diff: {r.scoreDifferential.toFixed(1)}
                  </span>
                  {r.source === "auto" && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--primary-dim)",
                        color: "var(--primary-fg)",
                      }}
                    >
                      Auto
                    </span>
                  )}
                  {usedIds.has(r.id) && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Used in calculation
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                <button
                  className="btn-icon"
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0 || busy}
                  title="Move up (more recent)"
                >
                  &uarr;
                </button>
                <button
                  className="btn-icon"
                  onClick={() => handleMove(i, 1)}
                  disabled={i === rounds.length - 1 || busy}
                  title="Move down (older)"
                >
                  &darr;
                </button>
                <button
                  className="btn-icon"
                  onClick={() => openEditForm(r)}
                  disabled={busy}
                  title="Edit"
                >
                  &#9998;
                </button>
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(r.id)}
                  disabled={busy}
                  title="Delete"
                  style={{ color: "var(--danger)" }}
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link to="/profile" className="back-link">
        &larr; Profile
      </Link>
    </div>
  );
}
