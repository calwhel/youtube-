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
  created_at: Date;
}

export interface ChannelStatsRecord {
  id: string;
  channel_id: string;
  subs_count: string;
  watch_hours_total: string;
  monetization_eligible: boolean;
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
  created_at: string;
  stats: {
    subs_count: number;
    watch_hours_total: number;
    monetization_eligible: boolean;
    last_checked_at: string | null;
  } | null;
}

export interface ContentSettings {
  targetDurationMinutes: number;
  audienceLevel: AudienceLevel;
  titleStyle: TitleStyle;
  autoPublish: boolean;
  requireThumbnail: boolean;
}
