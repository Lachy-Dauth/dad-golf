# Paid Features Brainstorm

Ideas for future monetisation of Dad Golf. Organised by theme, with each feature
categorised as:

- **FREE** — Should be included for free. Improves the core experience or drives adoption.
- **PRO** — Genuinely good paid feature. Worth building and charging for.
- **WON'T DO** — Too much effort, too niche, or better served by other apps. Not worth building.

---

## Pricing Model Thoughts

A **freemium** model makes the most sense — the core scoring experience stays
free forever (that's how you get adoption), and paid tiers unlock power-user,
social, and analytics features. Two tiers probably suffice:

| Tier | Price (rough) | Target |
|------|--------------|--------|
| **Free** | $0 | Casual players, first-timers |
| **Dad Golf Pro** | ~$5–8/month or ~$40–60/year | Regular golfers, group organisers |

A one-time lifetime purchase (~$30–50) could work well too given the audience
(dads who hate subscriptions).

---

## 1. Stats & Analytics

### 1a. Personal Stats Dashboard — PRO
- Scoring averages over time (overall, per course, per hole)
- Stableford points trend graph
- Best/worst holes, par-3/4/5 breakdowns
- Handicap trend tracking (unofficial, based on round history)
- "Personal bests" badges

> Classic "upgrade for insights" feature. The data already exists from completed
> rounds — this is mostly frontend charting work and a few new endpoints.

### 1b. Head-to-Head Comparisons — PRO
- Compare your stats against a mate across all shared rounds
- Win/loss record between two players
- "Rivalry" page for regular playing partners

> Fun for competitive groups. Natural upsell from the stats dashboard.

### 1c. Round Replay & Hole-by-Hole Breakdown — FREE
- Post-round detailed breakdown with visualisations
- Hole-by-hole scoring summary for each player

> A proper end-of-round summary should be part of the core experience. The
> data is already there — just needs a good summary view. (Sharing as an
> image/card is covered separately in 4b.)

---

## 2. Leagues & Seasons

### 2a. Recurring Leagues — PRO
- Create a league with a set of players and a season (e.g., 10 rounds over 3 months)
- Automatic standings based on cumulative Stableford points
- Configurable scoring: best N of M rounds, drop worst round, etc.
- End-of-season champion

> The killer Pro feature for regular groups. High effort but high reward —
> this is the thing that keeps people paying month after month.

### 2b. League Leaderboard & Awards — PRO
- Weekly/monthly leaderboards within a league
- Auto-generated awards: "Most Improved", "Most Consistent", "Eagle King", etc.
- Shareable league standings page (public link)

> Natural extension of leagues. Awards are fun and low effort once leagues exist.

### 2c. Scheduled Rounds — FREE
- Pre-schedule rounds for a league (date, time, course)
- RSVP / availability tracking

> Useful for regular groups to coordinate upcoming rounds. Keeps round
> planning inside the app instead of scattered across group chats.

---

## 3. Course Database & GPS

### 3a. Community Course Database — FREE
- Crowdsourced course data — when a user creates a course, it becomes available
  to all users (with moderation/verification)
- Search courses by location, name, number of holes
- Course ratings/reviews from the community

> Courses are already user-created — making them shared is a natural evolution.
> Grows the platform and reduces friction for new users. Needs basic moderation
> but nothing heavy.

### 3b. Course GPS & Hole Maps — WON'T DO
- Upload or generate hole layouts
- GPS distance to pin (requires geolocation API)
- Hole flyover view

> Massive effort. Golfshot, 18Birdies, and every other golf app already does
> this with dedicated teams. Not our lane.

### 3c. Course Condition Reports — FREE
- Users can tag course conditions (wet, dry, fast greens, etc.)
- Recent reports shown when selecting a course

> Simple tagging feature. Low effort to build and useful context when
> picking a course. Grows in value as the user base grows.

---

## 4. Social & Sharing

### 4a. Activity Feed — FREE
- See recent rounds from your groups
- Like/comment on rounds

> Basic social features help engagement and make the app feel alive. Keep it
> simple — just rounds from your groups, no algorithmic feed.

### 4b. Shareable Round Cards — PRO
- Auto-generated image/card with round results (leaderboard, course, date)
- Optimised for sharing to iMessage, WhatsApp, Instagram stories

> Great viral growth mechanic. Feels premium. Relatively low effort —
> server-side image generation with canvas or SVG.

### 4c. Achievement Badges — FREE
- Milestone badges: first eagle, 100 rounds played, 5 different courses, etc.
- Display on profile

> Fun and lightweight. Encourages repeat usage. Not worth gating behind a
> paywall — the engagement benefit outweighs the monetisation potential.

---

## 5. Betting & Side Games

### 5a. Skins Game — PRO
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

### 5c. Closest to Pin / Longest Drive — FREE
- Mark specific holes for side competitions
- Players submit claims, leader verifies

> Simple, fun feature. Just a flag on a hole + a text field. Low effort,
> makes rounds more engaging for everyone.

### 5d. Drink Tracker — FREE
- Track drink purchases owed (e.g., "buy a round if you 3-putt")
- Settlement ledger at end of round
- Pure fun feature, very on-brand for "Dad Golf"

> This IS the brand. Low effort, high entertainment value. Would feel wrong
> to charge for it. Great for word-of-mouth.

---

## 6. Group Management Upgrades

### 6a. Larger Groups — FREE
- Keep the current 64-member limit for everyone

> Artificial group size limits feel hostile and petty. Don't gate this.

### 6b. Group Stats & History — PRO
- All-time group leaderboard
- Round history for the group
- "Group records" — best individual round, most points on a hole, etc.

> Natural Pro feature. "Who's the all-time best in the group?" is a question
> every regular group wants answered. Drives competitive engagement.

### 6c. Group Roles & Permissions — FREE
- Admins, captains, members
- Captain can manage rounds; admin can manage membership
- Multiple admins per group

> Basic group management. Shouldn't be gated — it's just good UX for
> groups with more than one organiser.

### 6d. Group Chat / Noticeboard — WON'T DO
- Simple message board within a group
- Pin messages (e.g., "next round is Saturday 7am")

> Everyone already uses WhatsApp/iMessage. Building chat means moderation,
> abuse handling, notifications — all for a feature nobody will use when
> they already have a group chat elsewhere.

---

## 7. Advanced Scoring Modes

### 7a. Multiple Scoring Formats — PRO
- Stroke play (gross & net)
- Ambrose / Scramble (team format)
- Best ball / Four-ball
- Par competition (win/loss/halve per hole)

> Each format needs its own scoring logic, but they share the same input
> (strokes per hole). Good Pro value — casual players stick with Stableford,
> serious groups want variety.

### 7b. Team Rounds — PRO
- Split players into teams
- Combined team scoring
- Team leaderboard alongside individual

> Pairs well with Ambrose/Scramble from 7a. Fun for larger groups.

### 7c. Handicap Auto-Adjustment — FREE
- Track unofficial "Dad Golf Handicap" based on recent rounds
- Automatically suggest handicap adjustments

> Natural extension of the existing handicap system. The app already tracks
> rounds and scores — computing a running handicap is straightforward and
> makes the core product better for everyone.

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

### 8c. Dark Mode / Themes — FREE
- Dark mode + a few clean colour themes

> Dark mode is table stakes in 2026. Just ship it for free.

### 8d. PWA Install Prompt — FREE
- Make the "Add to Home Screen" experience seamless
- Custom splash screen, app icon

> Helps adoption. Makes the app feel native. Zero reason to gate this.

### 8e. Export / PDF Scorecards — PRO
- Download a formatted scorecard as PDF
- Print-ready layout
- Email to the group after a round

> Low effort, feels premium. Nice keepsake for memorable rounds. PDF
> generation is straightforward server-side.

---

## 9. Integrations

### 9a. Calendar Integration — FREE
- Add scheduled rounds to Google/Apple Calendar
- One-tap RSVP

> Natural companion to Scheduled Rounds (2c). Low effort — just generate
> an .ics link or use a calendar API. Makes scheduling feel complete.

### 9b. Weather Integration — FREE
- Show weather forecast for round day / course location
- Wind/rain warnings

> Free weather APIs exist. Quick to implement, genuinely useful, and a
> nice polish touch on the round creation screen.

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

| # | Feature | Category |
|---|---------|----------|
| 1a | Personal Stats Dashboard | **PRO** |
| 1b | Head-to-Head Comparisons | **PRO** |
| 1c | Round Replay / Breakdown | **FREE** |
| 2a | Recurring Leagues | **PRO** |
| 2b | League Leaderboard & Awards | **PRO** |
| 2c | Scheduled Rounds | **FREE** |
| 3a | Community Course Database | **FREE** |
| 3b | Course GPS & Hole Maps | **WON'T DO** |
| 3c | Course Condition Reports | **FREE** |
| 4a | Activity Feed | **FREE** |
| 4b | Shareable Round Cards | **PRO** |
| 4c | Achievement Badges | **FREE** |
| 5a | Skins Game | **PRO** |
| 5b | Nassau / Match Play | **WON'T DO** |
| 5c | Closest to Pin / Longest Drive | **FREE** |
| 5d | Drink Tracker | **FREE** |
| 6a | Larger Groups | **FREE** |
| 6b | Group Stats & History | **PRO** |
| 6c | Group Roles & Permissions | **FREE** |
| 6d | Group Chat / Noticeboard | **WON'T DO** |
| 7a | Multiple Scoring Formats | **PRO** |
| 7b | Team Rounds | **PRO** |
| 7c | Handicap Auto-Adjustment | **FREE** |
| 8a | Offline Mode | **WON'T DO** |
| 8b | Apple Watch Companion | **WON'T DO** |
| 8c | Dark Mode / Themes | **FREE** |
| 8d | PWA Install Prompt | **FREE** |
| 8e | PDF Scorecards | **PRO** |
| 9a | Calendar Integration | **FREE** |
| 9b | Weather Integration | **FREE** |
| 9c | Photo Attachment | **WON'T DO** |
| 10a | Club/Organisation Account | **WON'T DO** |
| 10b | Tournament Mode | **WON'T DO** |

**Totals: 16 FREE, 10 PRO, 8 WON'T DO**
