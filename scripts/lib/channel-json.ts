import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CreateChannelInput } from "../../src/types/channel";

export const DEFAULT_CHANNEL_FILE = "channel.json";

function requireField(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing or invalid field in channel JSON: ${field}`);
  }
  return value.trim();
}

export function parseChannelJson(raw: unknown): CreateChannelInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Channel file must contain a JSON object");
  }

  const record = raw as Record<string, unknown>;

  const input: CreateChannelInput = {
    name: requireField(record, "name"),
    niche_prompt: requireField(record, "niche_prompt"),
    youtube_client_id: requireField(record, "youtube_client_id"),
    youtube_client_secret: requireField(record, "youtube_client_secret"),
    youtube_refresh_token: requireField(record, "youtube_refresh_token"),
    elevenlabs_voice_id: requireField(record, "elevenlabs_voice_id"),
    creatomate_template_id: requireField(record, "creatomate_template_id"),
  };

  if (typeof record.upload_frequency === "string") {
    input.upload_frequency = record.upload_frequency.trim();
  }
  if (typeof record.monthly_budget_usd === "number") {
    input.monthly_budget_usd = record.monthly_budget_usd;
  }
  if (record.status === "active" || record.status === "paused") {
    input.status = record.status;
  }
  if (typeof record.target_duration_minutes === "number") {
    input.target_duration_minutes = record.target_duration_minutes;
  }
  if (
    record.audience_level === "beginner" ||
    record.audience_level === "intermediate" ||
    record.audience_level === "advanced" ||
    record.audience_level === "general"
  ) {
    input.audience_level = record.audience_level;
  }
  if (
    record.title_style === "curiosity" ||
    record.title_style === "question" ||
    record.title_style === "listicle" ||
    record.title_style === "story" ||
    record.title_style === "controversy"
  ) {
    input.title_style = record.title_style;
  }
  if (typeof record.auto_publish === "boolean") {
    input.auto_publish = record.auto_publish;
  }
  if (typeof record.youtube_category_id === "string") {
    input.youtube_category_id = record.youtube_category_id.trim();
  }
  if (typeof record.creatomate_thumbnail_template_id === "string") {
    input.creatomate_thumbnail_template_id =
      record.creatomate_thumbnail_template_id.trim();
  }
  if (typeof record.require_thumbnail === "boolean") {
    input.require_thumbnail = record.require_thumbnail;
  }
  if (typeof record.auto_generate_shorts === "boolean") {
    input.auto_generate_shorts = record.auto_generate_shorts;
  }
  if (typeof record.enable_ab_thumbnails === "boolean") {
    input.enable_ab_thumbnails = record.enable_ab_thumbnails;
  }
  if (typeof record.enable_engagement === "boolean") {
    input.enable_engagement = record.enable_engagement;
  }
  if (typeof record.default_playlist_id === "string") {
    input.default_playlist_id = record.default_playlist_id.trim();
  }
  if (Array.isArray(record.creatomate_template_ids)) {
    input.creatomate_template_ids = record.creatomate_template_ids.filter(
      (id): id is string => typeof id === "string" && id.trim() !== "",
    );
  }
  if (record.review_mode === "required" || record.review_mode === "optional") {
    input.review_mode = record.review_mode;
  }
  if (typeof record.min_manual_publishes_before_auto === "number") {
    input.min_manual_publishes_before_auto =
      record.min_manual_publishes_before_auto;
  }
  if (typeof record.max_videos_per_week === "number") {
    input.max_videos_per_week = record.max_videos_per_week;
  }
  if (typeof record.disclose_synthetic_media === "boolean") {
    input.disclose_synthetic_media = record.disclose_synthetic_media;
  }

  return input;
}

export async function loadChannelFile(
  filePath: string,
): Promise<{ path: string; raw: Record<string, unknown>; input: CreateChannelInput }> {
  const resolved = path.resolve(process.cwd(), filePath);
  const contents = await readFile(resolved, "utf8");
  const raw = JSON.parse(contents) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("Channel file must contain a JSON object");
  }
  return {
    path: resolved,
    raw: raw as Record<string, unknown>,
    input: parseChannelJson(raw),
  };
}

export async function saveRefreshTokenToChannelFile(
  filePath: string,
  refreshToken: string,
): Promise<void> {
  const resolved = path.resolve(process.cwd(), filePath);
  const contents = await readFile(resolved, "utf8");
  const raw = JSON.parse(contents) as Record<string, unknown>;
  raw.youtube_refresh_token = refreshToken;
  await writeFile(resolved, `${JSON.stringify(raw, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function readOAuthCredentialsFromRecord(
  record: Record<string, unknown>,
): { clientId: string; clientSecret: string } | null {
  const clientId = record.youtube_client_id;
  const clientSecret = record.youtube_client_secret;
  if (
    typeof clientId === "string" &&
    clientId.trim() !== "" &&
    typeof clientSecret === "string" &&
    clientSecret.trim() !== ""
  ) {
    return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  }
  return null;
}
