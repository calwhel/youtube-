import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getDatabaseUrl(): string {
  const url =
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.RAILWAY_DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Missing database URL. Add Railway Postgres (DATABASE_URL) or set NEON_DATABASE_URL.",
    );
  }

  return url;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl:
        process.env.PGSSLMODE === "disable"
          ? false
          : { rejectUnauthorized: false },
      max: 10,
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function waitForDatabase(
  maxAttempts = 30,
  delayMs = 5000,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await getPool().query("SELECT 1");
      if (attempt > 1) {
        console.log(`[db] connected on attempt ${attempt}`);
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[db] connect attempt ${attempt}/${maxAttempts} failed: ${message}`,
      );
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function bootstrapSchema(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");
  await getPool().query(schemaSql);

  const migrationsPath = path.join(__dirname, "migrations.sql");
  const migrationsSql = await readFile(migrationsPath, "utf8");
  await getPool().query(migrationsSql);

  console.log("[db] schema bootstrap complete");
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
