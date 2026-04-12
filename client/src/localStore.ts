/**
 * Local browser storage for things that persist across a browser session:
 * - which player the user is acting as in a given round
 * - last room code they joined
 * - recent rounds for the device
 */

const KEY_RECENT_ROUNDS = "dg:recentRounds";

export interface RecentRound {
  roomCode: string;
  courseName: string;
  joinedAt: string;
}

export function getRecentRounds(): RecentRound[] {
  try {
    const raw = localStorage.getItem(KEY_RECENT_ROUNDS);
    if (!raw) return [];
    return JSON.parse(raw) as RecentRound[];
  } catch {
    return [];
  }
}

export function addRecentRound(r: RecentRound): void {
  const rounds = getRecentRounds().filter((x) => x.roomCode !== r.roomCode);
  rounds.unshift(r);
  localStorage.setItem(KEY_RECENT_ROUNDS, JSON.stringify(rounds.slice(0, 10)));
}

export function getActivePlayerId(roomCode: string): string | null {
  return localStorage.getItem(`dg:player:${roomCode}`);
}

export function setActivePlayerId(roomCode: string, playerId: string): void {
  localStorage.setItem(`dg:player:${roomCode}`, playerId);
}

export function clearActivePlayerId(roomCode: string): void {
  localStorage.removeItem(`dg:player:${roomCode}`);
}
