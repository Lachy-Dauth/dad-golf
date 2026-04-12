# Dad Golf Roadmap

Dependency graph and estimated durations for all FREE and PRO features.
Estimates assume a solo developer working part-time (~15-20 hrs/week).

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

    subgraph phase2["Phase 2: Core Free Features (in progress)"]
        P2A["1c. Round Replay\n1.5 weeks"]
        P2B["5c. CTP / Long Drive ✅"]
        P2D["6c. Group Roles ✅"]
        P2E["7c. Handicap Auto-Adj\n1 week"]
        P2F["3a. Community Courses\n2 weeks"]
    end

    subgraph phase3["Phase 3: Free Features w/ Dependencies (weeks 7-12)"]
        P3B["2c. Scheduled Rounds\n2 weeks"]
        P3C["9a. Calendar Integration\n1 week"]
        P3D["4a. Activity Feed\n2 weeks"]
        P3E["4c. Achievement Badges\n1.5 weeks"]
    end

    subgraph phase4["Phase 4: Pro Infrastructure (weeks 11-13)"]
        P4A["Stripe / Payment System\n2-3 weeks"]
        P4B["Pro Gating Middleware\n3 days"]
    end

    subgraph phase5["Phase 5: Pro Wave 1 (weeks 14-20)"]
        P5A["1a. Stats Dashboard\n2-3 weeks"]
        P5B["5a. Skins Game\n2 weeks"]
        P5C["4b. Shareable Cards\n2 weeks"]
        P5D["8e. PDF Scorecards\n1.5 weeks"]
        P5E["6b. Group Stats\n2 weeks"]
    end

    subgraph phase6["Phase 6: Pro Wave 2 (weeks 21-30)"]
        P6A["1b. Head-to-Head\n2 weeks"]
        P6B["2a. Recurring Leagues\n4-5 weeks"]
        P6C["7a. Scoring Formats\n3-4 weeks"]
    end

    subgraph phase7["Phase 7: Pro Wave 3 (weeks 29-34)"]
        P7A["2b. League Awards\n2 weeks"]
        P7B["7b. Team Rounds\n2-3 weeks"]
    end

    %% Dependencies
    P2D --> P3B
    P3B --> P3C
    P2A --> P3D
    P2A --> P3E

    P4A --> P4B
    P4B --> P5A
    P4B --> P5B
    P4B --> P5C
    P4B --> P5D
    P4B --> P5E

    P5A --> P6A
    P4B --> P6B
    P4B --> P6C

    P6B --> P7A
    P6C --> P7B

    %% Styling
    classDef free fill:#d4edda,stroke:#28a745,color:#000
    classDef pro fill:#fff3cd,stroke:#ffc107,color:#000
    classDef infra fill:#d1ecf1,stroke:#17a2b8,color:#000

    class P1B,P1C,P1D,P2A,P2B,P2D,P2E,P2F,P3B,P3C,P3D,P3E free
    class P5A,P5B,P5C,P5D,P5E,P6A,P6B,P6C,P7A,P7B pro
    class P4A,P4B infra
```

**Legend:** Green = FREE, Yellow = PRO, Blue = Infrastructure

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

    section Phase 2: Core Free
    CTP / Longest Drive (5c)        :done, p2b, 2026-05-18, 5d
    Group Roles (6c)                :done, p2d, 2026-05-25, 5d
    Handicap Auto-Adj (7c)          :p2e, 2026-05-25, 5d
    Round Replay (1c)               :p2a, 2026-06-01, 8d
    Community Courses (3a)          :p2f, 2026-06-01, 10d

    section Phase 3: Free w/ Deps
    Scheduled Rounds (2c)           :p3b, after p2d, 10d
    Calendar Integration (9a)       :p3c, after p3b, 5d
    Activity Feed (4a)              :p3d, after p2a, 10d
    Achievement Badges (4c)         :p3e, after p2a, 8d

    section Phase 4: Pro Infra
    Stripe / Payments               :p4a, 2026-07-13, 15d
    Pro Gating Middleware            :p4b, after p4a, 3d

    section Phase 5: Pro Wave 1
    Stats Dashboard (1a)            :p5a, after p4b, 15d
    Skins Game (5a)                 :p5b, after p4b, 10d
    Shareable Cards (4b)            :p5c, after p5b, 10d
    PDF Scorecards (8e)             :p5d, after p5c, 8d
    Group Stats (6b)                :p5e, after p5b, 10d

    section Phase 6: Pro Wave 2
    Head-to-Head (1b)               :p6a, after p5a, 10d
    Recurring Leagues (2a)          :p6b, after p5e, 25d
    Scoring Formats (7a)            :p6c, after p6a, 20d

    section Phase 7: Pro Wave 3
    League Awards (2b)              :p7a, after p6b, 10d
    Team Rounds (7b)                :p7b, after p6c, 13d
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

### Phase 2: Core Free Features (In Progress)

| Feature                 | Duration  | Depends On | Notes                                    |
| ----------------------- | --------- | ---------- | ---------------------------------------- |
| 5c. CTP / Longest Drive | 1 week    | —          | ✅ Shipped                               |
| 6c. Group Roles         | 1 week    | —          | ✅ Shipped (admin/member, simplified)    |
| 7c. Handicap Auto-Adj   | 1 week    | —          | Rolling calc from recent scores          |
| 1c. Round Replay        | 1.5 weeks | —          | Summary view, hole-by-hole breakdown     |
| 3a. Community Courses   | 2 weeks   | —          | Shared courses, search, basic moderation |

**Remaining: ~4.5 weeks** (some can run in parallel)

These are the features that make the free tier genuinely compelling.

---

### Phase 3: Free Features with Dependencies (Weeks 7-12)

| Feature                  | Duration  | Depends On | Notes                            |
| ------------------------ | --------- | ---------- | -------------------------------- |
| 2c. Scheduled Rounds     | 2 weeks   | 6c         | Date/time/course + RSVP          |
| 9a. Calendar Integration | 1 week    | 2c         | .ics export + calendar API       |
| 4a. Activity Feed        | 2 weeks   | 1c         | Group round feed + likes         |
| 4c. Achievement Badges   | 1.5 weeks | 1c         | Badge definitions + unlock logic |

**Phase total: ~5 weeks** (overlaps with late Phase 2)

Can start some of these before Phase 2 finishes since they only depend
on specific Phase 2 items.

---

### Phase 4: Pro Infrastructure (Weeks 11-13)

| Feature                 | Duration  | Depends On | Notes                                 |
| ----------------------- | --------- | ---------- | ------------------------------------- |
| Stripe / Payment System | 2-3 weeks | —          | Checkout, webhooks, subscription mgmt |
| Pro Gating Middleware   | 3 days    | Stripe     | Server middleware + client UI gates   |

**Phase total: ~3 weeks**

Must be solid before shipping any Pro features. Include subscription
management page, billing portal link, and graceful upgrade prompts.

---

### Phase 5: Pro Wave 1 (Weeks 14-20)

| Feature             | Duration  | Depends On | Notes                                   |
| ------------------- | --------- | ---------- | --------------------------------------- |
| 1a. Stats Dashboard | 2-3 weeks | Pro infra  | Charts, API endpoints, history queries  |
| 5a. Skins Game      | 2 weeks   | Pro infra  | Parallel scoring layer on rounds        |
| 4b. Shareable Cards | 2 weeks   | Pro infra  | Server-side image gen (canvas/SVG)      |
| 8e. PDF Scorecards  | 1.5 weeks | Pro infra  | PDF generation (pdfkit or similar)      |
| 6b. Group Stats     | 2 weeks   | Pro infra  | Aggregate queries, all-time leaderboard |

**Phase total: ~7 weeks** (some can run in parallel)

This is the Pro launch. These five features form the initial "Dad Golf Pro"
package — enough to justify the price.

---

### Phase 6: Pro Wave 2 (Weeks 21-30)

| Feature               | Duration  | Depends On | Notes                                |
| --------------------- | --------- | ---------- | ------------------------------------ |
| 1b. Head-to-Head      | 2 weeks   | 1a         | Extends stats infra with comparisons |
| 2a. Recurring Leagues | 4-5 weeks | Pro infra  | New data models, standings, seasons  |
| 7a. Scoring Formats   | 3-4 weeks | Pro infra  | Stroke, Ambrose, best ball, par comp |

**Phase total: ~9 weeks** (parallel tracks possible)

The big features. Leagues (2a) is the highest-effort item on the entire
roadmap but also the stickiest Pro feature.

---

### Phase 7: Pro Wave 3 (Weeks 29-34)

| Feature           | Duration  | Depends On | Notes                                  |
| ----------------- | --------- | ---------- | -------------------------------------- |
| 2b. League Awards | 2 weeks   | 2a         | Auto-generated awards from league data |
| 7b. Team Rounds   | 2-3 weeks | 7a         | Team assignment + combined scoring     |

**Phase total: ~4 weeks** (can overlap with late Phase 6)

Extensions of Phase 6 features. Only buildable once the parent features
are stable.

---

## Critical Path

The longest dependency chain determines the earliest possible completion:

```
Pro Infra (3w) → Stats Dashboard (3w) → Head-to-Head (2w)
Pro Infra (3w) → Recurring Leagues (5w) → League Awards (2w)    ← longest
Pro Infra (3w) → Scoring Formats (4w) → Team Rounds (3w)
```

**Longest chain: Pro Infra → Leagues → Awards = ~10 weeks**

Including free features before Pro, total roadmap is approximately
**8-9 months** at part-time pace. The free features (Phases 1-3) could
ship within the first **3 months**, with Pro features rolling out over
the following **5-6 months**.

---

## Estimated Total Effort

| Category           | Features                | Est. Weeks      |
| ------------------ | ----------------------- | --------------- |
| FREE (shipped)     | 5 features ✅           | ~0 weeks        |
| FREE (remaining)   | 10 features             | ~12.5 weeks     |
| PRO Infrastructure | Payment + gating        | ~3 weeks        |
| PRO                | 10 features             | ~24 weeks       |
| **Remaining**      | **20 features + infra** | **~39.5 weeks** |

**Shipped so far:** 8c Dark Mode, 8d PWA Install, 9b Weather, 5c CTP/Longest Drive, 6c Group Roles.

At part-time pace (~15-20 hrs/week), remaining work is roughly **9-10 months** of
calendar time with some parallelism.
