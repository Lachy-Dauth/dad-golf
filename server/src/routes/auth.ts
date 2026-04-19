import type { FastifyInstance } from "fastify";
import type { ActivityVisibility, Gender } from "@dad-golf/shared";
import {
  authenticateUser,
  createSession,
  createUser,
  deleteSession,
  getUserByUsername,
  updateUserProfile,
  updateActivityVisibility,
  updateUserGender,
} from "../db/index.js";
import {
  errorMessage,
  getViewerUser,
  requireUser,
  validateHandicap,
  validateName,
  validatePassword,
  validateUsername,
} from "./validation.js";

const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      username?: string;
      password?: string;
      displayName?: string;
      handicap?: number;
      gender?: string;
    };
  }>("/api/auth/register", authRateLimit, async (req, reply) => {
    try {
      const username = validateUsername(req.body?.username);
      const password = validatePassword(req.body?.password);
      const displayName = validateName(req.body?.displayName ?? username, "display name");
      const handicap = validateHandicap(req.body?.handicap ?? 18);
      const gender: Gender = req.body?.gender === "F" ? "F" : "M";
      if (await getUserByUsername(username)) {
        return reply.code(400).send({ error: "username already taken" });
      }
      const user = await createUser(username, password, displayName, handicap, gender);
      const token = await createSession(user.id);
      return reply.code(201).send({ user, token });
    } catch (e) {
      return reply.code(400).send({ error: errorMessage(e) });
    }
  });

  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/auth/login",
    authRateLimit,
    async (req, reply) => {
      try {
        const username = validateUsername(req.body?.username);
        const password = validatePassword(req.body?.password);
        const user = await authenticateUser(username, password);
        if (!user) {
          return reply.code(401).send({ error: "invalid credentials" });
        }
        const token = await createSession(user.id);
        return { user, token };
      } catch (e) {
        return reply.code(400).send({ error: errorMessage(e) });
      }
    },
  );

  app.post("/api/auth/logout", async (req, _reply) => {
    const auth = req.headers.authorization;
    const match = auth ? /^Bearer\s+(.+)$/i.exec(auth) : null;
    if (match) await deleteSession(match[1]);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = await getViewerUser(req);
    if (!user) return reply.code(401).send({ error: "not signed in" });
    return { user };
  });

  app.patch<{
    Body: {
      displayName?: string;
      handicap?: number;
      activityVisibility?: string;
      gender?: string;
    };
  }>("/api/auth/me", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const displayName = validateName(req.body?.displayName, "display name");
      const handicap = validateHandicap(req.body?.handicap);
      await updateUserProfile(user.id, displayName, handicap);
      let activityVisibility = user.activityVisibility;
      if (
        req.body?.activityVisibility &&
        ["none", "public"].includes(req.body.activityVisibility)
      ) {
        activityVisibility = req.body.activityVisibility as ActivityVisibility;
        await updateActivityVisibility(user.id, activityVisibility);
      }
      let gender = user.gender;
      if (req.body?.gender === "M" || req.body?.gender === "F") {
        gender = req.body.gender;
        await updateUserGender(user.id, gender);
      }
      return { user: { ...user, displayName, handicap, activityVisibility, gender } };
    } catch (e) {
      return reply.code(400).send({ error: errorMessage(e) });
    }
  });
}
