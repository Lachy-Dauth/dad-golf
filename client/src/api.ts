import type {
  Course,
  Group,
  GroupMember,
  Hole,
  Player,
  RoundState,
  Score,
} from "@dad-golf/shared";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  // courses
  listCourses: () =>
    fetch("/api/courses").then((r) => json<{ courses: Course[] }>(r)),
  getCourse: (id: string) =>
    fetch(`/api/courses/${id}`).then((r) => json<{ course: Course }>(r)),
  createCourse: (payload: {
    name: string;
    location: string | null;
    holes: Hole[];
  }) =>
    fetch("/api/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<{ course: Course }>(r)),
  deleteCourse: (id: string) =>
    fetch(`/api/courses/${id}`, { method: "DELETE" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),

  // groups
  listGroups: () =>
    fetch("/api/groups").then((r) =>
      json<{ groups: Array<Group & { members: GroupMember[] }> }>(r),
    ),
  getGroup: (id: string) =>
    fetch(`/api/groups/${id}`).then((r) =>
      json<{ group: Group; members: GroupMember[] }>(r),
    ),
  createGroup: (name: string) =>
    fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<{ group: Group; members: GroupMember[] }>(r)),
  deleteGroup: (id: string) =>
    fetch(`/api/groups/${id}`, { method: "DELETE" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  addGroupMember: (groupId: string, name: string, handicap: number) =>
    fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ member: GroupMember }>(r)),
  updateGroupMember: (
    groupId: string,
    memberId: string,
    name: string,
    handicap: number,
  ) =>
    fetch(`/api/groups/${groupId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ ok: boolean }>(r)),
  removeGroupMember: (groupId: string, memberId: string) =>
    fetch(`/api/groups/${groupId}/members/${memberId}`, {
      method: "DELETE",
    }).then((r) => json<{ ok: boolean }>(r)),

  // rounds
  createRound: (payload: {
    courseId: string;
    groupId: string | null;
    importGroupMembers: boolean;
  }) =>
    fetch("/api/rounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<{ state: RoundState }>(r)),
  getRound: (code: string) =>
    fetch(`/api/rounds/${code}`).then((r) =>
      json<{ state: RoundState }>(r),
    ),
  joinRound: (code: string, name: string, handicap: number) =>
    fetch(`/api/rounds/${code}/players`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ player: Player; state: RoundState }>(r)),
  updateRoundPlayer: (
    code: string,
    playerId: string,
    name: string,
    handicap: number,
  ) =>
    fetch(`/api/rounds/${code}/players/${playerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, handicap }),
    }).then((r) => json<{ ok: boolean; state: RoundState }>(r)),
  removeRoundPlayer: (code: string, playerId: string) =>
    fetch(`/api/rounds/${code}/players/${playerId}`, {
      method: "DELETE",
    }).then((r) => json<{ ok: boolean }>(r)),
  startRound: (code: string) =>
    fetch(`/api/rounds/${code}/start`, { method: "POST" }).then((r) =>
      json<{ state: RoundState }>(r),
    ),
  completeRound: (code: string) =>
    fetch(`/api/rounds/${code}/complete`, { method: "POST" }).then((r) =>
      json<{ state: RoundState }>(r),
    ),
  setCurrentHole: (code: string, holeNumber: number) =>
    fetch(`/api/rounds/${code}/current-hole`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holeNumber }),
    }).then((r) => json<{ state: RoundState }>(r)),
  submitScore: (
    code: string,
    playerId: string,
    holeNumber: number,
    strokes: number,
  ) =>
    fetch(`/api/rounds/${code}/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, holeNumber, strokes }),
    }).then((r) => json<{ score: Score; state: RoundState }>(r)),
  clearScore: (code: string, playerId: string, holeNumber: number) =>
    fetch(`/api/rounds/${code}/scores`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, holeNumber }),
    }).then((r) => json<{ ok: boolean }>(r)),
};
