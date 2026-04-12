import type { FastifyReply, FastifyRequest } from "fastify";
import type { Hole, User } from "@dad-golf/shared";
import { getUserBySession } from "../db/index.js";

export const MAX_PLAYERS_PER_ROUND = 32;
export const MAX_MEMBERS_PER_GROUP = 64;

export function validateHoles(holes: unknown): Hole[] {
  if (!Array.isArray(holes)) throw new Error("holes must be an array");
  if (holes.length !== 9 && holes.length !== 18) {
    throw new Error("holes must contain 9 or 18 entries");
  }
  const parsed: Hole[] = holes.map((h: unknown, i: number) => {
    const obj = h as Record<string, unknown>;
    const number = Number(obj.number ?? i + 1);
    const par = Number(obj.par);
    const strokeIndex = Number(obj.strokeIndex ?? obj.stroke_index);
    if (!Number.isInteger(number) || number < 1 || number > 18)
      throw new Error(`invalid hole number at index ${i}`);
    if (!Number.isInteger(par) || par < 3 || par > 6)
      throw new Error(`invalid par at hole ${number}`);
    if (!Number.isInteger(strokeIndex) || strokeIndex < 1 || strokeIndex > holes.length)
      throw new Error(`invalid stroke index at hole ${number}`);
    return { number, par, strokeIndex };
  });
  const siSet = new Set(parsed.map((h) => h.strokeIndex));
  if (siSet.size !== parsed.length) {
    throw new Error("stroke indexes must be unique");
  }
  const numSet = new Set(parsed.map((h) => h.number));
  if (numSet.size !== parsed.length) {
    throw new Error("hole numbers must be unique");
  }
  return parsed.sort((a, b) => a.number - b.number);
}

export function validateHandicap(h: unknown): number {
  const n = Number(h);
  if (!Number.isFinite(n) || n < 0 || n > 54) {
    throw new Error("handicap must be a number between 0.0 and 54.0");
  }
  // Golf Australia handicaps are quoted to one decimal place. Round to 0.1
  // so storage stays consistent regardless of how the client formats it.
  return Math.round(n * 10) / 10;
}

export function validateCourseRating(r: unknown): number {
  const n = Number(r);
  if (!Number.isFinite(n) || n < 50 || n > 90) {
    throw new Error("course rating must be a number between 50.0 and 90.0");
  }
  return Math.round(n * 10) / 10;
}

export function validateCourseSlope(s: unknown): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 55 || n > 155) {
    throw new Error("slope rating must be an integer between 55 and 155");
  }
  return n;
}

export function validateName(name: unknown, field = "name"): string {
  if (typeof name !== "string") throw new Error(`${field} must be a string`);
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40)
    throw new Error(`${field} must be 1-40 characters`);
  return trimmed;
}

export function validateUsername(name: unknown): string {
  if (typeof name !== "string") throw new Error("username must be a string");
  const trimmed = name.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(trimmed)) {
    throw new Error("username must be 3-24 chars, letters/numbers/_/-/. only");
  }
  return trimmed;
}

export function validatePassword(p: unknown): string {
  if (typeof p !== "string") throw new Error("password must be a string");
  if (p.length < 6 || p.length > 128) {
    throw new Error("password must be 6-128 characters");
  }
  return p;
}

export async function getViewerUser(req: FastifyRequest): Promise<User | null> {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return null;
  return await getUserBySession(match[1]);
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<User | null> {
  const user = await getViewerUser(req);
  if (!user) {
    reply.code(401).send({ error: "sign in required" });
    return null;
  }
  return user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<User | null> {
  const user = await requireUser(req, reply);
  if (!user) return null;
  if (!user.isAdmin) {
    reply.code(403).send({ error: "admin access required" });
    return null;
  }
  return user;
}
