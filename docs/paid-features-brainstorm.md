# Paid Features Brainstorm

Ideas for future monetisation of Dad Golf. Organised by theme, with notes on
complexity and which tier they might suit.

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

## 1. Stats & Analytics (Pro)

### 1a. Personal Stats Dashboard
- Scoring averages over time (overall, per course, per hole)
- Stableford points trend graph
- Best/worst holes, par-3/4/5 breakdowns
- Handicap trend tracking (unofficial, based on round history)
- "Personal bests" badges

### 1b. Head-to-Head Comparisons
- Compare your stats against a mate across all shared rounds
- Win/loss record between two players
- "Rivalry" page for regular playing partners

### 1c. Round Replay & Hole-by-Hole Breakdown
- Post-round detailed breakdown with visualisations
- Share a round summary as an image/link (social card)

**Complexity:** Medium. Requires storing historical round data per user (currently
rounds exist but aren't strongly tied to user history). Mostly frontend charting
work + a few new API endpoints.

---

## 2. Leagues & Seasons (Pro)

### 2a. Recurring Leagues
- Create a league with a set of players and a season (e.g., 10 rounds over 3 months)
- Automatic standings based on cumulative Stableford points
- Configurable scoring: best N of M rounds, drop worst round, etc.
- End-of-season champion

### 2b. League Leaderboard & Awards
- Weekly/monthly leaderboards within a league
- Auto-generated awards: "Most Improved", "Most Consistent", "Eagle King", etc.
- Shareable league standings page (public link)

### 2c. Scheduled Rounds
- Pre-schedule rounds for a league (date, time, course)
- RSVP / availability tracking
- Reminders (push notification or email)

**Complexity:** High. New data models for leagues/seasons/standings. Significant
backend + frontend work. But this is the killer feature for regular groups.

---

## 3. Course Database & GPS (Pro)

### 3a. Community Course Database
- Crowdsourced course data — when a user creates a course, it becomes available
  to all users (with moderation/verification)
- Search courses by location, name, number of holes
- Course ratings/reviews from the community

### 3b. Course GPS & Hole Maps
- Upload or generate hole layouts
- GPS distance to pin (requires geolocation API)
- Hole flyover view
- This is a huge undertaking but would differentiate significantly

### 3c. Course Condition Reports
- Users can tag course conditions (wet, dry, fast greens, etc.)
- Recent reports shown when selecting a course

**Complexity:** 3a is medium (mostly moderation tooling). 3b is very high and
probably not worth building — better to integrate with an existing provider.
3c is low.

---

## 4. Social & Sharing (Freemium / Pro)

### 4a. Activity Feed (Free, limited)
- See recent rounds from your groups
- Like/comment on rounds
- Pro unlocks full history + cross-group feed

### 4b. Shareable Round Cards
- Auto-generated image/card with round results (leaderboard, course, date)
- Optimised for sharing to iMessage, WhatsApp, Instagram stories
- Free gets a basic card; Pro gets custom branding/templates

### 4c. Achievement Badges
- Milestone badges: first eagle, 100 rounds played, 5 different courses, etc.
- Display on profile
- Free gets a few basics; Pro unlocks the full set

**Complexity:** Low–Medium. 4b is highest value-to-effort here.

---

## 5. Betting & Side Games (Pro)

### 5a. Skins Game
- Automatic skins tracking alongside the Stableford round
- Configurable stakes (or just points)
- Settlement summary at end of round

### 5b. Nassau / Match Play Tracking
- Front 9, back 9, overall — automatic tracking
- Press rules

### 5c. Closest to Pin / Longest Drive
- Mark specific holes for side competitions
- Players submit claims, leader verifies

### 5d. Drink Tracker
- Track drink purchases owed (e.g., "buy a round if you 3-putt")
- Settlement ledger at end of round
- Pure fun feature, very on-brand for "Dad Golf"

**Complexity:** Medium. Skins (5a) is the easiest and most requested. The drink
tracker (5d) is low effort and high entertainment value.

---

## 6. Group Management Upgrades (Pro)

### 6a. Larger Groups
- Free: up to 8 members per group
- Pro: up to 64 (current limit) or more

### 6b. Group Stats & History
- All-time group leaderboard
- Round history for the group
- "Group records" — best individual round, most points on a hole, etc.

### 6c. Group Roles & Permissions
- Admins, captains, members
- Captain can manage rounds; admin can manage membership
- Multiple admins per group

### 6d. Group Chat / Noticeboard
- Simple message board within a group
- Pin messages (e.g., "next round is Saturday 7am")
- Keeps comms in-app instead of requiring a separate WhatsApp group

**Complexity:** 6a is trivial (just a limit change). 6b is medium. 6c is low.
6d is medium but adds ongoing moderation concerns.

---

## 7. Advanced Scoring Modes (Pro)

### 7a. Multiple Scoring Formats
- Stroke play (gross & net)
- Modified Stableford (PGA Tour variant)
- Ambrose / Scramble (team format)
- Best ball / Four-ball
- Par competition (win/loss/halve per hole)

### 7b. Team Rounds
- Split players into teams
- Combined team scoring
- Team leaderboard alongside individual

### 7c. Handicap Auto-Adjustment
- Track unofficial "Dad Golf Handicap" based on recent rounds
- Automatically suggest handicap adjustments
- Optional integration with Golf Australia / WHS handicap index

**Complexity:** 7a is medium-high (each format needs its own scoring logic).
7b is medium. 7c is medium and very useful.

---

## 8. Quality of Life / Premium UX (Pro)

### 8a. Offline Mode
- Full offline scoring with sync when back online
- Critical for courses with poor reception
- Free gets basic offline; Pro gets full sync + conflict resolution

### 8b. Apple Watch / Wear OS Companion
- Quick score entry from the wrist
- Glanceable leaderboard
- Vibration alerts when someone posts a score

### 8c. Dark Mode / Themes
- Could be free (dark mode) with Pro themes (course-inspired colour schemes)

### 8d. PWA Install Prompt
- Make the "Add to Home Screen" experience seamless
- Custom splash screen, app icon
- This should probably be free — it helps adoption

### 8e. Export / PDF Scorecards
- Download a formatted scorecard as PDF
- Print-ready layout
- Email to the group after a round

**Complexity:** 8a is high (offline sync is notoriously hard). 8b is very high.
8c/8d are low. 8e is low-medium and high value.

---

## 9. Integrations (Pro)

### 9a. Calendar Integration
- Add scheduled rounds to Google/Apple Calendar
- One-tap RSVP

### 9b. Weather Integration
- Show weather forecast for round day / course location
- Wind/rain warnings

### 9c. Photo Attachment
- Attach photos to specific holes (great shot, scenic view, etc.)
- Group photo gallery per round
- Storage costs make this a natural Pro feature

**Complexity:** 9a is low. 9b is low (free weather APIs exist). 9c is medium
(needs file storage — S3 or similar).

---

## 10. Admin & Org Features (Premium / Enterprise-ish)

### 10a. Club/Organisation Account
- For actual golf clubs running regular comps
- Branded experience (club logo, colours)
- Bulk player management
- Competition scheduling
- Result publishing to club website

### 10b. Tournament Mode
- Multi-round tournaments with cuts
- Tee time management
- Flight/group pairings
- Live public leaderboard (spectator view)

**Complexity:** Very high. This is a different product really, but could be a
long-term play if Dad Golf gets traction with clubs.

---

## Recommended First Paid Features (MVP Monetisation)

If picking a small set to build first:

1. **Personal Stats Dashboard** (1a) — easiest to build, immediate value
2. **Skins Game** (5a) — fun, social, differentiating
3. **Shareable Round Cards** (4b) — viral growth + premium feel
4. **Group Stats & History** (6b) — serves the core "regular group" use case
5. **PDF Scorecards** (8e) — low effort, feels premium

These five could form a compelling "Dad Golf Pro" launch package.

---

## What Should Stay Free Forever

- Core Stableford scoring
- Creating/joining rounds
- Basic course creation
- Groups (up to a reasonable size)
- Real-time leaderboard
- Account creation

The free tier must remain a complete, enjoyable experience. Paid features should
feel like "nice to have" upgrades, not gated essentials.
