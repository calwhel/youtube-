-- Idempotent migrations for existing deployments

-- Week 1 growth columns
ALTER TABLE channels ADD COLUMN IF NOT EXISTS target_duration_minutes INTEGER NOT NULL DEFAULT 10;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS audience_level TEXT NOT NULL DEFAULT 'general';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS title_style TEXT NOT NULL DEFAULT 'curiosity';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS youtube_category_id TEXT NOT NULL DEFAULT '28';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS creatomate_thumbnail_template_id TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS require_thumbnail BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS ctr NUMERIC(8, 4) DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS avg_view_duration_seconds NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS impressions BIGINT DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analytics_synced_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_uploaded BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5, 2);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS quality_notes TEXT;

-- Week 2 upgrades
ALTER TABLE channels ADD COLUMN IF NOT EXISTS auto_generate_shorts BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS enable_ab_thumbnails BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS enable_engagement BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS default_playlist_id TEXT;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_type TEXT NOT NULL DEFAULT 'long';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS parent_video_id UUID REFERENCES videos(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS clip_start_seconds NUMERIC(8, 2);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS clip_duration_seconds NUMERIC(8, 2);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_variant TEXT NOT NULL DEFAULT 'A';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_b_text TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_b_prompt TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_swapped_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS short_youtube_video_id TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS pinned_comment_text TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS engagement_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS pinned_comment_id TEXT;

ALTER TABLE channel_stats ADD COLUMN IF NOT EXISTS monetization_alert_sent BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_videos_parent_video_id ON videos(parent_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_video_type ON videos(video_type);
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_ab ON videos(thumbnail_variant, published_at)
  WHERE video_type = 'long' AND status = 'published';

-- Week 3 authenticity layer
ALTER TABLE channels ADD COLUMN IF NOT EXISTS creatomate_template_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS review_mode TEXT NOT NULL DEFAULT 'required';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS manual_publish_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS min_manual_publishes_before_auto INTEGER NOT NULL DEFAULT 5;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS max_videos_per_week INTEGER NOT NULL DEFAULT 3;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS disclose_synthetic_media BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS unique_thesis TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS authenticity_score NUMERIC(5, 2);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS inauthenticity_risk_score NUMERIC(5, 2);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS creatomate_template_used TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS sources_cited JSONB;

-- Review metadata for in-app publish workflow
ALTER TABLE videos ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tags JSONB;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_text TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS short_title TEXT;
