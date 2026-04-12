import type { CompetitionType, HoleCompetition } from "@dad-golf/shared";
import { pool } from "./pool.js";
import { now, newId } from "./helpers.js";

interface CompetitionRow {
  id: string;
  round_id: string;
  hole_number: number;
  type: string;
  created_at: string;
}

export async function createCompetition(
  roundId: string,
  holeNumber: number,
  type: CompetitionType,
): Promise<HoleCompetition> {
  const id = newId();
  const createdAt = now();
  const { rows } = await pool.query(
    `INSERT INTO hole_competitions (id, round_id, hole_number, type, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, roundId, holeNumber, type, createdAt],
  );
  const row = rows[0] as CompetitionRow;
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: Number(row.hole_number),
    type: row.type as CompetitionType,
    createdAt: row.created_at,
    claims: [],
  };
}

export async function deleteCompetition(competitionId: string): Promise<void> {
  await pool.query(`DELETE FROM hole_competitions WHERE id = $1`, [competitionId]);
}

export async function getCompetition(competitionId: string): Promise<HoleCompetition | null> {
  const { rows } = await pool.query(`SELECT * FROM hole_competitions WHERE id = $1`, [
    competitionId,
  ]);
  if (rows.length === 0) return null;
  const row = rows[0] as CompetitionRow;
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: Number(row.hole_number),
    type: row.type as CompetitionType,
    createdAt: row.created_at,
    claims: [],
  };
}

export async function upsertClaim(
  competitionId: string,
  playerId: string,
  claim: string,
): Promise<void> {
  const id = newId();
  const createdAt = now();
  await pool.query(
    `INSERT INTO competition_claims (id, competition_id, player_id, claim, is_winner, created_at)
     VALUES ($1, $2, $3, $4, 0, $5)
     ON CONFLICT (competition_id, player_id) DO UPDATE
       SET claim = EXCLUDED.claim, created_at = EXCLUDED.created_at`,
    [id, competitionId, playerId, claim, createdAt],
  );
}

export async function deleteClaim(competitionId: string, playerId: string): Promise<void> {
  await pool.query(`DELETE FROM competition_claims WHERE competition_id = $1 AND player_id = $2`, [
    competitionId,
    playerId,
  ]);
}

export async function setClaimWinner(competitionId: string, playerId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE competition_claims SET is_winner = 0 WHERE competition_id = $1`, [
      competitionId,
    ]);
    const result = await client.query(
      `UPDATE competition_claims SET is_winner = 1 WHERE competition_id = $1 AND player_id = $2`,
      [competitionId, playerId],
    );
    if ((result.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      throw new Error("no claim found for that player");
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function clearClaimWinner(competitionId: string): Promise<void> {
  await pool.query(`UPDATE competition_claims SET is_winner = 0 WHERE competition_id = $1`, [
    competitionId,
  ]);
}

export async function listCompetitions(roundId: string): Promise<HoleCompetition[]> {
  const { rows } = await pool.query(
    `SELECT
       hc.id, hc.round_id, hc.hole_number, hc.type, hc.created_at,
       cc.id AS claim_id, cc.player_id, cc.claim, cc.is_winner, cc.created_at AS claim_created_at,
       p.name AS player_name
     FROM hole_competitions hc
     LEFT JOIN competition_claims cc ON cc.competition_id = hc.id
     LEFT JOIN players p ON p.id = cc.player_id
     WHERE hc.round_id = $1
     ORDER BY hc.hole_number ASC, cc.created_at ASC`,
    [roundId],
  );

  const map = new Map<string, HoleCompetition>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const compId = row.id as string;
    if (!map.has(compId)) {
      map.set(compId, {
        id: compId,
        roundId: row.round_id as string,
        holeNumber: Number(row.hole_number),
        type: row.type as CompetitionType,
        createdAt: row.created_at as string,
        claims: [],
      });
    }
    if (row.claim_id) {
      map.get(compId)!.claims.push({
        id: row.claim_id as string,
        competitionId: compId,
        playerId: row.player_id as string,
        playerName: (row.player_name as string) ?? "",
        claim: row.claim as string,
        isWinner: (row.is_winner as number) === 1,
        createdAt: row.claim_created_at as string,
      });
    }
  }

  return Array.from(map.values());
}
