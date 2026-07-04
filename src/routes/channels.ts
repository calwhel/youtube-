import type { Request, Response, Router } from "express";

import type { PlatformConfig } from "../config";
import { buildServiceConfig } from "../config/channel-config";
import {
  ChannelRepository,
  isAudienceLevel,
  isReviewMode,
  isTitleStyle,
} from "../db/repositories/channels";
import { YouTubeService } from "../services/youtube";
import { formatYouTubeAuthError } from "../utils/youtube-auth-error";
import type {
  CreateChannelInput,
  UpdateChannelInput,
} from "../types/channel";

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function parseTemplateIdsArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const ids = value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
  return ids.length > 0 ? ids : [];
}

function parseCreateChannelBody(body: unknown): CreateChannelInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;
  const requiredStringFields = [
    "name",
    "niche_prompt",
    "youtube_client_id",
    "youtube_client_secret",
    "youtube_refresh_token",
    "elevenlabs_voice_id",
    "creatomate_template_id",
  ] as const;

  for (const field of requiredStringFields) {
    if (typeof record[field] !== "string" || record[field].trim() === "") {
      throw new Error(`Missing or invalid field: ${field}`);
    }
  }

  if (
    record.audience_level !== undefined &&
    (typeof record.audience_level !== "string" ||
      !isAudienceLevel(record.audience_level))
  ) {
    throw new Error("Invalid field: audience_level");
  }

  if (
    record.title_style !== undefined &&
    (typeof record.title_style !== "string" ||
      !isTitleStyle(record.title_style))
  ) {
    throw new Error("Invalid field: title_style");
  }

  return {
    name: (record.name as string).trim(),
    niche_prompt: (record.niche_prompt as string).trim(),
    youtube_client_id: (record.youtube_client_id as string).trim(),
    youtube_client_secret: (record.youtube_client_secret as string).trim(),
    youtube_refresh_token: (record.youtube_refresh_token as string).trim(),
    elevenlabs_voice_id: (record.elevenlabs_voice_id as string).trim(),
    creatomate_template_id: (record.creatomate_template_id as string).trim(),
    upload_frequency:
      typeof record.upload_frequency === "string"
        ? record.upload_frequency.trim()
        : undefined,
    monthly_budget_usd: parseOptionalNumber(record.monthly_budget_usd),
    status:
      record.status === "active" || record.status === "paused"
        ? record.status
        : undefined,
    target_duration_minutes: parseOptionalNumber(record.target_duration_minutes),
    audience_level:
      typeof record.audience_level === "string" &&
      isAudienceLevel(record.audience_level)
        ? record.audience_level
        : undefined,
    title_style:
      typeof record.title_style === "string" &&
      isTitleStyle(record.title_style)
        ? record.title_style
        : undefined,
    auto_publish: parseOptionalBoolean(record.auto_publish),
    youtube_category_id:
      typeof record.youtube_category_id === "string"
        ? record.youtube_category_id.trim()
        : undefined,
    creatomate_thumbnail_template_id:
      typeof record.creatomate_thumbnail_template_id === "string"
        ? record.creatomate_thumbnail_template_id.trim()
        : undefined,
    require_thumbnail: parseOptionalBoolean(record.require_thumbnail),
    auto_generate_shorts: parseOptionalBoolean(record.auto_generate_shorts),
    enable_ab_thumbnails: parseOptionalBoolean(record.enable_ab_thumbnails),
    enable_engagement: parseOptionalBoolean(record.enable_engagement),
    default_playlist_id:
      typeof record.default_playlist_id === "string"
        ? record.default_playlist_id.trim()
        : undefined,
    creatomate_template_ids: parseTemplateIdsArray(record.creatomate_template_ids),
    review_mode:
      typeof record.review_mode === "string" && isReviewMode(record.review_mode)
        ? record.review_mode
        : undefined,
    min_manual_publishes_before_auto: parseOptionalNumber(
      record.min_manual_publishes_before_auto,
    ),
    max_videos_per_week: parseOptionalNumber(record.max_videos_per_week),
    disclose_synthetic_media: parseOptionalBoolean(record.disclose_synthetic_media),
  };
}

function parseUpdateChannelBody(body: unknown): UpdateChannelInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;
  const input: UpdateChannelInput = {};

  const stringFields = [
    "name",
    "niche_prompt",
    "youtube_client_id",
    "youtube_client_secret",
    "youtube_refresh_token",
    "elevenlabs_voice_id",
    "creatomate_template_id",
    "upload_frequency",
    "youtube_category_id",
    "creatomate_thumbnail_template_id",
  ] as const;

  for (const field of stringFields) {
    if (record[field] !== undefined) {
      if (typeof record[field] !== "string" || record[field].trim() === "") {
        throw new Error(`Invalid field: ${field}`);
      }
      input[field] = record[field].trim();
    }
  }

  if (record.creatomate_thumbnail_template_id === null) {
    input.creatomate_thumbnail_template_id = null;
  }

  if (record.monthly_budget_usd !== undefined) {
    if (typeof record.monthly_budget_usd !== "number") {
      throw new Error("Invalid field: monthly_budget_usd");
    }
    input.monthly_budget_usd = record.monthly_budget_usd;
  }

  if (record.target_duration_minutes !== undefined) {
    if (typeof record.target_duration_minutes !== "number") {
      throw new Error("Invalid field: target_duration_minutes");
    }
    input.target_duration_minutes = record.target_duration_minutes;
  }

  if (record.status !== undefined) {
    if (record.status !== "active" && record.status !== "paused") {
      throw new Error("Invalid field: status");
    }
    input.status = record.status;
  }

  if (record.audience_level !== undefined) {
    if (
      typeof record.audience_level !== "string" ||
      !isAudienceLevel(record.audience_level)
    ) {
      throw new Error("Invalid field: audience_level");
    }
    input.audience_level = record.audience_level;
  }

  if (record.title_style !== undefined) {
    if (
      typeof record.title_style !== "string" ||
      !isTitleStyle(record.title_style)
    ) {
      throw new Error("Invalid field: title_style");
    }
    input.title_style = record.title_style;
  }

  if (record.auto_publish !== undefined) {
    if (typeof record.auto_publish !== "boolean") {
      throw new Error("Invalid field: auto_publish");
    }
    input.auto_publish = record.auto_publish;
  }

  if (record.require_thumbnail !== undefined) {
    if (typeof record.require_thumbnail !== "boolean") {
      throw new Error("Invalid field: require_thumbnail");
    }
    input.require_thumbnail = record.require_thumbnail;
  }

  for (const field of [
    "auto_generate_shorts",
    "enable_ab_thumbnails",
    "enable_engagement",
  ] as const) {
    if (record[field] !== undefined) {
      if (typeof record[field] !== "boolean") {
        throw new Error(`Invalid field: ${field}`);
      }
      input[field] = record[field];
    }
  }

  if (record.default_playlist_id !== undefined) {
    if (
      record.default_playlist_id !== null &&
      (typeof record.default_playlist_id !== "string" ||
        record.default_playlist_id.trim() === "")
    ) {
      throw new Error("Invalid field: default_playlist_id");
    }
    input.default_playlist_id =
      record.default_playlist_id === null
        ? null
        : record.default_playlist_id.trim();
  }

  if (record.creatomate_template_ids !== undefined) {
    const ids = parseTemplateIdsArray(record.creatomate_template_ids);
    if (ids === undefined) {
      throw new Error("Invalid field: creatomate_template_ids");
    }
    input.creatomate_template_ids = ids;
  }

  if (record.review_mode !== undefined) {
    if (
      typeof record.review_mode !== "string" ||
      !isReviewMode(record.review_mode)
    ) {
      throw new Error("Invalid field: review_mode");
    }
    input.review_mode = record.review_mode;
  }

  if (record.min_manual_publishes_before_auto !== undefined) {
    if (typeof record.min_manual_publishes_before_auto !== "number") {
      throw new Error("Invalid field: min_manual_publishes_before_auto");
    }
    input.min_manual_publishes_before_auto = record.min_manual_publishes_before_auto;
  }

  if (record.max_videos_per_week !== undefined) {
    if (typeof record.max_videos_per_week !== "number") {
      throw new Error("Invalid field: max_videos_per_week");
    }
    input.max_videos_per_week = record.max_videos_per_week;
  }

  if (record.disclose_synthetic_media !== undefined) {
    if (typeof record.disclose_synthetic_media !== "boolean") {
      throw new Error("Invalid field: disclose_synthetic_media");
    }
    input.disclose_synthetic_media = record.disclose_synthetic_media;
  }

  return input;
}

export function createChannelRoutes(
  router: Router,
  platform: PlatformConfig,
): void {
  const channels = new ChannelRepository(platform.encryptionKey);

  router.post("/channels", async (req: Request, res: Response) => {
    try {
      const input = parseCreateChannelBody(req.body);
      const channel = await channels.create(input);
      res.status(201).json({ channel });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  router.get("/channels", async (_req, res) => {
    try {
      const channelList = await channels.listAll();
      res.status(200).json({ channels: channelList });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  router.get("/channels/:id", async (req, res) => {
    const channel = await channels.getPublicView(req.params.id);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    res.status(200).json({ channel });
  });

  router.get("/channels/:id/youtube-status", async (req, res) => {
    try {
      const channel = await channels.findDecryptedById(req.params.id);
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      const serviceConfig = buildServiceConfig(platform, channel);
      const youtube = new YouTubeService(serviceConfig);
      const result = await youtube.verifyConnection();

      res.status(200).json({
        ok: true,
        connected: true,
        channel_title: result.channelTitle,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(200).json({
        ok: false,
        connected: false,
        error: formatYouTubeAuthError(message),
      });
    }
  });

  router.patch("/channels/:id", async (req, res) => {
    try {
      const input = parseUpdateChannelBody(req.body);
      const channel = await channels.update(req.params.id, input);
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      res.status(200).json({ channel });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  router.delete("/channels/:id", async (req, res) => {
    const deleted = await channels.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    res.status(200).json({ success: true });
  });
}
