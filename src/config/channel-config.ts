import type { DecryptedChannel } from "../db/repositories/channels";
import type { ContentSettings } from "../types/channel";
import type { PlatformConfig } from "./index";
import { parseTemplateIds } from "../utils/template-picker";

export interface ServiceConfig {
  port: number;
  authToken: string;
  tmpDir: string;
  anthropic: PlatformConfig["anthropic"];
  elevenlabs: PlatformConfig["elevenlabs"] & { voiceId: string };
  creatomate: PlatformConfig["creatomate"] & {
    templateId: string;
    thumbnailTemplateId: string | null;
  };
  publicBaseUrl: string;
  youtube: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    privacyStatus: "private" | "unlisted";
    categoryId: string;
    discloseSyntheticMedia: boolean;
  };
  retry: PlatformConfig["retry"];
  channelId: string;
  nichePrompt: string;
  content: ContentSettings;
}

export function buildServiceConfig(
  platform: PlatformConfig,
  channel: DecryptedChannel,
  templateIdOverride?: string,
): ServiceConfig {
  return {
    port: platform.port,
    authToken: platform.authToken,
    tmpDir: platform.tmpDir,
    anthropic: platform.anthropic,
    elevenlabs: {
      ...platform.elevenlabs,
      voiceId: channel.elevenlabs_voice_id,
    },
    creatomate: {
      ...platform.creatomate,
      templateId: templateIdOverride ?? channel.creatomate_template_id,
      thumbnailTemplateId:
        channel.creatomate_thumbnail_template_id ??
        platform.creatomate.thumbnailTemplateId,
    },
    publicBaseUrl: platform.publicBaseUrl,
    youtube: {
      clientId: channel.youtube_client_id,
      clientSecret: channel.youtube_client_secret,
      refreshToken: channel.youtube_refresh_token,
      privacyStatus: platform.youtube.privacyStatus,
      categoryId: channel.youtube_category_id || platform.youtube.categoryId,
      discloseSyntheticMedia: channel.disclose_synthetic_media,
    },
    retry: platform.retry,
    channelId: channel.id,
    nichePrompt: channel.niche_prompt,
    content: {
      targetDurationMinutes: channel.target_duration_minutes,
      audienceLevel: channel.audience_level,
      titleStyle: channel.title_style,
      autoPublish: channel.auto_publish,
      requireThumbnail: channel.require_thumbnail,
      autoGenerateShorts: channel.auto_generate_shorts,
      enableAbThumbnails: channel.enable_ab_thumbnails,
      enableEngagement: channel.enable_engagement,
      defaultPlaylistId: channel.default_playlist_id,
      reviewMode: channel.review_mode,
      manualPublishCount: channel.manual_publish_count,
      minManualPublishesBeforeAuto: channel.min_manual_publishes_before_auto,
      maxVideosPerWeek: channel.max_videos_per_week,
      discloseSyntheticMedia: channel.disclose_synthetic_media,
    },
  };
}

export function listChannelTemplateIds(channel: DecryptedChannel): string[] {
  const pool = parseTemplateIds(channel);
  return pool.length > 0 ? pool : [channel.creatomate_template_id];
}
