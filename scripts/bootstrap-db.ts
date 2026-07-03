import path from "node:path";

import dotenv from "dotenv";

import { bootstrapSchema, closePool } from "../src/db/pool";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main(): Promise<void> {
  console.log("Bootstrapping database schema...");
  await bootstrapSchema();
  console.log("Done. Schema and migrations applied.");
  await closePool();
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bootstrap failed: ${message}`);
  await closePool();
  process.exit(1);
});
