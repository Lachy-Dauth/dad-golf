import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Course, CourseReportReason, CourseReview } from "@dad-golf/shared";
import { totalPar } from "@dad-golf/shared";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";
import StarRating from "../components/StarRating.js";
import WeatherWidget from "../components/WeatherWidget.js";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [viewerReview, setViewerReview] = useState<CourseReview | null>(null);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Report state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reported, setReported] = useState(false);

  const loadCourse = useCallback(() => {
    if (!id) return;
    api
      .getCourse(id)
      .then((res) => {
        setCourse(res.course);
        setViewerReview(res.viewerReview);
        if (res.viewerReview) {
          setReviewRating(res.viewerReview.rating);
          setReviewText(res.viewerReview.reviewText ?? "");
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const loadReviews = useCallback(
    (offset = 0) => {
      if (!id) return;
      api
        .listCourseReviews(id, 20, offset)
        .then((res) => {
          if (offset === 0) {
            setReviews(res.reviews);
          } else {
            setReviews((prev) => [...prev, ...res.reviews]);
          }
          setReviewTotal(res.total);
          setReviewOffset(offset);
        })
        .catch(() => {});
    },
    [id],
  );

  useEffect(() => {
    loadCourse();
    loadReviews(0);
  }, [loadCourse, loadReviews]);

  async function handleToggleFav() {
    if (!user || !course) return;
    try {
      if (course.isFavorite) await api.unfavoriteCourse(course.id);
      else await api.favoriteCourse(course.id);
      loadCourse();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmitReview() {
    if (!course || reviewRating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitCourseReview(course.id, reviewRating, reviewText || undefined);
      setViewerReview(res.review);
      setShowReviewForm(false);
      loadCourse();
      loadReviews(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteReview() {
    if (!course) return;
    if (!confirm("Delete your review?")) return;
    try {
      await api.deleteCourseReview(course.id);
      setViewerReview(null);
      setReviewRating(0);
      setReviewText("");
      loadCourse();
      loadReviews(0);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleReport(reason: CourseReportReason) {
    if (!course) return;
    try {
      await api.reportCourse(course.id, reason);
      setReported(true);
      setShowReportForm(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page">
        <div className="error">{error ?? "Course not found"}</div>
        <Link to="/courses" className="back-link">
          &larr; Courses
        </Link>
      </div>
    );
  }

  const canEdit = user && (course.createdByUserId === user.id || user.isAdmin);

  return (
    <div className="page">
      <Link to="/courses" className="back-link">
        &larr; Courses
      </Link>

      <div className="course-detail-header">
        <div>
          <h1>{course.name}</h1>
          {course.location && <div className="course-location">{course.location}</div>}
        </div>
        <div className="row-actions">
          {user && (
            <button
              className={`btn-icon fav ${course.isFavorite ? "active" : ""}`}
              onClick={handleToggleFav}
              title={course.isFavorite ? "Unfavourite" : "Favourite"}
              aria-label="Favourite"
            >
              {course.isFavorite ? "\u2605" : "\u2606"}
            </button>
          )}
          {canEdit && (
            <Link
              to={`/courses/${course.id}/edit`}
              className="btn-icon"
              title="Edit"
              aria-label="Edit"
            >
              ✎
            </Link>
          )}
        </div>
      </div>

      {course.location && <WeatherWidget courseId={course.id} courseLocation={course.location} />}

      {error && <div className="error">{error}</div>}

      {/* Course Info */}
      <section className="section">
        <h2>Course Info</h2>
        <div className="course-meta-grid">
          <div className="course-meta-item">
            <span className="course-meta-label">Holes</span>
            <span className="course-meta-value">{course.holes.length}</span>
          </div>
          <div className="course-meta-item">
            <span className="course-meta-label">Par</span>
            <span className="course-meta-value">{totalPar(course)}</span>
          </div>
        </div>
        {course.tees.length > 0 && (
          <div className="course-tees-wrap">
            <table className="course-tees-table">
              <thead>
                <tr>
                  <th>Tee</th>
                  <th>Rating</th>
                  <th>Slope</th>
                </tr>
              </thead>
              <tbody>
                {course.tees.map((tee) => (
                  <tr key={tee.id}>
                    <td>
                      {tee.name}
                      {tee.id === course.defaultTeeId && (
                        <span className="tee-default-badge"> (default)</span>
                      )}
                    </td>
                    <td>{tee.rating.toFixed(1)}</td>
                    <td>{tee.slope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="course-meta-sub">
          {course.createdByName && <span>Added by {course.createdByName}</span>}
          {course.roundCount > 0 && (
            <span>
              Played {course.roundCount} time{course.roundCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </section>

      {/* Scorecard */}
      <section className="section">
        <h2>Scorecard</h2>
        <div className="course-scorecard-wrap">
          {course.holes.length === 18 ? (
            <>
              <ScorecardTable holes={course.holes.slice(0, 9)} label="Out" />
              <ScorecardTable holes={course.holes.slice(9, 18)} label="In" />
            </>
          ) : (
            <ScorecardTable holes={course.holes} label="Total" />
          )}
        </div>
      </section>

      {/* Community Rating */}
      <section className="section">
        <h2>Community Rating</h2>
        <div className="course-rating-summary">
          {course.avgRating != null ? (
            <>
              <StarRating value={Math.round(course.avgRating)} />
              <span className="course-rating-text">
                {course.avgRating.toFixed(1)} ({course.ratingCount} rating
                {course.ratingCount !== 1 ? "s" : ""})
              </span>
            </>
          ) : (
            <span className="muted">No ratings yet</span>
          )}
        </div>

        {user && !showReviewForm && (
          <div className="course-rating-action">
            {viewerReview ? (
              <div className="course-viewer-review">
                <span className="muted">Your rating:</span>{" "}
                <StarRating value={viewerReview.rating} size="sm" />
                <button className="btn btn-small" onClick={() => setShowReviewForm(true)}>
                  Edit
                </button>
                <button className="btn btn-small btn-danger" onClick={handleDeleteReview}>
                  Delete
                </button>
              </div>
            ) : (
              <button className="btn" onClick={() => setShowReviewForm(true)}>
                Rate this course
              </button>
            )}
          </div>
        )}

        {user && showReviewForm && (
          <div className="course-review-form">
            <div className="field">
              <span>Your rating</span>
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>
            <label className="field">
              <span>Review (optional)</span>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                maxLength={500}
              />
            </label>
            <div className="form-actions">
              <button
                className="btn"
                onClick={() => {
                  setShowReviewForm(false);
                  if (viewerReview) {
                    setReviewRating(viewerReview.rating);
                    setReviewText(viewerReview.reviewText ?? "");
                  }
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitReview}
                disabled={submitting || reviewRating === 0}
              >
                {submitting ? "Saving..." : viewerReview ? "Update" : "Submit"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="section">
          <h2>Reviews</h2>
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id} className="review-item">
                <div className="review-header">
                  <StarRating value={r.rating} size="sm" />
                  <span className="review-author">{r.userName}</span>
                  <span className="review-date">{formatRelativeDate(r.createdAt)}</span>
                </div>
                {r.reviewText && <p className="review-text">{r.reviewText}</p>}
              </li>
            ))}
          </ul>
          {reviews.length < reviewTotal && (
            <button className="btn" onClick={() => loadReviews(reviewOffset + 20)}>
              Load more reviews
            </button>
          )}
        </section>
      )}

      {/* Actions */}
      <div className="course-detail-actions">
        <Link
          to={`/rounds/new?courseId=${course.id}`}
          className="btn btn-primary"
          style={{ flex: 1, textAlign: "center" }}
        >
          Start a round on this course
        </Link>
      </div>

      {/* Report */}
      {user && !reported && (
        <div className="course-report">
          {!showReportForm ? (
            <button className="btn btn-small" onClick={() => setShowReportForm(true)}>
              Report course
            </button>
          ) : (
            <div className="course-report-form">
              <span className="muted">Why are you reporting this course?</span>
              <div className="course-report-options">
                <button className="btn btn-small" onClick={() => handleReport("incorrect_info")}>
                  Incorrect info
                </button>
                <button className="btn btn-small" onClick={() => handleReport("duplicate")}>
                  Duplicate course
                </button>
                <button className="btn btn-small" onClick={() => handleReport("inappropriate")}>
                  Inappropriate
                </button>
                <button className="btn btn-small" onClick={() => setShowReportForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {reported && <div className="muted">Thanks for reporting. An admin will review it.</div>}
    </div>
  );
}

function ScorecardTable({
  holes,
  label,
}: {
  holes: { number: number; par: number; strokeIndex: number }[];
  label: string;
}) {
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  return (
    <div className="course-scorecard">
      <table>
        <thead>
          <tr>
            <th>Hole</th>
            {holes.map((h) => (
              <th key={h.number}>{h.number}</th>
            ))}
            <th>{label}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Par</td>
            {holes.map((h) => (
              <td key={h.number}>{h.par}</td>
            ))}
            <td>{parTotal}</td>
          </tr>
          <tr>
            <td>SI</td>
            {holes.map((h) => (
              <td key={h.number}>{h.strokeIndex}</td>
            ))}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
