CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche_prompt TEXT NOT NULL,
  youtube_client_id TEXT NOT NULL,
  youtube_client_secret TEXT NOT NULL,
  youtube_refresh_token TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  creatomate_template_id TEXT NOT NULL,
  upload_frequency TEXT NOT NULL DEFAULT '0 14 * * *',
  monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused')),
  target_duration_minutes INTEGER NOT NULL DEFAULT 10,
  audience_level TEXT NOT NULL DEFAULT 'general',
  title_style TEXT NOT NULL DEFAULT 'curiosity',
  auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
  youtube_category_id TEXT NOT NULL DEFAULT '28',
  creatomate_thumbnail_template_id TEXT,
  require_thumbnail BOOLEAN NOT NULL DEFAULT TRUE,
  auto_generate_shorts BOOLEAN NOT NULL DEFAULT TRUE,
  enable_ab_thumbnails BOOLEAN NOT NULL DEFAULT TRUE,
  enable_engagement BOOLEAN NOT NULL DEFAULT TRUE,
  default_playlist_id TEXT,
  creatomate_template_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_mode TEXT NOT NULL DEFAULT 'required' CHECK (review_mode IN ('required', 'optional')),
  manual_publish_count INTEGER NOT NULL DEFAULT 0,
  min_manual_publishes_before_auto INTEGER NOT NULL DEFAULT 5,
  max_videos_per_week INTEGER NOT NULL DEFAULT 3,
  disclose_synthetic_media BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  topic TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (
    status IN ('processing', 'private', 'published', 'failed')
  ),
  youtube_video_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cost_usd NUMERIC(10, 4) DEFAULT 0,
  view_count BIGINT DEFAULT 0,
  ctr NUMERIC(8, 4) DEFAULT 0,
  avg_view_duration_seconds NUMERIC(10, 2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  analytics_synced_at TIMESTAMPTZ,
  thumbnail_uploaded BOOLEAN DEFAULT FALSE,
  quality_score NUMERIC(5, 2),
  quality_notes TEXT,
  video_type TEXT NOT NULL DEFAULT 'long' CHECK (video_type IN ('long', 'short')),
  parent_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  clip_start_seconds NUMERIC(8, 2),
  clip_duration_seconds NUMERIC(8, 2),
  thumbnail_variant TEXT NOT NULL DEFAULT 'A' CHECK (thumbnail_variant IN ('A', 'B')),
  thumbnail_b_text TEXT,
  thumbnail_b_prompt TEXT,
  thumbnail_swapped_at TIMESTAMPTZ,
  short_youtube_video_id TEXT,
  pinned_comment_text TEXT,
  engagement_applied BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_comment_id TEXT,
  unique_thesis TEXT,
  authenticity_score NUMERIC(5, 2),
  inauthenticity_risk_score NUMERIC(5, 2),
  creatomate_template_used TEXT,
  sources_cited JSONB,
  description TEXT,
  tags JSONB,
  thumbnail_text TEXT,
  short_title TEXT,
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS topics_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  topic_hash TEXT NOT NULL,
  topic_text TEXT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, topic_hash)
);

CREATE TABLE IF NOT EXISTS channel_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  subs_count BIGINT DEFAULT 0,
  watch_hours_total NUMERIC(12, 2) DEFAULT 0,
  monetization_eligible BOOLEAN DEFAULT FALSE,
  monetization_alert_sent BOOLEAN DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_channel_created ON videos(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_topics_used_channel_id ON topics_used(channel_id);
