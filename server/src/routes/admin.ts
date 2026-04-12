import type { FastifyInstance } from "fastify";
import type { ActivityEventType } from "@dad-golf/shared";
import { BADGE_DEFINITIONS } from "@dad-golf/shared";
import {
  createGroup,
  createUser,
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

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    // --- Create fake users ---
    const fakeUsers: Array<{ id: string; displayName: string; username: string }> = [];
    const fakeNames = [
      { display: "Dave Thompson", user: "dave_t" },
      { display: "Steve Mitchell", user: "steve_m" },
      { display: "Matt O'Brien", user: "matt_ob" },
      { display: "Pete Collins", user: "pete_c" },
      { display: "Tom Harris", user: "tom_h" },
      { display: "Chris Walker", user: "chris_w" },
      { display: "Nick Palmer", user: "nick_p" },
      { display: "Sam Roberts", user: "sam_r" },
    ];

    for (const fn of fakeNames) {
      // Skip if username already exists
      const { rows: existing } = await pool.query(
        `SELECT id FROM users WHERE username = $1`,
        [fn.user],
      );
      if (existing.length > 0) {
        fakeUsers.push({ id: existing[0].id, displayName: fn.display, username: fn.user });
        continue;
      }
      const handicap = 10 + Math.floor(Math.random() * 20);
      const u = await createUser(fn.user, "demo1234", fn.display, handicap);
      fakeUsers.push({ id: u.id, displayName: fn.display, username: fn.user });
    }

    // --- Create fake groups ---
    const fakeGroupNames = ["Saturday Hackers", "The Bogey Boys", "Dad Golf Crew"];
    const groups: Array<{ id: string; name: string }> = [];

    for (const gName of fakeGroupNames) {
      const { rows: existing } = await pool.query(
        `SELECT id, name FROM groups WHERE name = $1`,
        [gName],
      );
      if (existing.length > 0) {
        groups.push({ id: existing[0].id, name: existing[0].name });
        continue;
      }
      const owner = pick(fakeUsers);
      const g = await createGroup(gName, owner.id);
      groups.push({ id: g.id, name: g.name });
    }

    // --- Add fake users to groups as members ---
    let membersAdded = 0;
    for (const g of groups) {
      for (const u of fakeUsers) {
        const { rows: existing } = await pool.query(
          `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
          [g.id, u.id],
        );
        if (existing.length > 0) continue;
        const handicap = 10 + Math.floor(Math.random() * 20);
        await addGroupMember(g.id, u.displayName, handicap, u.id, "member");
        membersAdded++;
      }
    }

    // Also add the admin to all groups
    for (const g of groups) {
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [g.id, admin.id],
      );
      if (existing.length === 0) {
        await addGroupMember(g.id, admin.displayName, admin.handicap, admin.id, "admin");
        membersAdded++;
      }
    }

    // Combine fake users + admin for event generation
    const allUsers = [
      ...fakeUsers.map((u) => ({ id: u.id, displayName: u.displayName, visibility: "group" })),
      { id: admin.id, displayName: admin.displayName, visibility: admin.activityVisibility },
    ];

    // Gather courses and rounds for realistic event data
    const { rows: courseRows } = await pool.query(`SELECT id, name FROM courses LIMIT 10`);
    const { rows: roundRows } = await pool.query(
      `SELECT id, room_code FROM rounds WHERE status = 'complete' LIMIT 10`,
    );
    const courses = courseRows as Array<{ id: string; name: string }>;
    const rounds = roundRows as Array<{ id: string; room_code: string }>;
    const courseNames =
      courses.length > 0
        ? courses.map((c) => c.name)
        : ["Royal Melbourne", "Barnbougle Dunes", "Kingston Heath", "The Lakes", "Bonville GC"];

    let eventsCreated = 0;

    // --- Generate activity events spread over the past 14 days ---
    const eventTemplates: Array<{
      type: ActivityEventType;
      make: () => { groupId: string; roundId: string | null; data: Record<string, unknown> };
    }> = [
      {
        type: "round_completed",
        make: () => {
          const r = rounds.length > 0 ? pick(rounds) : null;
          return {
            groupId: pick(groups).id,
            roundId: r?.id ?? null,
            data: {
              courseName: pick(courseNames),
              roomCode: r?.room_code ?? "DEMO",
              playerCount: 2 + Math.floor(Math.random() * 4),
              winnerName: pick(allUsers).displayName,
              winnerPoints: 28 + Math.floor(Math.random() * 14),
            },
          };
        },
      },
      {
        type: "round_started",
        make: () => ({
          groupId: pick(groups).id,
          roundId: rounds.length > 0 ? pick(rounds).id : null,
          data: {
            courseName: pick(courseNames),
            roomCode: rounds.length > 0 ? pick(rounds).room_code : "DEMO",
            playerCount: 2 + Math.floor(Math.random() * 4),
          },
        }),
      },
      {
        type: "scheduled_round_created",
        make: () => {
          const futureDay = Math.floor(Math.random() * 14) + 1;
          const d = new Date();
          d.setDate(d.getDate() + futureDay);
          return {
            groupId: pick(groups).id,
            roundId: null,
            data: {
              courseName: pick(courseNames),
              scheduledDate: d.toISOString().split("T")[0],
              scheduledTime: `${7 + Math.floor(Math.random() * 5)}:${Math.random() > 0.5 ? "00" : "30"}`,
            },
          };
        },
      },
      {
        type: "member_joined",
        make: () => {
          const g = pick(groups);
          return { groupId: g.id, roundId: null, data: { groupName: g.name } };
        },
      },
      {
        type: "handicap_change",
        make: () => {
          const old = 10 + Math.random() * 20;
          const delta = (Math.random() - 0.5) * 2;
          return {
            groupId: pick(groups).id,
            roundId: null,
            data: {
              oldHandicap: Math.round(old * 10) / 10,
              newHandicap: Math.round((old + delta) * 10) / 10,
            },
          };
        },
      },
      {
        type: "competition_won",
        make: () => ({
          groupId: pick(groups).id,
          roundId: rounds.length > 0 ? pick(rounds).id : null,
          data: {
            competitionType: Math.random() > 0.5 ? "ctp" : "longest_drive",
            roomCode: rounds.length > 0 ? pick(rounds).room_code : "DEMO",
            holeNumber: 1 + Math.floor(Math.random() * 18),
          },
        }),
      },
    ];

    // Create 20-30 events spread across the past 2 weeks
    const eventCount = 20 + Math.floor(Math.random() * 11);
    for (let i = 0; i < eventCount; i++) {
      const template = pick(eventTemplates);
      const u = pick(allUsers);
      const { groupId, roundId, data } = template.make();
      const hoursAgo = Math.floor(Math.random() * 336); // up to 14 days
      const ts = new Date(Date.now() - hoursAgo * 3600000).toISOString();

      await pool.query(
        `INSERT INTO activity_events (id, type, group_id, user_id, round_id, visibility, data_json, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [template.type, groupId, u.id, roundId, u.visibility || "group", JSON.stringify(data), ts],
      );
      eventsCreated++;
    }

    // --- Award random badges to all users ---
    let badgesAwarded = 0;
    const badgeIds = BADGE_DEFINITIONS.map((b) => b.id);
    for (const u of allUsers) {
      const count = 1 + Math.floor(Math.random() * 4);
      const shuffled = [...badgeIds].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        const isNew = await awardBadge(u.id, shuffled[i]);
        if (isNew) {
          badgesAwarded++;
          const hoursAgo = Math.floor(Math.random() * 336);
          const ts = new Date(Date.now() - hoursAgo * 3600000).toISOString();
          // Insert badge_earned event directly with backdated timestamp
          await pool.query(
            `INSERT INTO activity_events (id, type, group_id, user_id, round_id, visibility, data_json, created_at)
             VALUES (gen_random_uuid(), 'badge_earned', $1, $2, NULL, $3, $4, $5)`,
            [pick(groups).id, u.id, u.visibility || "group", JSON.stringify({ badgeId: shuffled[i] }), ts],
          );
        }
      }
    }

    return {
      ok: true,
      usersCreated: fakeUsers.length,
      groupsCreated: groups.length,
      membersAdded,
      eventsCreated,
      badgesAwarded,
      summary: `Created ${fakeUsers.length} users, ${groups.length} groups, ${eventsCreated} activity events, and awarded ${badgesAwarded} badges`,
    };
  });
}
