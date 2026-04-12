import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const databaseUrl = process.env.DATABASE_URL;

function parseSslConfig(): pg.PoolConfig["ssl"] {
  try {
    const sslmode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
    if (sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full") {
      return { rejectUnauthorized: sslmode !== "require" };
    }
  } catch {
    // not a valid URL — skip SSL
  }
  return undefined;
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: parseSslConfig(),
});
