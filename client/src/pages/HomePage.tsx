import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.js";

export default function HomePage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="hero">
        <h1>Stableford scoring for casual rounds</h1>
        <p className="muted">
          Up to 32 players per round. Everyone scores on their own phone, the leaderboard updates
          live.
        </p>
      </div>

      <div className="action-grid">
        <Link to="/rounds/new" className="action-tile primary">
          <span className="action-icon">⛳</span>
          <span className="action-label">Start a round</span>
          <span className="action-sub">Pick a course and get a room code</span>
        </Link>
        <Link to="/join" className="action-tile">
          <span className="action-icon">🔑</span>
          <span className="action-label">Join a round</span>
          <span className="action-sub">Enter a room code</span>
        </Link>
        <Link to="/courses" className="action-tile">
          <span className="action-icon">🗺️</span>
          <span className="action-label">Courses</span>
          <span className="action-sub">Manage saved courses</span>
        </Link>
        <Link to="/groups" className="action-tile">
          <span className="action-icon">👥</span>
          <span className="action-label">Golf groups</span>
          <span className="action-sub">Save your regulars</span>
        </Link>
        <Link to="/upcoming" className="action-tile">
          <span className="action-icon">📅</span>
          <span className="action-label">Upcoming rounds</span>
          <span className="action-sub">View and RSVP to scheduled rounds</span>
        </Link>
        {user && (
          <Link to="/rounds" className="action-tile">
            <span className="action-icon">📋</span>
            <span className="action-label">My rounds</span>
            <span className="action-sub">Past round history</span>
          </Link>
        )}
        {user && (
          <Link to="/activity" className="action-tile">
            <span className="action-icon">📣</span>
            <span className="action-label">Activity</span>
            <span className="action-sub">See what your groups are up to</span>
          </Link>
        )}
      </div>

      <div className="home-footer">
        <Link to="/help" className="help-link">
          How to use Stableford →
        </Link>
      </div>
    </div>
  );
}
