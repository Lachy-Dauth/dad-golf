import { Link } from "react-router-dom";

export default function HelpPage() {
  return (
    <div className="page">
      <h1>How to use Dad Golf</h1>
      <p className="muted">
        A quick guide to running a Stableford round from your phone.
      </p>

      <section className="section">
        <h2>1. Set up your courses</h2>
        <p>
          Before your first round, add the courses you play at. Open{" "}
          <Link to="/courses">Courses</Link> from the home screen and tap{" "}
          <strong>New course</strong>.
        </p>
        <ul className="help-list">
          <li>Give the course a name (and optional location).</li>
          <li>Choose 9 or 18 holes.</li>
          <li>
            For each hole, set the <strong>par</strong> (3, 4, 5 or 6) and{" "}
            <strong>stroke index</strong> (1 = hardest, up to 18 = easiest).
            Stroke indexes must all be unique.
          </li>
          <li>Save. The course can now be picked when starting any round.</li>
        </ul>
        <p className="muted">
          Two sample courses are seeded automatically the first time the
          server runs so you can try the app without any setup.
        </p>
      </section>

      <section className="section">
        <h2>2. Save your regular players as a group (optional)</h2>
        <p>
          If the same crew plays together often, save them as a group so you
          don't have to retype names every time. Open{" "}
          <Link to="/groups">Golf groups</Link> and create one.
        </p>
        <ul className="help-list">
          <li>Give the group a name like "Saturday Regulars".</li>
          <li>
            Add each member with their name and current handicap (0–54). Up
            to 64 members per group.
          </li>
          <li>Edit or remove members any time — changes are saved.</li>
        </ul>
      </section>

      <section className="section">
        <h2>3. Start a round</h2>
        <p>
          From the home screen, tap <strong>Start a round</strong>.
        </p>
        <ul className="help-list">
          <li>Pick the course.</li>
          <li>
            Optionally pick a golf group. Leave{" "}
            <em>Pre-add all group members as players</em> ticked to bring the
            whole roster into the round in one go.
          </li>
          <li>
            Tap <strong>Create round</strong>. You'll land on the round page
            with a room code like <code>GOLF-7K2P</code>.
          </li>
          <li>
            Share the page URL (tap <strong>copy link</strong>) with anyone
            who needs to join. The URL encodes the room code, so opening it
            drops them straight into the round.
          </li>
        </ul>
        <p>
          Up to <strong>32 players</strong> can be in a single round.
        </p>
      </section>

      <section className="section">
        <h2>4. Joining from another phone</h2>
        <p>
          Everyone opens the shared link, or goes to{" "}
          <Link to="/join">Join a round</Link> and types in the room code.
          On the round page, each player:
        </p>
        <ul className="help-list">
          <li>
            Taps <strong>Join this round</strong>, enters their name and
            handicap.
          </li>
          <li>
            Selects their name in the player grid to mark "this is me on
            this device". That choice is remembered locally, so refreshing
            the page keeps you signed in as the same player.
          </li>
        </ul>
        <p>
          When the players look right, the host taps{" "}
          <strong>Start round</strong>. Anyone can still join after the
          start, as long as the round is not marked complete.
        </p>
      </section>

      <section className="section">
        <h2>5. Scoring a hole</h2>
        <p>
          On the <strong>Score</strong> tab you'll see the current hole, its
          par, stroke index, and how many shots you receive on it based on
          your handicap.
        </p>
        <ul className="help-list">
          <li>
            Tap the big number that matches your gross score (1–10). Each
            button shows the Stableford points you'd get, so you can see
            the reward before committing.
          </li>
          <li>
            Use <strong>‹</strong> / <strong>›</strong> to move between
            holes, or tap any chip in the hole strip at the bottom to jump
            straight there.
          </li>
          <li>
            Made a mistake? Tap <strong>Clear</strong> to wipe your score
            for that hole, then re-enter it.
          </li>
          <li>
            Scores you enter are saved to the server immediately and pushed
            live to every other phone in the room.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>6. Watching the leaderboard</h2>
        <p>
          Switch to the <strong>Leaderboard</strong> tab at any time. It
          updates in real time as scores come in:
        </p>
        <ul className="help-list">
          <li>
            Position, name, handicap, holes played, total Stableford points,
            and points back from the leader.
          </li>
          <li>
            Ties share a position — the next player below picks up after the
            gap, standard golf style.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>7. Ending a round</h2>
        <p>
          When everyone finishes their last hole, tap <strong>End round</strong>.
          You'll get a summary with the winner and the best single hole
          scored. The round stays saved — you can come back to the URL later
          to see the final leaderboard.
        </p>
      </section>

      <section className="section">
        <h2>Stableford scoring, in 30 seconds</h2>
        <p>
          Stableford gives points per hole based on your net score — your
          gross score minus any handicap strokes you receive on that hole:
        </p>
        <ul className="help-list">
          <li>Albatross (net 3 under par): <strong>5 points</strong></li>
          <li>Eagle (net 2 under): <strong>4 points</strong></li>
          <li>Birdie (net 1 under): <strong>3 points</strong></li>
          <li>Par (net even): <strong>2 points</strong></li>
          <li>Bogey (net 1 over): <strong>1 point</strong></li>
          <li>Double bogey or worse: <strong>0 points</strong></li>
        </ul>
        <p>
          Strokes received: if your handicap is <em>H</em>, you get at least{" "}
          <code>floor(H/18)</code> strokes on every hole, plus one extra on
          the holes whose stroke index is <code>≤ H mod 18</code>. So a
          handicap-9 player gets a stroke on the nine hardest holes (SI 1–9);
          a handicap-20 player gets one stroke on every hole plus an extra on
          SI 1 and SI 2.
        </p>
      </section>

      <section className="section">
        <h2>Tips</h2>
        <ul className="help-list">
          <li>
            <strong>Lost signal?</strong> The app auto-reconnects. Your
            scores stay saved on the server, so refreshing always brings you
            back to the live state.
          </li>
          <li>
            <strong>Share the link on the first tee.</strong> Once everyone
            is joined, put your phone in your pocket — the scoring screen
            is the only thing you'll need.
          </li>
          <li>
            <strong>Don't obsess over stroke indexes.</strong> If you don't
            know the course's official stroke index, just assign 1–18 in the
            order holes feel hardest to easiest. Stableford still works.
          </li>
        </ul>
      </section>

      <Link to="/" className="back-link">
        ← Back to home
      </Link>
    </div>
  );
}
