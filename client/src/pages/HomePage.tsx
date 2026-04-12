import { Link } from "react-router-dom";

export default function HomePage() {
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
      </div>

      <div className="home-footer">
        <Link to="/help" className="help-link">
          How to use Stableford →
        </Link>
      </div>
    </div>
  );
}
