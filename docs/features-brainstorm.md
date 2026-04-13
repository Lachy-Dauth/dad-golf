# Feature Brainstorm

Ideas for Dad Golf features. Organised by theme, with each feature categorised as:

- **FREE** — Included for free. All features are free — Dad Golf is a free app.
- **WON'T DO** — Too much effort, too niche, or better served by other apps. Not worth building.

---

## 1. Stats & Analytics

### 1a. Personal Stats Dashboard — FREE ✅

- Scoring averages over time (overall, per course, per hole)
- Stableford points trend graph
- Best/worst holes, par-3/4/5 breakdowns
- Stableford / raw strokes toggle
- "Personal bests" badges

> Shipped. Dedicated /stats page with Stableford/Strokes toggle, overview
> cards (rounds, wins, avg, best), scoring distribution bar chart, points/
> strokes trend line chart, performance by par type (3/4/5), per-course
> stats table, and recent rounds table. Server-side aggregation endpoint
> computes all stats from hole-level score data.

### 1b. Head-to-Head Comparisons — FREE

- Compare your stats against a mate across all shared rounds
- Win/loss record between two players
- "Rivalry" page for regular playing partners

> Fun for competitive groups. Natural extension of the stats dashboard.

### 1c. Round Replay & Hole-by-Hole Breakdown — FREE ✅

- Post-round detailed breakdown with visualisations
- Hole-by-hole scoring summary for each player

> Shipped. Post-round summary with full scorecard, leaderboard progression
> chart, per-player stats (best/worst holes, score distribution), and
> competition results. Browse past rounds via personal history or group pages.

---

## 2. Leagues & Seasons

### 2a. Recurring Leagues — FREE

- Create a league with a set of players and a season (e.g., 10 rounds over 3 months)
- Automatic standings based on cumulative Stableford points
- Configurable scoring: best N of M rounds, drop worst round, etc.
- End-of-season champion

> The killer feature for regular groups. High effort but high reward —
> this is the thing that keeps groups coming back.

### 2b. League Leaderboard & Awards — FREE

- Weekly/monthly leaderboards within a league
- Auto-generated awards: "Most Improved", "Most Consistent", "Eagle King", etc.
- Shareable league standings page (public link)

> Natural extension of leagues. Awards are fun and low effort once leagues exist.

### 2c. Scheduled Rounds — FREE ✅

- Pre-schedule rounds for a league (date, time, course)
- RSVP / availability tracking

> Shipped. Group admins schedule rounds with date, time, course, and
> optional duration. Members RSVP (going/maybe/can't). Admins start the
> round and accepted players are added automatically. Dedicated Upcoming
> Rounds page shows all scheduled rounds across groups.

---

## 3. Course Database & GPS

### 3a. Community Course Database — FREE ✅

- Crowdsourced course data — when a user creates a course, it becomes available
  to all users (with moderation/verification)
- Search courses by location, name, number of holes
- Course ratings/reviews from the community

> Shipped. Courses are shared across all users with star ratings, review text,
> and a reporting system (duplicate, incorrect, inappropriate). Location
> autocomplete via Nominatim (OpenStreetMap) with coordinate storage for
> weather integration.

### 3b. Course GPS & Hole Maps — WON'T DO

- Upload or generate hole layouts
- GPS distance to pin (requires geolocation API)
- Hole flyover view

> Massive effort. Golfshot, 18Birdies, and every other golf app already does
> this with dedicated teams. Not our lane.

### 3c. Course Condition Reports — WON'T DO

- ~~Users can tag course conditions (wet, dry, fast greens, etc.)~~
- ~~Recent reports shown when selecting a course~~

> Replaced by the general course reporting system in 3a (reports for
> incorrect info, duplicates, inappropriate content). Condition tagging
> not planned.

---

## 4. Social & Sharing

### 4a. Activity Feed — FREE

- See recent rounds from your groups
- Like/comment on rounds

> Basic social features help engagement and make the app feel alive. Keep it
> simple — just rounds from your groups, no algorithmic feed.

### 4b. Shareable Round Cards — FREE

- Auto-generated image/card with round results (leaderboard, course, date)
- Optimised for sharing to iMessage, WhatsApp, Instagram stories

> Great viral growth mechanic. Relatively low effort — server-side image
> generation with canvas or SVG.

### 4c. Achievement Badges — FREE

- Milestone badges: first eagle, 100 rounds played, 5 different courses, etc.
- Display on profile

> Fun and lightweight. Encourages repeat usage. Not worth gating behind a
> paywall — the engagement benefit outweighs the monetisation potential.

---

## 5. Betting & Side Games

### 5a. Skins Game — FREE

- Automatic skins tracking alongside the Stableford round
- Configurable stakes (or just points)
- Settlement summary at end of round

> Great differentiator. Most scoring apps don't do this. Clean, contained
> feature that's easy to build alongside existing scoring.

### 5b. Nassau / Match Play Tracking — WON'T DO

- Front 9, back 9, overall — automatic tracking
- Press rules

> Niche format. Press rules are complicated and divisive (everyone plays
> different house rules). High effort for a small audience.

### 5c. Closest to Pin / Longest Drive — FREE ✅

- Mark specific holes for side competitions
- Players submit claims, leader verifies

> Shipped. Hole competitions with claim/winner system integrated into the
> live scoring flow.

---

## 6. Group Management Upgrades

### 6b. Group Stats & History — FREE ✅

- All-time group leaderboard
- Round history for the group
- "Group records" — best individual round, most points on a hole, etc.

> Shipped. Dedicated /groups/:id/stats page with Stableford/Strokes toggle,
> group records (best points, best strokes, most eagles), all-time leaderboard
> bar chart, expandable member breakdown with per-player scoring distributions,
> courses played table, and recent rounds table. Accessible from group detail
> page via Stats button.

### 6c. Group Roles & Permissions — FREE ✅

- ~~Admins, captains, members~~ Admins and members (simplified from original spec)
- Admin can manage membership, invites, roles, and delete group
- Multiple admins per group
- Group creator is automatically an admin; last admin cannot be demoted or leave

> Shipped. Replaced single-owner model with role-based permissions on the
> `group_members` table. Kept it simple with two roles — captain was
> dropped since any member can already create rounds.

### 6d. Group Chat / Noticeboard — WON'T DO

- Simple message board within a group
- Pin messages (e.g., "next round is Saturday 7am")

> Everyone already uses WhatsApp/iMessage. Building chat means moderation,
> abuse handling, notifications — all for a feature nobody will use when
> they already have a group chat elsewhere.

---

## 7. Advanced Scoring Modes

### 7a. Multiple Scoring Formats — FREE

- Stroke play (gross & net)
- Ambrose / Scramble (team format)
- Best ball / Four-ball
- Par competition (win/loss/halve per hole)

> Each format needs its own scoring logic, but they share the same input
> (strokes per hole). Casual players stick with Stableford, serious groups
> want variety.

### 7b. Team Rounds — FREE

- Split players into teams
- Combined team scoring
- Team leaderboard alongside individual

> Pairs well with Ambrose/Scramble from 7a. Fun for larger groups.

### 7c. Handicap Auto-Adjustment — FREE ✅

- Track unofficial "Dad Golf Handicap" based on recent rounds
- Automatically suggest handicap adjustments

> Shipped. GA/World Handicap System calculation using score differentials
> from last 20 rounds. Auto-updates user handicap when a round completes
> (opt-in via handicap settings). Manual handicap round entry also supported.

---

## 8. Quality of Life / Premium UX

### 8a. Offline Mode — WON'T DO

- Full offline scoring with sync when back online
- Conflict resolution for concurrent edits

> Offline sync is notoriously hard to get right, especially with real-time
> multiplayer. Edge cases are brutal. Most courses have enough reception
> for a lightweight WebSocket connection.

### 8b. Apple Watch / Wear OS Companion — WON'T DO

- Quick score entry from the wrist
- Glanceable leaderboard

> Requires native app development (Swift/Kotlin). Completely different
> skillset and maintenance burden. Not viable for a side project.

### 8c. Dark Mode / Themes — FREE ✅

- Dark mode + a few clean colour themes

> Shipped. Theme toggle with dark/light modes, persisted in localStorage.

### 8d. PWA Install Prompt — FREE ✅

- Make the "Add to Home Screen" experience seamless
- Custom splash screen, app icon

> Shipped. Service worker, manifest, and install prompt component.

### 8e. Export / PDF Scorecards — FREE

- Download a formatted scorecard as PDF
- Print-ready layout
- Email to the group after a round

> Low effort, nice keepsake for memorable rounds. PDF generation is
> straightforward server-side.

---

## 9. Integrations

### 9a. Calendar Integration — FREE ✅

- Add scheduled rounds to Google/Apple Calendar
- One-tap RSVP

> Shipped. Three tiers: (1) .ics file download for any calendar app,
> (2) Google Calendar OAuth sync that auto-creates/updates/deletes events
> on RSVP, (3) subscribable iCal feed URL for auto-sync in Apple Calendar,
> Google Calendar, Outlook, etc.

### 9b. Weather Integration — FREE ✅

- Show weather forecast for round day / course location
- Wind/rain warnings

> Shipped. Open-Meteo API integration with weather widget on the round page.

### 9c. Photo Attachment — WON'T DO

- Attach photos to specific holes
- Group photo gallery per round

> Needs file storage (S3 or similar), moderation, and ongoing storage costs.
> Everyone already takes photos on their phone — this doesn't add enough
> value to justify the infrastructure.

---

## 10. Admin & Org Features

### 10a. Club/Organisation Account — WON'T DO

- For actual golf clubs running regular comps
- Branded experience, bulk player management, competition scheduling

> This is a different product. Golf clubs already have dedicated comp
> management software. Building this means competing with established
> players in a market we don't understand.

### 10b. Tournament Mode — WON'T DO

- Multi-round tournaments with cuts
- Tee time management, flight pairings
- Live public leaderboard (spectator view)

> Same as above — huge scope, different audience. Dad Golf is for casual
> groups, not tournament directors.

---

## Summary

| #   | Feature                        | Category     |
| --- | ------------------------------ | ------------ |
| 1a  | Personal Stats Dashboard       | **FREE** ✅  |
| 1b  | Head-to-Head Comparisons       | **FREE**     |
| 1c  | Round Replay / Breakdown       | **FREE** ✅  |
| 2a  | Recurring Leagues              | **FREE**     |
| 2b  | League Leaderboard & Awards    | **FREE**     |
| 2c  | Scheduled Rounds               | **FREE** ✅  |
| 3a  | Community Course Database      | **FREE** ✅  |
| 3b  | Course GPS & Hole Maps         | **WON'T DO** |
| 3c  | Course Condition Reports       | **WON'T DO** |
| 4a  | Activity Feed                  | **FREE** ✅  |
| 4b  | Shareable Round Cards          | **FREE**     |
| 4c  | Achievement Badges             | **FREE** ✅  |
| 5a  | Skins Game                     | **FREE**     |
| 5b  | Nassau / Match Play            | **WON'T DO** |
| 5c  | Closest to Pin / Longest Drive | **FREE** ✅  |
| 6b  | Group Stats & History          | **FREE** ✅  |
| 6c  | Group Roles & Permissions      | **FREE** ✅  |
| 6d  | Group Chat / Noticeboard       | **WON'T DO** |
| 7a  | Multiple Scoring Formats       | **FREE**     |
| 7b  | Team Rounds                    | **FREE**     |
| 7c  | Handicap Auto-Adjustment       | **FREE** ✅  |
| 8a  | Offline Mode                   | **WON'T DO** |
| 8b  | Apple Watch Companion          | **WON'T DO** |
| 8c  | Dark Mode / Themes             | **FREE** ✅  |
| 8d  | PWA Install Prompt             | **FREE** ✅  |
| 8e  | PDF Scorecards                 | **FREE**     |
| 9a  | Calendar Integration           | **FREE** ✅  |
| 9b  | Weather Integration            | **FREE** ✅  |
| 9c  | Photo Attachment               | **WON'T DO** |
| 10a | Club/Organisation Account      | **WON'T DO** |
| 10b | Tournament Mode                | **WON'T DO** |

**Totals: 24 FREE (16 shipped), 8 WON'T DO**
