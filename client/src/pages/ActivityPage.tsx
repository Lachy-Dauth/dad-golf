import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.js";
import { BADGE_MAP } from "@dad-golf/shared";
import type { ActivityFeedItem, ActivityComment } from "@dad-golf/shared";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function eventIcon(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case "round_completed":
      return "\u{1F3C6}";
    case "round_started":
      return "\u26F3";
    case "member_joined":
      return "\u{1F44B}";
    case "scheduled_round_created":
      return "\u{1F4C5}";
    case "competition_won":
      return data.competitionType === "ctp" ? "\u{1F3AF}" : "\u{1F4AA}";
    case "handicap_change":
      return "\u{1F4C9}";
    case "badge_earned":
      return "\u{1F3C5}";
    default:
      return "\u{1F4AC}";
  }
}

function eventDescription(item: ActivityFeedItem): string {
  const d = item.data;
  switch (item.type) {
    case "round_completed":
      return `won at ${d.courseName ?? "a course"} with ${d.winnerPoints ?? "?"} pts (${d.playerCount ?? "?"} players)`;
    case "round_started":
      return `started a round at ${d.courseName ?? "a course"}`;
    case "member_joined":
      return `joined ${d.groupName ?? "a group"}`;
    case "scheduled_round_created":
      return `scheduled a round at ${d.courseName ?? "a course"} for ${d.scheduledDate ?? "TBD"}`;
    case "competition_won":
      return `won ${d.competitionType === "ctp" ? "Closest to Pin" : "Longest Drive"} on hole ${d.holeNumber ?? "?"}`;
    case "handicap_change": {
      const old = Number(d.oldHandicap ?? 0).toFixed(1);
      const n = Number(d.newHandicap ?? 0).toFixed(1);
      return `handicap changed from ${old} to ${n}`;
    }
    case "badge_earned": {
      const badge = BADGE_MAP.get(String(d.badgeId ?? ""));
      return `earned the ${badge?.icon ?? ""} ${badge?.name ?? "a badge"} badge`;
    }
    default:
      return "did something";
  }
}

function eventLink(item: ActivityFeedItem): string | null {
  if (
    (item.type === "round_completed" || item.type === "round_started") &&
    item.roomCode
  ) {
    return `/r/${item.roomCode}`;
  }
  if (item.type === "member_joined" && item.groupId) {
    return `/groups/${item.groupId}`;
  }
  return null;
}

function ActivityCard({
  item,
  onUpdate,
}: {
  item: ActivityFeedItem;
  onUpdate: (updated: ActivityFeedItem) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const toggleLike = async () => {
    // Optimistic update
    const liked = !item.viewerLiked;
    onUpdate({
      ...item,
      viewerLiked: liked,
      likeCount: item.likeCount + (liked ? 1 : -1),
    });
    try {
      if (liked) {
        await api.likeActivity(item.id);
      } else {
        await api.unlikeActivity(item.id);
      }
    } catch {
      // Revert on error
      onUpdate(item);
    }
  };

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await api.getActivityComments(item.id);
        setComments(res.comments);
      } catch {
        /* ignore */
      } finally {
        setLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      const res = await api.addActivityComment(item.id, text);
      setComments((prev) => [...prev, res.comment]);
      setCommentText("");
      onUpdate({ ...item, commentCount: item.commentCount + 1 });
    } catch {
      /* ignore */
    }
  };

  const link = eventLink(item);
  const initials = item.userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="activity-card">
      <div className="activity-card-header">
        <div className="activity-avatar">{initials}</div>
        <div className="activity-meta">
          <span className="activity-user">
            <Link to={`/user/${item.username}`} className="activity-user-link">
              {item.userName}
            </Link>
          </span>
          <div className="activity-time">{relativeTime(item.createdAt)}</div>
        </div>
        <span className="activity-icon-large">{eventIcon(item.type, item.data)}</span>
      </div>
      {item.groupName && <span className="activity-group-tag">{item.groupName}</span>}
      <div className="activity-body">
        {link ? (
          <Link to={link} className="activity-body-link">
            {eventDescription(item)}
          </Link>
        ) : (
          eventDescription(item)
        )}
      </div>
      <div className="activity-actions">
        <button className={item.viewerLiked ? "liked" : ""} onClick={toggleLike}>
          {item.viewerLiked ? "\u{1F44D}" : "\u{1F44D}\u{1F3FB}"} {item.likeCount || ""}
        </button>
        <button onClick={toggleComments}>
          {"\u{1F4AC}"} {item.commentCount || ""}
        </button>
      </div>
      {showComments && (
        <div className="comment-section">
          {loadingComments && <div className="muted">Loading...</div>}
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <span className="comment-author">{c.userName}</span>
              <span className="comment-text">{c.text}</span>
              <div className="comment-time">{relativeTime(c.createdAt)}</div>
            </div>
          ))}
          <div className="comment-input">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              maxLength={500}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
            />
            <button className="btn" onClick={submitComment} disabled={!commentText.trim()}>
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(() => {
    if (!user) return;
    setFetching(true);
    api
      .getActivityFeed(20, offset)
      .then((res) => {
        setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setFetching(false));
  }, [user, offset]);

  useEffect(() => {
    if (!loading && user) loadFeed();
  }, [loading, user, loadFeed]);

  const updateItem = (updated: ActivityFeedItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  if (loading) {
    return (
      <div className="page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Activity</h1>
        <p className="muted">
          <Link to="/login">Log in</Link> to see your activity feed.
        </p>
        <Link to="/" className="back-link">
          &larr; Home
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Activity</h1>
      {error && <div className="error">{error}</div>}

      {!fetching && items.length === 0 && (
        <div className="muted">
          No activity yet. Join a group and play a round to see your feed!
        </div>
      )}

      <div className="activity-feed">
        {items.map((item) => (
          <ActivityCard key={item.id} item={item} onUpdate={updateItem} />
        ))}
      </div>

      {items.length < total && (
        <div className="form-actions">
          <button className="btn" onClick={() => setOffset((o) => o + 20)} disabled={fetching}>
            {fetching ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      <Link to="/" className="back-link">
        &larr; Home
      </Link>
    </div>
  );
}
