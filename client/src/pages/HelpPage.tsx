import { Link } from "react-router-dom";

export default function HelpPage() {
  return (
    <div className="page">
      <h1>Help</h1>

      <section className="section">
        <h2>Quick start</h2>
        <ol className="help-list">
          <li>
            Add a course in <Link to="/courses">Courses</Link> (par, stroke index, and ratings from
            the scorecard).
          </li>
          <li>
            Tap <strong>Start a round</strong>, pick the course, and add players.
          </li>
          <li>Share the room link so others can join from their phone.</li>
          <li>Tap your gross score each hole — points update live for everyone.</li>
          <li>
            Check the <strong>Leaderboard</strong> tab any time. When you're done, tap{" "}
            <strong>End round</strong>.
          </li>
        </ol>
      </section>

      <section className="section">
        <h2>Stableford points</h2>
        <p>Points per hole based on your net score (gross minus handicap strokes received):</p>
        <ul className="help-list">
          <li>
            Net 3+ under par: <strong>5+</strong>
          </li>
          <li>
            Eagle (net 2 under): <strong>4</strong>
          </li>
          <li>
            Birdie (net 1 under): <strong>3</strong>
          </li>
          <li>
            Par (net even): <strong>2</strong>
          </li>
          <li>
            Bogey (net 1 over): <strong>1</strong>
          </li>
          <li>
            Double bogey or worse: <strong>0</strong>
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>Tips</h2>
        <ul className="help-list">
          <li>Lost signal? The app auto-reconnects and your scores are safe.</li>
          <li>
            Save a <Link to="/groups">golf group</Link> to pre-load your regular players.
          </li>
        </ul>
      </section>

      <Link to="/" className="back-link">
        ← Back to home
      </Link>
    </div>
  );
}
