import { existsSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { loadConfig } from "../src/config";
import { bootstrapSchema, closePool } from "../src/db/pool";
import { ChannelRepository } from "../src/db/repositories/channels";

import {
  DEFAULT_CHANNEL_FILE,
  loadChannelFile,
} from "./lib/channel-json";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function isPlaceholder(value: string): boolean {
  const normalized = value.toUpperCase();
  return (
    normalized.includes("YOUR_") ||
    normalized.includes("REPLACE") ||
    normalized === ""
  );
}

async function main(): Promise<void> {
  const channelFile = process.argv[2] ?? DEFAULT_CHANNEL_FILE;
  const forceChannel = process.argv.includes("--force-channel");

  console.log("YouTube Pipeline — first-time setup");
  console.log("");

  loadConfig();
  console.log("✓ Platform environment variables OK");

  await bootstrapSchema();
  console.log("✓ Database schema ready");

  const channelPath = path.resolve(process.cwd(), channelFile);
  if (!existsSync(channelPath)) {
    console.log("");
    console.log(`No ${channelFile} found. Create one first:`);
    console.log(`  cp channel.example.json ${channelFile}`);
    console.log(`  # Edit ${channelFile} with your API keys and niche`);
    console.log(`  npm run get-token          # OAuth (writes token into ${channelFile})`);
    console.log(`  npm run setup              # Run this again`);
    await closePool();
    process.exit(1);
  }

  const { input } = await loadChannelFile(channelFile);

  const missing: string[] = [];
  if (isPlaceholder(input.youtube_refresh_token)) {
    missing.push("youtube_refresh_token (run: npm run get-token)");
  }
  if (isPlaceholder(input.elevenlabs_voice_id)) {
    missing.push("elevenlabs_voice_id");
  }
  const useFfmpeg = process.env.VIDEO_RENDERER?.trim().toLowerCase() === "ffmpeg";
  if (!useFfmpeg && isPlaceholder(input.creatomate_template_id)) {
    missing.push("creatomate_template_id");
  }

  if (missing.length > 0) {
    console.log("");
    console.log(`Fill in ${channelFile} before continuing:`);
    for (const field of missing) {
      console.log(`  • ${field}`);
    }
    await closePool();
    process.exit(1);
  }

  const platform = loadConfig();
  const channels = new ChannelRepository(platform.encryptionKey);
  const existing = await channels.listAll();

  if (existing.length > 0 && !forceChannel) {
    console.log("");
    console.log(
      `✓ ${existing.length} channel(s) already in database — skipping create`,
    );
    console.log(`  Channel ID: ${existing[0]?.id}`);
    console.log("  To add another: npm run create-channel -- channel.json");
    await closePool();
    return;
  }

  const channel = await channels.create(input);
  console.log("");
  console.log("✓ Channel created in database");
  console.log(`  ID:   ${channel.id}`);
  console.log(`  Name: ${channel.name}`);
  console.log("");
  console.log("Start the server:");
  console.log("  npm start");
  console.log("");
  console.log("Generate your first video:");
  console.log(
    `  curl -X POST http://localhost:3000/api/run-pipeline \\`,
  );
  console.log(`    -H "x-auth-token: $AUTH_TOKEN" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"channel_id": "${channel.id}"}'`);

  await closePool();
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Setup failed: ${message}`);
  await closePool();
  process.exit(1);
});
