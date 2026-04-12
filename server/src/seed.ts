import type { Hole } from "@dad-golf/shared";
import {
  createCourse,
  createUser,
  getUserByUsername,
  listCourses,
} from "./db.js";

const SEED_COURSES: Array<{
  name: string;
  location: string;
  rating: number;
  slope: number;
  holes: Hole[];
}> = [
  {
    name: "Pebble Creek Municipal",
    location: "Anywhere, USA",
    rating: 71.4,
    slope: 124,
    holes: [
      { number: 1, par: 4, strokeIndex: 7 },
      { number: 2, par: 5, strokeIndex: 11 },
      { number: 3, par: 3, strokeIndex: 17 },
      { number: 4, par: 4, strokeIndex: 3 },
      { number: 5, par: 4, strokeIndex: 13 },
      { number: 6, par: 5, strokeIndex: 1 },
      { number: 7, par: 3, strokeIndex: 15 },
      { number: 8, par: 4, strokeIndex: 5 },
      { number: 9, par: 4, strokeIndex: 9 },
      { number: 10, par: 4, strokeIndex: 8 },
      { number: 11, par: 5, strokeIndex: 12 },
      { number: 12, par: 3, strokeIndex: 18 },
      { number: 13, par: 4, strokeIndex: 2 },
      { number: 14, par: 4, strokeIndex: 10 },
      { number: 15, par: 3, strokeIndex: 16 },
      { number: 16, par: 5, strokeIndex: 4 },
      { number: 17, par: 4, strokeIndex: 6 },
      { number: 18, par: 4, strokeIndex: 14 },
    ],
  },
  {
    name: "Oakridge Links",
    location: "Greenfield",
    rating: 72.8,
    slope: 130,
    holes: [
      { number: 1, par: 4, strokeIndex: 5 },
      { number: 2, par: 4, strokeIndex: 11 },
      { number: 3, par: 3, strokeIndex: 15 },
      { number: 4, par: 5, strokeIndex: 1 },
      { number: 5, par: 4, strokeIndex: 9 },
      { number: 6, par: 3, strokeIndex: 17 },
      { number: 7, par: 4, strokeIndex: 3 },
      { number: 8, par: 5, strokeIndex: 7 },
      { number: 9, par: 4, strokeIndex: 13 },
      { number: 10, par: 4, strokeIndex: 6 },
      { number: 11, par: 3, strokeIndex: 18 },
      { number: 12, par: 5, strokeIndex: 2 },
      { number: 13, par: 4, strokeIndex: 10 },
      { number: 14, par: 4, strokeIndex: 14 },
      { number: 15, par: 3, strokeIndex: 16 },
      { number: 16, par: 4, strokeIndex: 4 },
      { number: 17, par: 5, strokeIndex: 8 },
      { number: 18, par: 4, strokeIndex: 12 },
    ],
  },
];

const SEED_USERNAME = "stableford";

export async function seedIfEmpty(): Promise<void> {
  const existing = await listCourses(null);
  if (existing.length > 0) return;

  let seedUser = await getUserByUsername(SEED_USERNAME);
  if (!seedUser) {
    await createUser(SEED_USERNAME, "stableford", "Stableford", 18);
    seedUser = await getUserByUsername(SEED_USERNAME);
  }
  if (!seedUser) return;

  for (const c of SEED_COURSES) {
    await createCourse(c.name, c.location, c.rating, c.slope, c.holes, seedUser.id);
  }
  console.log(`Seeded ${SEED_COURSES.length} courses`);
}
