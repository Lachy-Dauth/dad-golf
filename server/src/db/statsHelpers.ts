import type { Gender } from "@dad-golf/shared";
import type { PlayerHoleResult } from "@dad-golf/shared";

export interface IndexedPlayer {
  id: string;
  roundId: string;
  userId: string | null;
  name: string;
  handicap: number;
  gender: Gender;
}

export interface IndexedScore {
  id: string;
  roundId: string;
  playerId: string;
  holeNumber: number;
  strokes: number;
  createdAt: string;
}

export function indexPlayersByRound(rows: Record<string, unknown>[]): Map<string, IndexedPlayer[]> {
  const map = new Map<string, IndexedPlayer[]>();
  for (const p of rows) {
    const roundId = p.round_id as string;
    const player: IndexedPlayer = {
      id: p.id as string,
      roundId,
      userId: p.user_id as string | null,
      name: p.name as string,
      handicap: Number(p.handicap),
      gender: (p.gender === "F" ? "F" : "M") as Gender,
    };
    const list = map.get(roundId);
    if (list) list.push(player);
    else map.set(roundId, [player]);
  }
  return map;
}

export function indexScoresByRound(rows: Record<string, unknown>[]): Map<string, IndexedScore[]> {
  const map = new Map<string, IndexedScore[]>();
  for (const s of rows) {
    const roundId = s.round_id as string;
    const score: IndexedScore = {
      id: s.id as string,
      roundId,
      playerId: s.player_id as string,
      holeNumber: Number(s.hole_number),
      strokes: Number(s.strokes),
      createdAt: s.created_at as string,
    };
    const list = map.get(roundId);
    if (list) list.push(score);
    else map.set(roundId, [score]);
  }
  return map;
}

export interface ScoringDistribution {
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  strokesUnderPar: number;
  strokesAtPar: number;
  strokesOverOne: number;
  strokesOverTwo: number;
  strokesOverThreePlus: number;
}

export interface ParTypeAccumulator {
  par3Pts: number;
  par3Strk: number;
  par3Count: number;
  par4Pts: number;
  par4Strk: number;
  par4Count: number;
  par5Pts: number;
  par5Strk: number;
  par5Count: number;
}

export function emptyDistribution(): ScoringDistribution {
  return {
    eagles: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doublePlus: 0,
    strokesUnderPar: 0,
    strokesAtPar: 0,
    strokesOverOne: 0,
    strokesOverTwo: 0,
    strokesOverThreePlus: 0,
  };
}

export function emptyParAccumulator(): ParTypeAccumulator {
  return {
    par3Pts: 0,
    par3Strk: 0,
    par3Count: 0,
    par4Pts: 0,
    par4Strk: 0,
    par4Count: 0,
    par5Pts: 0,
    par5Strk: 0,
    par5Count: 0,
  };
}

export function accumulateHoleStats(
  played: PlayerHoleResult[],
  dist: ScoringDistribution,
  parAcc: ParTypeAccumulator,
): void {
  for (const h of played) {
    if (h.points >= 4) dist.eagles++;
    else if (h.points === 3) dist.birdies++;
    else if (h.points === 2) dist.pars++;
    else if (h.points === 1) dist.bogeys++;
    else dist.doublePlus++;

    const grossDiff = (h.strokes ?? 0) - h.par;
    if (grossDiff < 0) dist.strokesUnderPar++;
    else if (grossDiff === 0) dist.strokesAtPar++;
    else if (grossDiff === 1) dist.strokesOverOne++;
    else if (grossDiff === 2) dist.strokesOverTwo++;
    else dist.strokesOverThreePlus++;

    if (h.par === 3) {
      parAcc.par3Pts += h.points;
      parAcc.par3Strk += h.strokes ?? 0;
      parAcc.par3Count++;
    } else if (h.par === 4) {
      parAcc.par4Pts += h.points;
      parAcc.par4Strk += h.strokes ?? 0;
      parAcc.par4Count++;
    } else if (h.par >= 5) {
      parAcc.par5Pts += h.points;
      parAcc.par5Strk += h.strokes ?? 0;
      parAcc.par5Count++;
    }
  }
}

export function parAvg(total: number, count: number): number | null {
  return count > 0 ? Math.round((total / count) * 10) / 10 : null;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
