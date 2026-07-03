import { execSync } from "node:child_process";
import path from "node:path";

import dotenv from "dotenv";

import { loadConfig } from "../src/config";
import { closePool, getPool } from "../src/db/pool";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

function checkEnv(name: string, required = true): void {
  const value = process.env[name]?.trim();
  if (value) {
    record(name, true, "set");
  } else if (required) {
    record(name, false, "missing (required)");
  } else {
    record(name, true, "not set (optional)");
  }
}

function checkFfmpeg(): void {
  try {
    const version = execSync("ffmpeg -version", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split("\n")[0];
    record("ffmpeg", true, version ?? "installed");
  } catch {
    record(
      "ffmpeg",
      false,
      "not found — install locally for dev; included in Docker/Railway",
    );
  }
}

async function checkDatabase(): Promise<void> {
  const url =
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.RAILWAY_DATABASE_URL?.trim();

  if (!url) {
    record("database", false, "NEON_DATABASE_URL not set");
    return;
  }

  try {
    const pool = getPool();
    const result = await pool.query<{ now: Date }>("SELECT NOW() as now");
    record("database", true, `connected (${result.rows[0]?.now.toISOString()})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record("database", false, message);
  }
}

async function checkSchema(): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'channels'
       ) as exists`,
    );
    const exists = result.rows[0]?.exists === true;
    record(
      "schema",
      exists,
      exists
        ? "channels table exists — run bootstrap-db if upgrading"
        : "channels table missing — run npm run bootstrap-db",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record("schema", false, message);
  }
}

async function checkPlatformConfig(): Promise<void> {
  try {
    loadConfig();
    record("platform config", true, "all required vars present");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record("platform config", false, message);
  }
}

function printResults(): boolean {
  const width = Math.max(...checks.map((c) => c.name.length), 10);
  console.log("");
  console.log("Setup check results");
  console.log("=".repeat(width + 30));

  for (const check of checks) {
    const icon = check.ok ? "✓" : "✗";
    console.log(`${icon} ${check.name.padEnd(width)}  ${check.detail}`);
  }

  console.log("");
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) {
    console.log("All checks passed. Next: npm run bootstrap-db && npm start");
    return true;
  }

  console.log(`${failed.length} check(s) failed. See DEPLOY.md for setup steps.`);
  return false;
}

async function main(): Promise<void> {
  console.log("YouTube Pipeline — setup check");

  checkEnv("AUTH_TOKEN");
  checkEnv("ENCRYPTION_KEY");
  checkEnv("NEON_DATABASE_URL");
  checkEnv("ANTHROPIC_API_KEY");
  checkEnv("ELEVENLABS_API_KEY");
  checkEnv("CREATOMATE_API_KEY");
  checkEnv("PUBLIC_BASE_URL", false);
  checkEnv("YOUTUBE_CLIENT_ID", false);
  checkEnv("YOUTUBE_CLIENT_SECRET", false);
  checkEnv("YOUTUBE_REFRESH_TOKEN", false);
  checkEnv("SLACK_WEBHOOK_URL", false);
  checkEnv("DISCORD_WEBHOOK_URL", false);

  checkFfmpeg();
  await checkDatabase();
  await checkSchema();
  await checkPlatformConfig();

  const ok = printResults();
  await closePool();
  process.exit(ok ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await closePool();
  process.exit(1);
});
