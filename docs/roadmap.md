# Dad Golf Roadmap

Dependency graph and estimated durations for all planned features.
Estimates assume a solo developer working part-time (~15-20 hrs/week).

All features are free — Dad Golf is a free app.

---

## Dependency Graph

```mermaid
flowchart TD
    subgraph phase1["Phase 1: Quick Wins ✅"]
        direction LR
        P1B["8d. PWA Install ✅"]
        P1C["8c. Dark Mode ✅"]
        P1D["9b. Weather ✅"]
    end

    subgraph phase2["Phase 2: Core Features ✅"]
        P2A["1c. Round Replay ✅"]
        P2B["5c. CTP / Long Drive ✅"]
        P2D["6c. Group Roles ✅"]
        P2E["7c. Handicap Auto-Adj ✅"]
        P2F["3a. Community Courses ✅"]
    end

    subgraph phase3["Phase 3: Features w/ Dependencies ✅"]
        P3B["2c. Scheduled Rounds ✅"]
        P3C["9a. Calendar Integration ✅"]
        P3D["4a. Activity Feed ✅"]
        P3E["4c. Achievement Badges ✅"]
    end

    subgraph phase4["Phase 4: Wave 1"]
        P4A["1a. Stats Dashboard ✅"]
        P4B["5a. Skins Game\n2 weeks"]
        P4C["4b. Shareable Cards\n2 weeks"]
        P4D["8e. PDF Scorecards\n1.5 weeks"]
        P4E["6b. Group Stats ✅"]
    end

    subgraph phase5["Phase 5: Wave 2"]
        P5A["1b. Head-to-Head\n2 weeks"]
        P5B["2a. Recurring Leagues\n4-5 weeks"]
        P5C["7a. Scoring Formats\n3-4 weeks"]
    end

    subgraph phase6["Phase 6: Wave 3"]
        P6A["2b. League Awards\n2 weeks"]
        P6B["7b. Team Rounds\n2-3 weeks"]
    end

    %% Dependencies
    P2D --> P3B
    P3B --> P3C
    P2A --> P3D
    P2A --> P3E

    P2A --> P4A
    P4A --> P5A
    P5B --> P6A
    P5C --> P6B

    %% Styling
    classDef free fill:#d4edda,stroke:#28a745,color:#000

    class P1B,P1C,P1D,P2A,P2B,P2D,P2E,P2F,P3B,P3C,P3D,P3E,P4A,P4B,P4C,P4D,P4E,P5A,P5B,P5C,P6A,P6B free
```

**Legend:** Green = FREE (all features)

---

## Gantt Timeline

```mermaid
gantt
    title Dad Golf Feature Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %Y

    section Phase 1: Quick Wins ✅
    PWA Install Prompt (8d)         :done, p1b, 2026-05-04, 3d
    Weather Integration (9b)        :done, p1c, 2026-05-04, 3d
    Dark Mode (8c)                  :done, p1d, 2026-05-07, 5d

    section Phase 2: Core Features ✅
    CTP / Longest Drive (5c)        :done, p2b, 2026-05-18, 5d
    Group Roles (6c)                :done, p2d, 2026-05-25, 5d
    Handicap Auto-Adj (7c)          :done, p2e, 2026-05-25, 5d
    Round Replay (1c)               :done, p2a, 2026-06-01, 8d
    Community Courses (3a)          :done, p2f, 2026-06-01, 10d

    section Phase 3: Features w/ Deps ✅
    Scheduled Rounds (2c)           :done, p3b, after p2d, 10d
    Calendar Integration (9a)       :done, p3c, after p3b, 5d
    Activity Feed (4a)              :done, p3d, after p2a, 10d
    Achievement Badges (4c)         :done, p3e, after p2a, 8d

    section Phase 4: Wave 1
    Stats Dashboard (1a)            :p4a, 2026-07-13, 15d
    Skins Game (5a)                 :p4b, 2026-07-13, 10d
    Shareable Cards (4b)            :p4c, after p4b, 10d
    PDF Scorecards (8e)             :p4d, after p4c, 8d
    Group Stats (6b)                :p4e, after p4b, 10d

    section Phase 5: Wave 2
    Head-to-Head (1b)               :p5a, after p4a, 10d
    Recurring Leagues (2a)          :p5b, after p4e, 25d
    Scoring Formats (7a)            :p5c, after p5a, 20d

    section Phase 6: Wave 3
    League Awards (2b)              :p6a, after p5b, 10d
    Team Rounds (7b)                :p6b, after p5c, 13d
```

---

## Phase Breakdown

### Phase 1: Quick Wins ✅

| Feature                 | Duration | Depends On | Notes      |
| ----------------------- | -------- | ---------- | ---------- |
| 8d. PWA Install Prompt  | 3 days   | —          | ✅ Shipped |
| 9b. Weather Integration | 3 days   | —          | ✅ Shipped |
| 8c. Dark Mode           | 1 week   | —          | ✅ Shipped |

**Phase complete.**

---

### Phase 2: Core Features ✅

| Feature                 | Duration  | Depends On | Notes                                                            |
| ----------------------- | --------- | ---------- | ---------------------------------------------------------------- |
| 5c. CTP / Longest Drive | 1 week    | —          | ✅ Shipped                                                       |
| 6c. Group Roles         | 1 week    | —          | ✅ Shipped (admin/member, simplified)                            |
| 7c. Handicap Auto-Adj   | 1 week    | —          | ✅ Shipped — GA/WHS rolling calc, auto-updates on round complete |
| 1c. Round Replay        | 1.5 weeks | —          | ✅ Shipped — scorecard, progression chart, per-player stats      |
| 3a. Community Courses   | 2 weeks   | —          | ✅ Shipped — shared courses, reviews, ratings, reports           |

**Phase complete.**

---

### Phase 3: Features with Dependencies ✅

| Feature                  | Duration  | Depends On | Notes                                                                 |
| ------------------------ | --------- | ---------- | --------------------------------------------------------------------- |
| 2c. Scheduled Rounds     | 2 weeks   | 6c         | ✅ Shipped — date/time/course, RSVP, auto-start with accepted players |
| 9a. Calendar Integration | 1 week    | 2c         | ✅ Shipped — .ics export, Google Calendar OAuth sync, iCal feed URL   |
| 4a. Activity Feed        | 2 weeks   | 1c         | ✅ Shipped — Group activity feed with likes/comments, privacy controls, 7 event types |
| 4c. Achievement Badges   | 1.5 weeks | 1c         | ✅ Shipped — 12 badges across 4 categories, public user profiles, auto-evaluation      |

**All shipped!**

---

### Phase 4: Wave 1

| Feature             | Duration  | Depends On | Notes                                   |
| ------------------- | --------- | ---------- | --------------------------------------- |
| 1a. Stats Dashboard | 2-3 weeks | 1c         | ✅ Shipped — Stableford/Strokes toggle, overview cards, trend chart, par breakdown, course stats |
| 5a. Skins Game      | 2 weeks   | —          | Parallel scoring layer on rounds        |
| 4b. Shareable Cards | 2 weeks   | —          | Server-side image gen (canvas/SVG)      |
| 8e. PDF Scorecards  | 1.5 weeks | —          | PDF generation (pdfkit or similar)      |
| 6b. Group Stats     | 2 weeks   | —          | ✅ Shipped — All-time leaderboard, records, member breakdown, course stats |

**Phase total: ~7 weeks** (some can run in parallel)

---

### Phase 5: Wave 2

| Feature               | Duration  | Depends On | Notes                                |
| --------------------- | --------- | ---------- | ------------------------------------ |
| 1b. Head-to-Head      | 2 weeks   | 1a         | Extends stats infra with comparisons |
| 2a. Recurring Leagues | 4-5 weeks | —          | New data models, standings, seasons  |
| 7a. Scoring Formats   | 3-4 weeks | —          | Stroke, Ambrose, best ball, par comp |

**Phase total: ~9 weeks** (parallel tracks possible)

The big features. Leagues (2a) is the highest-effort item on the entire
roadmap but also the stickiest feature.

---

### Phase 6: Wave 3

| Feature           | Duration  | Depends On | Notes                                  |
| ----------------- | --------- | ---------- | -------------------------------------- |
| 2b. League Awards | 2 weeks   | 2a         | Auto-generated awards from league data |
| 7b. Team Rounds   | 2-3 weeks | 7a         | Team assignment + combined scoring     |

**Phase total: ~4 weeks** (can overlap with late Phase 5)

Extensions of Phase 5 features. Only buildable once the parent features
are stable.

---

## Critical Path

The longest dependency chain determines the earliest possible completion:

```
Stats Dashboard (3w) → Head-to-Head (2w)
Recurring Leagues (5w) → League Awards (2w)    ← longest
Scoring Formats (4w) → Team Rounds (3w)
```

**Longest chain: Leagues → Awards = ~7 weeks**

Including shipped features (Phases 1-3), the remaining features (Phases 4-6)
could ship over approximately **5-6 months** at part-time pace.

---

## Estimated Total Effort

| Category           | Features                | Est. Weeks      |
| ------------------ | ----------------------- | --------------- |
| Shipped            | 16 features ✅          | ~0 weeks        |
| Remaining          | 8 features              | ~19 weeks       |
| **Total remaining**| **8 features**          | **~19 weeks**   |

**Shipped so far:** 8c Dark Mode, 8d PWA Install, 9b Weather, 5c CTP/Longest Drive, 6c Group Roles, 7c Handicap Auto-Adj, 1c Round Replay, 3a Community Courses, 2c Scheduled Rounds, 9a Calendar Integration, 4a Activity Feed, 4c Achievement Badges, 1a Stats Dashboard, 6b Group Stats (plus location autocomplete and course reviews).

At part-time pace (~15-20 hrs/week), remaining work is roughly **5-6 months** of
calendar time with some parallelism.
