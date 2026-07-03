export type ReviewMode = "required" | "optional";

export type ChannelStatus = "active" | "paused";

export type AudienceLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "general";

export type TitleStyle =
  | "curiosity"
  | "question"
  | "listicle"
  | "story"
  | "controversy";

export interface ChannelRecord {
  id: string;
  name: string;
  niche_prompt: string;
  youtube_client_id: string;
  youtube_client_secret: string;
  youtube_refresh_token: string;
  elevenlabs_voice_id: string;
  creatomate_template_id: string;
  upload_frequency: string;
  monthly_budget_usd: string;
  status: ChannelStatus;
  target_duration_minutes: number;
  audience_level: AudienceLevel;
  title_style: TitleStyle;
  auto_publish: boolean;
  youtube_category_id: string;
  creatomate_thumbnail_template_id: string | null;
  require_thumbnail: boolean;
  auto_generate_shorts: boolean;
  enable_ab_thumbnails: boolean;
  enable_engagement: boolean;
  default_playlist_id: string | null;
  creatomate_template_ids: string[] | unknown;
  review_mode: ReviewMode;
  manual_publish_count: number;
  min_manual_publishes_before_auto: number;
  max_videos_per_week: number;
  disclose_synthetic_media: boolean;
  created_at: Date;
}

export interface ContentSettings {
  targetDurationMinutes: number;
  audienceLevel: AudienceLevel;
  titleStyle: TitleStyle;
  autoPublish: boolean;
  requireThumbnail: boolean;
  autoGenerateShorts: boolean;
  enableAbThumbnails: boolean;
  enableEngagement: boolean;
  defaultPlaylistId: string | null;
  reviewMode: ReviewMode;
  manualPublishCount: number;
  minManualPublishesBeforeAuto: number;
  maxVideosPerWeek: number;
  discloseSyntheticMedia: boolean;
}

export interface ChannelStatsRecord {
  id: string;
  channel_id: string;
  subs_count: string;
  watch_hours_total: string;
  monetization_eligible: boolean;
  monetization_alert_sent: boolean;
  last_checked_at: Date | null;
}

export interface CreateChannelInput {
  name: string;
  niche_prompt: string;
  youtube_client_id: string;
  youtube_client_secret: string;
  youtube_refresh_token: string;
  elevenlabs_voice_id: string;
  creatomate_template_id: string;
  upload_frequency?: string;
  monthly_budget_usd?: number;
  status?: ChannelStatus;
  target_duration_minutes?: number;
  audience_level?: AudienceLevel;
  title_style?: TitleStyle;
  auto_publish?: boolean;
  youtube_category_id?: string;
  creatomate_thumbnail_template_id?: string;
  require_thumbnail?: boolean;
  auto_generate_shorts?: boolean;
  enable_ab_thumbnails?: boolean;
  enable_engagement?: boolean;
  default_playlist_id?: string;
  creatomate_template_ids?: string[];
  review_mode?: ReviewMode;
  min_manual_publishes_before_auto?: number;
  max_videos_per_week?: number;
  disclose_synthetic_media?: boolean;
}

export interface UpdateChannelInput {
  name?: string;
  niche_prompt?: string;
  youtube_client_id?: string;
  youtube_client_secret?: string;
  youtube_refresh_token?: string;
  elevenlabs_voice_id?: string;
  creatomate_template_id?: string;
  upload_frequency?: string;
  monthly_budget_usd?: number;
  status?: ChannelStatus;
  target_duration_minutes?: number;
  audience_level?: AudienceLevel;
  title_style?: TitleStyle;
  auto_publish?: boolean;
  youtube_category_id?: string;
  creatomate_thumbnail_template_id?: string | null;
  require_thumbnail?: boolean;
  auto_generate_shorts?: boolean;
  enable_ab_thumbnails?: boolean;
  enable_engagement?: boolean;
  default_playlist_id?: string | null;
  creatomate_template_ids?: string[];
  review_mode?: ReviewMode;
  min_manual_publishes_before_auto?: number;
  max_videos_per_week?: number;
  disclose_synthetic_media?: boolean;
}

export interface ChannelPublicView {
  id: string;
  name: string;
  niche_prompt: string;
  youtube_client_id: string;
  elevenlabs_voice_id: string;
  creatomate_template_id: string;
  upload_frequency: string;
  monthly_budget_usd: number;
  status: ChannelStatus;
  target_duration_minutes: number;
  audience_level: AudienceLevel;
  title_style: TitleStyle;
  auto_publish: boolean;
  youtube_category_id: string;
  creatomate_thumbnail_template_id: string | null;
  require_thumbnail: boolean;
  auto_generate_shorts: boolean;
  enable_ab_thumbnails: boolean;
  enable_engagement: boolean;
  default_playlist_id: string | null;
  creatomate_template_ids: string[];
  review_mode: ReviewMode;
  manual_publish_count: number;
  min_manual_publishes_before_auto: number;
  max_videos_per_week: number;
  disclose_synthetic_media: boolean;
  created_at: string;
  stats: {
    subs_count: number;
    watch_hours_total: number;
    monetization_eligible: boolean;
    last_checked_at: string | null;
  } | null;
}

export interface YppReadinessChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface YppReadinessReport {
  channel_id: string;
  channel_name: string;
  readiness_score: number;
  ready_to_apply: boolean;
  variation_score: number;
  avg_authenticity_score: number;
  avg_inauthenticity_risk: number;
  published_video_count: number;
  manual_publish_count: number;
  videos_this_week: number;
  max_videos_per_week: number;
  auto_publish_allowed: boolean;
  subs_count: number;
  watch_hours_total: number;
  monetization_eligible: boolean;
  checklist: YppReadinessChecklistItem[];
  recommendations: string[];
}
