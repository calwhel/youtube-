import path from "node:path";

import dotenv from "dotenv";

import { loadConfig } from "../src/config";
import { bootstrapSchema, closePool } from "../src/db/pool";
import { ChannelRepository } from "../src/db/repositories/channels";

import { DEFAULT_CHANNEL_FILE, loadChannelFile } from "./lib/channel-json";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main(): Promise<void> {
  const fileArg = process.argv[2] ?? DEFAULT_CHANNEL_FILE;
  const { input } = await loadChannelFile(fileArg);

  const platform = loadConfig();
  await bootstrapSchema();

  const channels = new ChannelRepository(platform.encryptionKey);
  const channel = await channels.create(input);

  console.log("Channel created:");
  console.log(JSON.stringify(channel, null, 2));

  await closePool();
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Create channel failed: ${message}`);
  await closePool();
  process.exit(1);
});
