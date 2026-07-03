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
  scenes: VideoScene[];
  chapters?: VideoChapter[];
}

export type VideoStatus = "processing" | "private" | "published" | "failed";

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
  published_at: Date | null;
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
