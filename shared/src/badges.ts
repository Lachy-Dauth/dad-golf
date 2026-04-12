import type { BadgeDefinition } from "./types.js";

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Milestones
  {
    id: "first_timer",
    name: "First Timer",
    description: "Complete your first round",
    icon: "\u{1F3CC}\uFE0F",
    category: "milestones",
  },
  {
    id: "regular",
    name: "Regular",
    description: "Complete 10 rounds",
    icon: "\u{1F51F}",
    category: "milestones",
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "Complete 50 rounds",
    icon: "\u{1F3C5}",
    category: "milestones",
  },

  // Scoring
  {
    id: "birdie_watch",
    name: "Birdie Watch",
    description: "Score a birdie (1 under par)",
    icon: "\u{1F426}",
    category: "scoring",
  },
  {
    id: "eagle_eye",
    name: "Eagle Eye",
    description: "Score an eagle (2 under par)",
    icon: "\u{1F985}",
    category: "scoring",
  },
  {
    id: "on_fire",
    name: "On Fire",
    description: "Score 36+ Stableford points in a round",
    icon: "\u{1F525}",
    category: "scoring",
  },

  // Social
  {
    id: "team_player",
    name: "Team Player",
    description: "Join a group",
    icon: "\u{1F91D}",
    category: "social",
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "Play 5 different courses",
    icon: "\u{1F5FA}\uFE0F",
    category: "social",
  },
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Play with 10 different people",
    icon: "\u{1F98B}",
    category: "social",
  },

  // Competitions
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    description: "Win Closest to Pin",
    icon: "\u{1F3AF}",
    category: "competitions",
  },
  {
    id: "big_hitter",
    name: "Big Hitter",
    description: "Win Longest Drive",
    icon: "\u{1F4AA}",
    category: "competitions",
  },
  {
    id: "champion",
    name: "Champion",
    description: "Win a round (1st place)",
    icon: "\u{1F3C6}",
    category: "competitions",
  },
];

export const BADGE_MAP = new Map(BADGE_DEFINITIONS.map((b) => [b.id, b]));
