import { Link } from "react-router-dom";
import { getRecentRounds } from "../localStore.js";
import { useAuth } from "../AuthContext.js";

export default function HomePage() {
  const { user } = useAuth();
  const recent = getRecentRounds();
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
        {user && (
          <Link to="/rounds" className="action-tile">
            <span className="action-icon">📋</span>
            <span className="action-label">My rounds</span>
            <span className="action-sub">Past round history</span>
          </Link>
        )}
      </div>

      <div className="home-footer">
        <Link to="/help" className="help-link">
          How to use Stableford →
        </Link>
      </div>

      {recent.length > 0 && (
        <section className="section">
          <h2>Recent rounds on this device</h2>
          <ul className="list">
            {recent.map((r) => (
              <li key={r.roomCode}>
                <Link to={`/r/${r.roomCode}`} className="list-row">
                  <div>
                    <div className="list-primary">{r.courseName}</div>
                    <div className="list-secondary">{r.roomCode}</div>
                  </div>
                  <span className="chevron">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
