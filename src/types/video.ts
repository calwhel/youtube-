export interface VideoScene {
  voiceover_text: string;
  visual_prompt: string;
  overlay_text: string;
  duration_seconds?: number;
}

export interface VideoChapter {
  timestamp: string;
  title: string;
}

export interface VideoPayload {
  topic: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail_prompt: string;
  thumbnail_text: string;
  thumbnail_b_prompt: string;
  thumbnail_b_text: string;
  short_title: string;
  pinned_comment: string;
  unique_thesis: string;
  contrarian_angle: string;
  creator_perspective: string;
  specific_examples: string[];
  sources_cited: string[];
  scenes: VideoScene[];
  chapters?: VideoChapter[];
}

export type VideoStatus = "processing" | "private" | "published" | "failed";
export type VideoType = "long" | "short";
export type ThumbnailVariant = "A" | "B";

export interface VideoRecord {
  id: string;
  channel_id: string;
  topic: string | null;
  title: string | null;
  status: VideoStatus;
  youtube_video_id: string | null;
  created_at: Date;
  cost_usd: string;
  view_count: string;
  ctr: string;
  avg_view_duration_seconds: string;
  impressions: string;
  analytics_synced_at: Date | null;
  thumbnail_uploaded: boolean;
  quality_score: string | null;
  quality_notes: string | null;
  video_type: VideoType;
  parent_video_id: string | null;
  clip_start_seconds: string | null;
  clip_duration_seconds: string | null;
  thumbnail_variant: ThumbnailVariant;
  thumbnail_b_text: string | null;
  thumbnail_b_prompt: string | null;
  thumbnail_swapped_at: Date | null;
  short_youtube_video_id: string | null;
  engagement_applied: boolean;
  pinned_comment_id: string | null;
  pinned_comment_text: string | null;
  unique_thesis: string | null;
  authenticity_score: string | null;
  inauthenticity_risk_score: string | null;
  creatomate_template_used: string | null;
  sources_cited: string[] | unknown;
  description: string | null;
  tags: string[] | unknown;
  thumbnail_text: string | null;
  short_title: string | null;
  published_at: Date | null;
}

export interface VideoReviewView {
  id: string;
  channel_id: string;
  channel_name: string;
  topic: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  thumbnail_text: string | null;
  pinned_comment_text: string | null;
  status: VideoStatus;
  youtube_video_id: string | null;
  short_youtube_video_id: string | null;
  youtube_embed_url: string | null;
  youtube_watch_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  cost_usd: number;
  quality_score: number | null;
  quality_notes: string | null;
  authenticity_score: number | null;
  inauthenticity_risk_score: number | null;
  thumbnail_uploaded: boolean;
  unique_thesis: string | null;
  preview_only: boolean;
  preview_video_url: string | null;
}

export interface PendingVideoView {
  id: string;
  channel_id: string;
  channel_name: string;
  topic: string | null;
  title: string | null;
  status: VideoStatus;
  youtube_video_id: string | null;
  created_at: string;
  cost_usd: number;
  view_count: number;
  ctr: number;
  thumbnail_uploaded: boolean;
  quality_score: number | null;
  short_youtube_video_id: string | null;
}

export interface PipelineResult {
  videoId: string;
  videoUrl: string;
  title: string;
  topic: string;
  privacyStatus: string;
  dbVideoId: string;
  costUsd: number;
  thumbnailUploaded: boolean;
  autoPublished: boolean;
  qualityScore: number | null;
  qualityNotes: string | null;
  authenticityScore: number | null;
  inauthenticityRisk: number | null;
  shortVideoId: string | null;
  shortVideoUrl: string | null;
  thumbnailVariant: ThumbnailVariant;
  engagementApplied: boolean;
}

export interface CostSummaryRow {
  channel_id: string;
  channel_name: string;
  month: string;
  total_cost_usd: number;
  video_count: number;
}

export interface VideoAnalyticsUpdate {
  view_count: number;
  ctr: number;
  avg_view_duration_seconds: number;
  impressions: number;
}

export interface TopPerformingTopic {
  topic: string;
  view_count: number;
  ctr: number;
}

export interface QualityGateResult {
  passed: boolean;
  score: number;
  notes: string[];
}

export interface AuthenticityGateResult {
  passed: boolean;
  authenticityScore: number;
  inauthenticityRisk: number;
  notes: string[];
}

export interface SceneAudioSegment {
  sceneIndex: number;
  filePath: string;
  durationSeconds: number;
}

export interface TopicCandidate {
  topic: string;
  score: number;
  rationale: string;
  searchIntent: string;
}

export interface ThumbnailVariants {
  variantAPath: string;
  variantBPath: string;
}

export interface ShortClipPlan {
  startSeconds: number;
  durationSeconds: number;
  title: string;
}

export interface ShortUploadResult {
  videoId: string;
  videoUrl: string;
}
