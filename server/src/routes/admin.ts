import type { FastifyInstance } from "fastify";
import type { Hole } from "@dad-golf/shared";
import { generateRoomCode, calculateScoreDifferential } from "@dad-golf/shared";
import {
  createGroup,
  createUser,
  createCourse,
  addGroupMember,
  deleteRound,
  deleteUserAsAdmin,
  dismissCourseReports,
  getActivityFeed,
  getAdminStats,
  getRound,
  getUser,
  listAllCourses,
  listAllGroups,
  listAllRounds,
  listAllUsers,
  listCourseReports,
  awardBadge,
  createRound,
  updateRoundStatus,
  updateRoundCurrentHole,
  addPlayer,
  upsertScore,
  createCompetition,
  upsertClaim,
  setClaimWinner,
  createScheduledRound,
  updateScheduledRoundStatus,
  upsertRsvp,
  createHandicapRound,
  upsertCourseReview,
  createCourseReport,
  favoriteCourse,
  createGroupInvite,
  createActivityEvent,
  likeActivityEvent,
  addActivityComment,
} from "../db/index.js";
import { pool } from "../db/pool.js";
import { parsePagination, requireAdmin } from "./validation.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/stats", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return await getAdminStats();
  });

  app.get("/api/admin/users", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { users: await listAllUsers() };
  });

  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    if (req.params.id === user.id) {
      return reply.code(400).send({ error: "cannot delete yourself" });
    }
    const target = await getUser(req.params.id);
    if (!target) {
      return reply.code(404).send({ error: "user not found" });
    }
    await deleteUserAsAdmin(req.params.id);
    return { ok: true };
  });

  app.get<{
    Querystring: { limit?: string; offset?: string };
  }>("/api/admin/rounds", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    const { limit, offset } = parsePagination(req.query, { limit: 50, maxLimit: 200 });
    return await listAllRounds(limit, offset);
  });

  app.delete<{ Params: { id: string } }>("/api/admin/rounds/:id", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    const round = await getRound(req.params.id);
    if (!round) return reply.code(404).send({ error: "round not found" });
    await deleteRound(round.id);
    return { ok: true };
  });

  app.get("/api/admin/courses", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { courses: await listAllCourses() };
  });

  app.get("/api/admin/groups", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { groups: await listAllGroups() };
  });

  app.get<{
    Querystring: { limit?: string };
  }>("/api/admin/activity", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    const parsed = Number(req.query.limit);
    const limit = Number.isFinite(parsed) ? Math.max(0, Math.min(Math.floor(parsed), 200)) : 50;
    return { events: await getActivityFeed(limit) };
  });

  // --- Course Reports ---

  app.get("/api/admin/course-reports", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { reports: await listCourseReports() };
  });

  app.delete<{ Params: { courseId: string } }>(
    "/api/admin/course-reports/:courseId",
    async (req, reply) => {
      const user = await requireAdmin(req, reply);
      if (!user) return;
      await dismissCourseReports(req.params.courseId);
      return { ok: true };
    },
  );

  // --- Seed demo activity & badge data ---

  app.post("/api/admin/seed-activity", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const daysAgo = (n: number, hour = 7) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const daysFromNow = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().split("T")[0];
    };
    const generateScore = (par: number, handicap: number): number => {
      const extra = handicap / 18;
      const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 1.5;
      return Math.max(1, Math.min(par + 5, Math.round(par + extra + noise)));
    };

    const counts = {
      users: 0,
      courses: 0,
      groups: 0,
      members: 0,
      invites: 0,
      completedRounds: 0,
      inProgressRounds: 0,
      waitingRounds: 0,
      scores: 0,
      competitions: 0,
      scheduledRounds: 0,
      rsvps: 0,
      handicapEntries: 0,
      reviews: 0,
      reports: 0,
      favorites: 0,
      events: 0,
      likes: 0,
      comments: 0,
      badges: 0,
    };

    // === STEP 1: USERS ===
    type SeedUser = { id: string; displayName: string; username: string; handicap: number };
    const fakeUsers: SeedUser[] = [];
    const fakeNames = [
      { display: "Dave Thompson", user: "dave_t", handicap: 12 },
      { display: "Steve Mitchell", user: "steve_m", handicap: 18 },
      { display: "Matt O'Brien", user: "matt_ob", handicap: 22 },
      { display: "Pete Collins", user: "pete_c", handicap: 15 },
      { display: "Tom Harris", user: "tom_h", handicap: 28 },
      { display: "Chris Walker", user: "chris_w", handicap: 20 },
      { display: "Nick Palmer", user: "nick_p", handicap: 16 },
      { display: "Sam Roberts", user: "sam_r", handicap: 25 },
    ];

    for (const fn of fakeNames) {
      const { rows: existing } = await pool.query(
        `SELECT id, handicap FROM users WHERE username = $1`,
        [fn.user],
      );
      if (existing.length > 0) {
        fakeUsers.push({
          id: existing[0].id,
          displayName: fn.display,
          username: fn.user,
          handicap: Number(existing[0].handicap),
        });
        continue;
      }
      const u = await createUser(fn.user, "demo1234", fn.display, fn.handicap);
      fakeUsers.push({
        id: u.id,
        displayName: fn.display,
        username: fn.user,
        handicap: fn.handicap,
      });
      counts.users++;
    }

    // === STEP 2: COURSES ===
    const seedCourses: Array<{
      name: string;
      location: string;
      rating: number;
      slope: number;
      lat: number;
      lng: number;
      holes: Hole[];
    }> = [
      {
        name: "Royal Melbourne Golf Club (West)",
        location: "Black Rock, VIC",
        rating: 73.5,
        slope: 137,
        lat: -37.95,
        lng: 145.04,
        holes: [
          { number: 1, par: 4, strokeIndex: 7 },
          { number: 2, par: 5, strokeIndex: 13 },
          { number: 3, par: 3, strokeIndex: 15 },
          { number: 4, par: 4, strokeIndex: 3 },
          { number: 5, par: 3, strokeIndex: 11 },
          { number: 6, par: 4, strokeIndex: 1 },
          { number: 7, par: 4, strokeIndex: 5 },
          { number: 8, par: 4, strokeIndex: 9 },
          { number: 9, par: 5, strokeIndex: 17 },
          { number: 10, par: 4, strokeIndex: 8 },
          { number: 11, par: 4, strokeIndex: 2 },
          { number: 12, par: 4, strokeIndex: 4 },
          { number: 13, par: 3, strokeIndex: 16 },
          { number: 14, par: 4, strokeIndex: 6 },
          { number: 15, par: 4, strokeIndex: 10 },
          { number: 16, par: 3, strokeIndex: 18 },
          { number: 17, par: 5, strokeIndex: 14 },
          { number: 18, par: 4, strokeIndex: 12 },
        ],
      },
      {
        name: "Barnbougle Dunes",
        location: "Bridport, TAS",
        rating: 73.0,
        slope: 132,
        lat: -41.07,
        lng: 147.38,
        holes: [
          { number: 1, par: 4, strokeIndex: 9 },
          { number: 2, par: 4, strokeIndex: 5 },
          { number: 3, par: 3, strokeIndex: 13 },
          { number: 4, par: 4, strokeIndex: 1 },
          { number: 5, par: 5, strokeIndex: 11 },
          { number: 6, par: 3, strokeIndex: 15 },
          { number: 7, par: 4, strokeIndex: 3 },
          { number: 8, par: 3, strokeIndex: 17 },
          { number: 9, par: 4, strokeIndex: 7 },
          { number: 10, par: 4, strokeIndex: 2 },
          { number: 11, par: 3, strokeIndex: 16 },
          { number: 12, par: 4, strokeIndex: 4 },
          { number: 13, par: 4, strokeIndex: 8 },
          { number: 14, par: 4, strokeIndex: 6 },
          { number: 15, par: 3, strokeIndex: 18 },
          { number: 16, par: 4, strokeIndex: 10 },
          { number: 17, par: 5, strokeIndex: 14 },
          { number: 18, par: 3, strokeIndex: 12 },
        ],
      },
      {
        name: "The Lakes Golf Club",
        location: "Mascot, NSW",
        rating: 73.2,
        slope: 134,
        lat: -33.93,
        lng: 151.22,
        holes: [
          { number: 1, par: 4, strokeIndex: 7 },
          { number: 2, par: 4, strokeIndex: 3 },
          { number: 3, par: 3, strokeIndex: 15 },
          { number: 4, par: 5, strokeIndex: 11 },
          { number: 5, par: 4, strokeIndex: 1 },
          { number: 6, par: 4, strokeIndex: 5 },
          { number: 7, par: 3, strokeIndex: 17 },
          { number: 8, par: 4, strokeIndex: 9 },
          { number: 9, par: 5, strokeIndex: 13 },
          { number: 10, par: 5, strokeIndex: 8 },
          { number: 11, par: 4, strokeIndex: 2 },
          { number: 12, par: 4, strokeIndex: 4 },
          { number: 13, par: 4, strokeIndex: 6 },
          { number: 14, par: 3, strokeIndex: 16 },
          { number: 15, par: 5, strokeIndex: 14 },
          { number: 16, par: 4, strokeIndex: 10 },
          { number: 17, par: 4, strokeIndex: 12 },
          { number: 18, par: 3, strokeIndex: 18 },
        ],
      },
      {
        name: "Joondalup Resort",
        location: "Connolly, WA",
        rating: 72.8,
        slope: 130,
        lat: -31.74,
        lng: 115.76,
        holes: [
          { number: 1, par: 4, strokeIndex: 5 },
          { number: 2, par: 4, strokeIndex: 9 },
          { number: 3, par: 3, strokeIndex: 17 },
          { number: 4, par: 5, strokeIndex: 1 },
          { number: 5, par: 4, strokeIndex: 11 },
          { number: 6, par: 4, strokeIndex: 3 },
          { number: 7, par: 3, strokeIndex: 15 },
          { number: 8, par: 4, strokeIndex: 7 },
          { number: 9, par: 4, strokeIndex: 13 },
          { number: 10, par: 4, strokeIndex: 6 },
          { number: 11, par: 3, strokeIndex: 14 },
          { number: 12, par: 5, strokeIndex: 2 },
          { number: 13, par: 4, strokeIndex: 8 },
          { number: 14, par: 4, strokeIndex: 4 },
          { number: 15, par: 3, strokeIndex: 16 },
          { number: 16, par: 4, strokeIndex: 10 },
          { number: 17, par: 5, strokeIndex: 18 },
          { number: 18, par: 4, strokeIndex: 12 },
        ],
      },
    ];

    type SeedCourse = { id: string; name: string; rating: number; slope: number; holes: Hole[] };
    const courses: SeedCourse[] = [];

    // Grab existing Wembley course
    const { rows: wembleyRows } = await pool.query(
      `SELECT id, name, rating, slope, holes_json FROM courses WHERE name = 'Wembley Golf Course' LIMIT 1`,
    );
    if (wembleyRows.length > 0) {
      const w = wembleyRows[0] as {
        id: string;
        name: string;
        rating: number;
        slope: number;
        holes_json: string;
      };
      courses.push({
        id: w.id,
        name: w.name,
        rating: Number(w.rating),
        slope: Number(w.slope),
        holes: JSON.parse(w.holes_json),
      });
    }

    for (const sc of seedCourses) {
      const { rows: existing } = await pool.query(`SELECT id FROM courses WHERE name = $1`, [
        sc.name,
      ]);
      if (existing.length > 0) {
        courses.push({
          id: existing[0].id,
          name: sc.name,
          rating: sc.rating,
          slope: sc.slope,
          holes: sc.holes,
        });
        continue;
      }
      const c = await createCourse(
        sc.name,
        sc.location,
        sc.rating,
        sc.slope,
        sc.holes,
        fakeUsers[0].id,
        sc.lat,
        sc.lng,
      );
      courses.push({
        id: c.id,
        name: sc.name,
        rating: sc.rating,
        slope: sc.slope,
        holes: sc.holes,
      });
      counts.courses++;
    }

    // === STEP 3: GROUPS + MEMBERS ===
    const groupDefs = [
      { name: "Saturday Hackers", ownerIdx: 0 },
      { name: "The Bogey Boys", ownerIdx: 1 },
      { name: "Dad Golf Crew", ownerIdx: 2 },
    ];
    const groups: Array<{ id: string; name: string }> = [];

    for (const gd of groupDefs) {
      const { rows: existing } = await pool.query(`SELECT id, name FROM groups WHERE name = $1`, [
        gd.name,
      ]);
      if (existing.length > 0) {
        groups.push({ id: existing[0].id, name: existing[0].name });
        continue;
      }
      const g = await createGroup(gd.name, fakeUsers[gd.ownerIdx].id);
      groups.push({ id: g.id, name: g.name });
      counts.groups++;
    }

    for (const g of groups) {
      for (const u of fakeUsers) {
        const { rows: existing } = await pool.query(
          `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
          [g.id, u.id],
        );
        if (existing.length > 0) continue;
        await addGroupMember(g.id, u.displayName, u.handicap, u.id, "member");
        counts.members++;
      }
    }
    for (const g of groups) {
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [g.id, admin.id],
      );
      if (existing.length === 0) {
        await addGroupMember(g.id, admin.displayName, admin.handicap, admin.id, "admin");
        counts.members++;
      }
    }

    // === STEP 4: GROUP INVITES ===
    for (const g of groups) {
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM group_invites WHERE group_id = $1 LIMIT 1`,
        [g.id],
      );
      if (existing.length === 0) {
        await createGroupInvite(g.id);
        counts.invites++;
      }
    }

    const allUsers: SeedUser[] = [
      ...fakeUsers,
      { id: admin.id, displayName: admin.displayName, username: "admin", handicap: admin.handicap },
    ];

    // === IDEMPOTENCY CHECK FOR ROUNDS ===
    const { rows: sentinelRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM rounds r
       JOIN players p ON p.round_id = r.id
       JOIN users u ON u.id = p.user_id
       WHERE u.username = 'dave_t' AND r.status = 'complete'`,
    );
    const alreadySeededRounds = Number(sentinelRows[0].cnt) > 0;

    // Track created rounds and their players for later use
    type SeededRound = {
      id: string;
      roomCode: string;
      courseIdx: number;
      groupIdx: number;
      daysAgo: number;
      playerUsers: SeedUser[];
      playerIds: string[];
    };
    const seededRounds: SeededRound[] = [];

    if (!alreadySeededRounds && courses.length >= 5) {
      // Round definitions: [courseIdx, groupIdx, daysAgo, playerUserIndexes]
      // playerUserIndexes: 0-7 = fakeUsers, 8 = admin
      const roundDefs: Array<[number, number, number, number[]]> = [
        [0, 0, 12, [0, 1, 3, 8]], // Wembley, Saturday Hackers
        [1, 1, 9, [2, 4, 5, 6]], // Royal Melbourne, The Bogey Boys
        [2, 2, 7, [0, 2, 7, 8]], // Barnbougle, Dad Golf Crew
        [3, 0, 4, [1, 3, 4, 6]], // The Lakes, Saturday Hackers
        [4, 1, 2, [5, 7, 0, 2]], // Joondalup, The Bogey Boys
      ];

      // === STEP 5: COMPLETED ROUNDS + SCORES ===
      for (const [cIdx, gIdx, ago, pIdxs] of roundDefs) {
        const course = courses[cIdx];
        const group = groups[gIdx];
        const players = pIdxs.map((i) => allUsers[i]);
        const roomCode = generateRoomCode();
        const round = await createRound(roomCode, course.id, group.id, players[0].id);

        const playerIds: string[] = [];
        for (const pu of players) {
          const p = await addPlayer(round.id, pu.displayName, pu.handicap, pu.id);
          playerIds.push(p.id);
        }

        // Generate full 18-hole scores
        for (let pi = 0; pi < players.length; pi++) {
          for (const hole of course.holes) {
            const strokes = generateScore(hole.par, players[pi].handicap);
            await upsertScore(round.id, playerIds[pi], hole.number, strokes);
            counts.scores++;
          }
        }

        await updateRoundStatus(round.id, "in_progress");
        await updateRoundStatus(round.id, "complete");

        // Backdate timestamps
        await pool.query(
          `UPDATE rounds SET created_at = $1, started_at = $2, completed_at = $3 WHERE id = $4`,
          [daysAgo(ago, 7), daysAgo(ago, 7), daysAgo(ago, 11), round.id],
        );

        seededRounds.push({
          id: round.id,
          roomCode,
          courseIdx: cIdx,
          groupIdx: gIdx,
          daysAgo: ago,
          playerUsers: players,
          playerIds,
        });
        counts.completedRounds++;
      }

      // === STEP 6: IN-PROGRESS ROUND ===
      {
        const course = courses[0]; // Wembley
        const group = groups[2]; // Dad Golf Crew
        const players = [fakeUsers[1], fakeUsers[3], fakeUsers[7]]; // Steve, Pete, Sam
        const roomCode = generateRoomCode();
        const round = await createRound(roomCode, course.id, group.id, players[0].id);
        const playerIds: string[] = [];
        for (const pu of players) {
          const p = await addPlayer(round.id, pu.displayName, pu.handicap, pu.id);
          playerIds.push(p.id);
        }
        // Scores for holes 1-6 only
        for (let pi = 0; pi < players.length; pi++) {
          for (const hole of course.holes.filter((h) => h.number <= 6)) {
            await upsertScore(
              round.id,
              playerIds[pi],
              hole.number,
              generateScore(hole.par, players[pi].handicap),
            );
            counts.scores++;
          }
        }
        await updateRoundStatus(round.id, "in_progress");
        await updateRoundCurrentHole(round.id, 7);
        counts.inProgressRounds++;
      }

      // === STEP 7: WAITING ROUND ===
      {
        const course = courses[1]; // Royal Melbourne
        const group = groups[0]; // Saturday Hackers
        const players = [fakeUsers[0], allUsers[8]]; // Dave, Admin
        const roomCode = generateRoomCode();
        const round = await createRound(roomCode, course.id, group.id, players[0].id);
        for (const pu of players) {
          await addPlayer(round.id, pu.displayName, pu.handicap, pu.id);
        }
        counts.waitingRounds++;
      }

      // === STEP 8: COMPETITIONS ===
      if (seededRounds.length >= 5) {
        const compDefs: Array<{
          roundIdx: number;
          hole: number;
          type: "ctp" | "longest_drive";
          claims: Array<[number, string]>; // [playerIndexInRound, claim]
          winnerIdx: number; // playerIndexInRound of winner
        }> = [
          {
            roundIdx: 0,
            hole: 3,
            type: "ctp",
            claims: [
              [0, "2.5m"],
              [1, "4m"],
              [2, "6m"],
            ],
            winnerIdx: 0,
          },
          {
            roundIdx: 0,
            hole: 4,
            type: "longest_drive",
            claims: [
              [0, "245m"],
              [2, "260m"],
            ],
            winnerIdx: 1,
          },
          {
            roundIdx: 1,
            hole: 3,
            type: "ctp",
            claims: [
              [0, "1.8m"],
              [2, "3m"],
            ],
            winnerIdx: 0,
          },
          {
            roundIdx: 2,
            hole: 8,
            type: "ctp",
            claims: [
              [0, "5m"],
              [1, "2m"],
              [2, "8m"],
            ],
            winnerIdx: 1,
          },
          {
            roundIdx: 3,
            hole: 5,
            type: "longest_drive",
            claims: [
              [0, "270m"],
              [1, "255m"],
            ],
            winnerIdx: 0,
          },
          {
            roundIdx: 4,
            hole: 7,
            type: "ctp",
            claims: [
              [1, "3.5m"],
              [2, "1m"],
            ],
            winnerIdx: 1,
          },
        ];

        for (const cd of compDefs) {
          const sr = seededRounds[cd.roundIdx];
          const comp = await createCompetition(sr.id, cd.hole, cd.type);
          for (const [pIdx, claim] of cd.claims) {
            await upsertClaim(comp.id, sr.playerIds[pIdx], claim);
          }
          const winnerPlayerIdx = cd.claims[cd.winnerIdx][0];
          await setClaimWinner(comp.id, sr.playerIds[winnerPlayerIdx]);
          counts.competitions++;
        }
      }

      // === STEP 9: SCHEDULED ROUNDS + RSVPs ===
      const scheduledDefs: Array<{
        groupIdx: number;
        courseIdx: number;
        daysFromNow: number;
        time: string;
        duration: number;
        notes: string | null;
        cancel: boolean;
        rsvps: Array<[number, "accepted" | "declined" | "tentative"]>; // [userIdx, status]
      }> = [
        {
          groupIdx: 0,
          courseIdx: 0,
          daysFromNow: 3,
          time: "7:30",
          duration: 240,
          notes: "Regular Saturday hit",
          cancel: false,
          rsvps: [
            [0, "accepted"],
            [1, "accepted"],
            [3, "accepted"],
            [4, "tentative"],
          ],
        },
        {
          groupIdx: 1,
          courseIdx: 1,
          daysFromNow: 7,
          time: "8:00",
          duration: 270,
          notes: "Big day out at Royal Melbourne!",
          cancel: false,
          rsvps: [
            [2, "accepted"],
            [5, "accepted"],
            [6, "declined"],
            [7, "tentative"],
          ],
        },
        {
          groupIdx: 2,
          courseIdx: 2,
          daysFromNow: 14,
          time: "6:30",
          duration: 300,
          notes: "Weekend trip to Tassie",
          cancel: false,
          rsvps: [
            [0, "accepted"],
            [2, "accepted"],
            [7, "accepted"],
          ],
        },
        {
          groupIdx: 0,
          courseIdx: 4,
          daysFromNow: 21,
          time: "9:00",
          duration: 240,
          notes: null,
          cancel: false,
          rsvps: [
            [1, "accepted"],
            [4, "accepted"],
          ],
        },
        {
          groupIdx: 1,
          courseIdx: 3,
          daysFromNow: -3,
          time: "7:00",
          duration: 240,
          notes: "Rained out",
          cancel: true,
          rsvps: [
            [2, "declined"],
            [5, "accepted"],
            [6, "accepted"],
          ],
        },
      ];

      for (const sd of scheduledDefs) {
        const date = daysFromNow(sd.daysFromNow);
        const creatorIdx = [0, 1, 2][sd.groupIdx]; // group owner
        const sr = await createScheduledRound(
          groups[sd.groupIdx].id,
          courses[sd.courseIdx].id,
          date,
          sd.time,
          sd.duration,
          sd.notes,
          fakeUsers[creatorIdx].id,
        );
        if (sd.cancel) {
          await updateScheduledRoundStatus(sr.id, "cancelled");
        }
        for (const [uIdx, status] of sd.rsvps) {
          await upsertRsvp(sr.id, fakeUsers[uIdx].id, status);
          counts.rsvps++;
        }
        counts.scheduledRounds++;
      }

      // === STEP 10: HANDICAP HISTORY ===
      for (const sr of seededRounds) {
        const course = courses[sr.courseIdx];
        const date = daysAgo(sr.daysAgo).split("T")[0];
        for (let pi = 0; pi < sr.playerUsers.length; pi++) {
          const { rows: scoreRows } = await pool.query(
            `SELECT SUM(strokes) AS total FROM scores WHERE round_id = $1 AND player_id = $2`,
            [sr.id, sr.playerIds[pi]],
          );
          const adjustedGross = Number(scoreRows[0].total);
          if (!adjustedGross) continue;
          const diff = calculateScoreDifferential(adjustedGross, course.rating, course.slope);
          await createHandicapRound(
            sr.playerUsers[pi].id,
            date,
            course.name,
            adjustedGross,
            course.rating,
            course.slope,
            diff,
            sr.id,
            "auto",
          );
          counts.handicapEntries++;
        }
      }
    } // end if (!alreadySeededRounds)

    // === STEP 11: COURSE REVIEWS ===
    const reviewDefs: Array<[number, number, number, string | null]> = [
      // [courseIdx, userIdx, rating, text]
      [0, 0, 4, "Great local course, well maintained"],
      [0, 1, 3, "A bit short but fun layout"],
      [0, 3, 5, "My home course, love it"],
      [1, 2, 5, "Incredible experience, bucket list course"],
      [1, 4, 4, "World class but punishing rough"],
      [1, 6, 5, null],
      [2, 0, 5, "Best links golf in Australia"],
      [2, 7, 4, "Windy but stunning"],
      [3, 5, 3, "Tricky layout, planes are distracting"],
      [3, 2, 4, "Good test of golf near the airport"],
      [4, 1, 4, "Beautiful resort course"],
      [4, 3, 3, "A bit pricey but decent"],
    ];
    for (const [cIdx, uIdx, rating, text] of reviewDefs) {
      if (courses[cIdx]) {
        await upsertCourseReview(courses[cIdx].id, fakeUsers[uIdx].id, rating, text);
        counts.reviews++;
      }
    }

    // === STEP 12: COURSE REPORTS ===
    if (courses.length >= 5) {
      await createCourseReport(courses[4].id, fakeUsers[6].id, "incorrect_info");
      await createCourseReport(courses[4].id, fakeUsers[7].id, "incorrect_info");
      await createCourseReport(courses[3].id, fakeUsers[4].id, "duplicate");
      counts.reports += 3;
    }

    // === STEP 13: COURSE FAVORITES ===
    const favDefs: Array<[number, number[]]> = [
      [0, [0, 1, 3]], // Wembley
      [1, [2, 0, 4, 6, 5]], // Royal Melbourne
      [2, [0, 7, 2]], // Barnbougle
      [3, [5, 2]], // The Lakes
      [4, [1, 3]], // Joondalup
    ];
    for (const [cIdx, uIdxs] of favDefs) {
      if (!courses[cIdx]) continue;
      for (const uIdx of uIdxs) {
        await favoriteCourse(fakeUsers[uIdx].id, courses[cIdx].id);
        counts.favorites++;
      }
    }

    // === STEP 14: ACTIVITY EVENTS ===
    const eventIds: string[] = [];

    // Fetch completed rounds for event references (covers both fresh seed and re-run)
    const { rows: completedRoundRows } = await pool.query(
      `SELECT r.id, r.room_code, c.name AS course_name, r.group_id, r.completed_at
       FROM rounds r JOIN courses c ON c.id = r.course_id
       WHERE r.status = 'complete' ORDER BY r.completed_at DESC LIMIT 10`,
    );
    const completedRounds = completedRoundRows as Array<{
      id: string;
      room_code: string;
      course_name: string;
      group_id: string;
      completed_at: string;
    }>;

    // round_completed events
    for (const cr of completedRounds.slice(0, 5)) {
      const eid = await createActivityEvent(
        "round_completed",
        fakeUsers[0].id,
        cr.group_id,
        cr.id,
        "public",
        {
          courseName: cr.course_name,
          roomCode: cr.room_code,
          playerCount: 4,
          winnerName: fakeUsers[0].displayName,
          winnerPoints: 32 + Math.floor(Math.random() * 8),
        },
      );
      await pool.query(`UPDATE activity_events SET created_at = $1 WHERE id = $2`, [
        cr.completed_at,
        eid,
      ]);
      eventIds.push(eid);
      counts.events++;
    }

    // round_started events
    for (const cr of completedRounds.slice(0, 2)) {
      const eid = await createActivityEvent(
        "round_started",
        fakeUsers[1].id,
        cr.group_id,
        cr.id,
        "public",
        {
          courseName: cr.course_name,
          roomCode: cr.room_code,
          playerCount: 4,
        },
      );
      await pool.query(`UPDATE activity_events SET created_at = $1 WHERE id = $2`, [
        cr.completed_at,
        eid,
      ]);
      eventIds.push(eid);
      counts.events++;
    }

    // scheduled_round_created events
    for (let i = 0; i < Math.min(3, groups.length); i++) {
      const eid = await createActivityEvent(
        "scheduled_round_created",
        fakeUsers[i].id,
        groups[i].id,
        null,
        "public",
        {
          courseName: courses[i]?.name ?? "Unknown",
          scheduledDate: daysFromNow(7 + i * 7),
          scheduledTime: "8:00",
        },
      );
      await pool.query(`UPDATE activity_events SET created_at = $1 WHERE id = $2`, [
        daysAgo(3 + i),
        eid,
      ]);
      eventIds.push(eid);
      counts.events++;
    }

    // member_joined events
    for (let i = 5; i < 8; i++) {
      const g = pick(groups);
      const eid = await createActivityEvent("member_joined", fakeUsers[i].id, g.id, null, "public", {
        groupName: g.name,
      });
      await pool.query(`UPDATE activity_events SET created_at = $1 WHERE id = $2`, [
        daysAgo(13 - i),
        eid,
      ]);
      eventIds.push(eid);
      counts.events++;
    }

    // handicap_change events
    for (let i = 0; i < 3; i++) {
      const u = fakeUsers[i];
      const eid = await createActivityEvent(
        "handicap_change",
        u.id,
        groups[i % groups.length].id,
        null,
        "public",
        {
          oldHandicap: u.handicap,
          newHandicap: Math.round((u.handicap - 0.3 - Math.random() * 0.5) * 10) / 10,
        },
      );
      await pool.query(`UPDATE activity_events SET created_at = $1 WHERE id = $2`, [
        daysAgo(i + 1),
        eid,
      ]);
      eventIds.push(eid);
      counts.events++;
    }

    // competition_won events
    if (completedRounds.length > 0) {
      const compTypes: Array<"ctp" | "longest_drive"> = [
        "ctp",
        "longest_drive",
        "ctp",
        "ctp",
        "longest_drive",
      ];
      for (let i = 0; i < Math.min(5, completedRounds.length); i++) {
        const cr = completedRounds[i];
        const eid = await createActivityEvent(
          "competition_won",
          fakeUsers[i % fakeUsers.length].id,
          cr.group_id,
          cr.id,
          "public",
          {
            competitionType: compTypes[i],
            roomCode: cr.room_code,
            holeNumber: 3 + i * 3,
          },
        );
        await pool.query(`UPDATE activity_events SET created_at = $1 WHERE id = $2`, [
          cr.completed_at,
          eid,
        ]);
        eventIds.push(eid);
        counts.events++;
      }
    }

    // === STEP 15: ACTIVITY LIKES + COMMENTS ===
    for (const eid of eventIds.slice(0, 8)) {
      const likerCount = 2 + Math.floor(Math.random() * 4);
      const likers = [...fakeUsers].sort(() => Math.random() - 0.5).slice(0, likerCount);
      for (const liker of likers) {
        await likeActivityEvent(eid, liker.id);
        counts.likes++;
      }
    }

    const commentDefs: Array<[number, number, string]> = [
      // [eventIdx, userIdx, text]
      [0, 1, "Great round mate!"],
      [0, 3, "That back nine was brutal"],
      [1, 0, "What a day out there"],
      [2, 2, "Barnbougle is unreal"],
      [2, 7, "When are we going back?"],
      [eventIds.length > 10 ? 10 : 0, 6, "Robbery! I was closer"],
      [eventIds.length > 11 ? 11 : 1, 2, "Proof or it didn't happen"],
      [eventIds.length > 7 ? 7 : 0, 4, "Good luck out there lads"],
    ];
    for (const [eIdx, uIdx, text] of commentDefs) {
      if (eventIds[eIdx]) {
        await addActivityComment(eventIds[eIdx], fakeUsers[uIdx].id, text);
        counts.comments++;
      }
    }

    // === STEP 16: BADGES ===
    // Award badges strategically based on seed data
    const badgeAssignments: Array<[number | "admin", string[]]> = [
      [
        0,
        [
          "first_timer",
          "regular",
          "team_player",
          "explorer",
          "birdie_watch",
          "champion",
          "sharpshooter",
        ],
      ],
      [1, ["first_timer", "team_player", "birdie_watch"]],
      [2, ["first_timer", "team_player", "explorer", "big_hitter"]],
      [3, ["first_timer", "team_player"]],
      [4, ["first_timer", "team_player"]],
      [5, ["first_timer", "team_player", "social_butterfly"]],
      [6, ["first_timer", "team_player"]],
      [7, ["first_timer", "team_player"]],
      ["admin", ["first_timer", "team_player", "explorer"]],
    ];

    for (const [userRef, badgeList] of badgeAssignments) {
      const u = userRef === "admin" ? allUsers[allUsers.length - 1] : fakeUsers[userRef];
      for (const badgeId of badgeList) {
        const isNew = await awardBadge(u.id, badgeId);
        if (isNew) {
          counts.badges++;
          const hoursAgo = Math.floor(Math.random() * 336);
          const ts = new Date(Date.now() - hoursAgo * 3600000).toISOString();
          await pool.query(
            `INSERT INTO activity_events (id, type, group_id, user_id, round_id, visibility, data_json, created_at)
             VALUES (gen_random_uuid(), 'badge_earned', $1, $2, NULL, 'public', $3, $4)`,
            [pick(groups).id, u.id, JSON.stringify({ badgeId }), ts],
          );
        }
      }
    }

    return {
      ok: true,
      counts,
      summary: [
        `${counts.users} users`,
        `${counts.courses} courses`,
        `${counts.groups} groups`,
        `${counts.completedRounds} completed rounds`,
        `${counts.inProgressRounds} in-progress rounds`,
        `${counts.waitingRounds} waiting rounds`,
        `${counts.scores} scores`,
        `${counts.competitions} competitions`,
        `${counts.scheduledRounds} scheduled rounds`,
        `${counts.rsvps} RSVPs`,
        `${counts.handicapEntries} handicap entries`,
        `${counts.reviews} reviews`,
        `${counts.reports} reports`,
        `${counts.favorites} favorites`,
        `${counts.events} activity events`,
        `${counts.likes} likes`,
        `${counts.comments} comments`,
        `${counts.badges} badges`,
      ].join(", "),
    };
  });
}
