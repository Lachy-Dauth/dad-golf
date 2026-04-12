import type { Hole } from "@dad-golf/shared";
import {
  createCourse,
  createUser,
  ensureAdminUser,
  getUserByUsername,
  listCourses,
} from "./db/index.js";

interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
}

const SEED_COURSES: Array<{
  name: string;
  location: string;
  rating: number;
  slope: number;
  latitude: number;
  longitude: number;
  holes: Hole[];
}> = [
  {
    name: "Wembley Golf Course",
    location: "200 The Blvd, Wembley Downs WA 6019",
    rating: 67.7,
    slope: 114,
    latitude: -31.94,
    longitude: 115.78,
    holes: [
      { number: 1, par: 4, strokeIndex: 4 },
      { number: 2, par: 4, strokeIndex: 5 },
      { number: 3, par: 3, strokeIndex: 18 },
      { number: 4, par: 5, strokeIndex: 1 },
      { number: 5, par: 4, strokeIndex: 7 },
      { number: 6, par: 3, strokeIndex: 16 },
      { number: 7, par: 4, strokeIndex: 12 },
      { number: 8, par: 4, strokeIndex: 10 },
      { number: 9, par: 4, strokeIndex: 11 },
      { number: 10, par: 4, strokeIndex: 14 },
      { number: 11, par: 4, strokeIndex: 2 },
      { number: 12, par: 3, strokeIndex: 13 },
      { number: 13, par: 4, strokeIndex: 6 },
      { number: 14, par: 4, strokeIndex: 3 },
      { number: 15, par: 5, strokeIndex: 15 },
      { number: 16, par: 4, strokeIndex: 9 },
      { number: 17, par: 4, strokeIndex: 8 },
      { number: 18, par: 3, strokeIndex: 17 },
    ],
  },
];

const SEED_USERNAME = "stableford";

export async function seedIfEmpty(log: Logger): Promise<void> {
  const existing = await listCourses(null);
  if (existing.length > 0) return;

  let seedUser = await getUserByUsername(SEED_USERNAME);
  if (!seedUser) {
    await createUser(SEED_USERNAME, "stableford", "Stableford", 18);
    seedUser = await getUserByUsername(SEED_USERNAME);
  }
  if (!seedUser) return;

  for (const c of SEED_COURSES) {
    await createCourse(c.name, c.location, c.rating, c.slope, c.holes, seedUser.id, c.latitude, c.longitude);
  }
  log.info(`Seeded ${SEED_COURSES.length} courses`);
}

export async function bootstrapAdmin(log: Logger): Promise<void> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    log.info("ADMIN_PASSWORD not set – skipping admin user bootstrap");
    return;
  }
  if (password.length < 6) {
    log.warn("ADMIN_PASSWORD is shorter than 6 characters – skipping");
    return;
  }
  await ensureAdminUser(password);
  log.info("Admin user 'admin' bootstrapped");
}
