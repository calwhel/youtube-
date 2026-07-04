export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export interface SessionResponse {
  ok: true;
  database: "connected" | "disconnected";
  database_error?: string;
  channels: Array<{ id: string; name: string }>;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(
      (data.error as string) || `Request failed (${response.status})`,
      response.status,
    );
  }

  return data as T;
}

export interface HealthResponse {
  status: string;
  runningPipelines: number;
  runningChannelIds?: string[];
  timestamp: string;
}

export interface Channel {
  id: string;
  name: string;
  niche_prompt: string;
  youtube_client_id: string;
  status: "active" | "paused";
  upload_frequency: string;
  monthly_budget_usd: number;
  target_duration_minutes: number;
  auto_publish: boolean;
  review_mode: string;
  manual_publish_count: number;
  min_manual_publishes_before_auto: number;
  max_videos_per_week: number;
  stats: {
    subs_count: number;
    watch_hours_total: number;
    monetization_eligible: boolean;
    last_checked_at: string | null;
  } | null;
}

export interface PendingVideo {
  id: string;
  channel_id: string;
  channel_name: string;
  topic: string | null;
  title: string | null;
  status: string;
  youtube_video_id: string | null;
  created_at: string;
  cost_usd: number;
  quality_score: number | null;
  short_youtube_video_id: string | null;
  thumbnail_uploaded: boolean;
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
  status: string;
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

export interface CreateChannelPayload {
  name: string;
  niche_prompt: string;
  youtube_client_id: string;
  youtube_client_secret: string;
  youtube_refresh_token: string;
  elevenlabs_voice_id: string;
  creatomate_template_id: string;
  creatomate_template_ids?: string[];
  upload_frequency?: string;
  status?: "active" | "paused";
}

export interface YppChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface YppReport {
  channel_id: string;
  channel_name: string;
  readiness_score: number;
  ready_to_apply: boolean;
  subs_count: number;
  watch_hours_total: number;
  monetization_eligible: boolean;
  manual_publish_count: number;
  videos_this_week: number;
  max_videos_per_week: number;
  auto_publish_allowed: boolean;
  checklist: YppChecklistItem[];
  recommendations: string[];
}

export interface CostRow {
  channel_id: string;
  channel_name: string;
  month: string;
  total_cost_usd: number;
  video_count: number;
}

export interface VideoActivity {
  id: string;
  channel_id: string;
  channel_name: string;
  topic: string | null;
  title: string | null;
  status: "processing" | "private" | "published" | "failed";
  created_at: string;
  quality_notes: string | null;
}

export interface PipelineConfigResult {
  skip_youtube_upload_default: boolean;
}

export interface PipelineStartResult {
  success: boolean;
  status: "started" | "running";
  channel_id: string;
  skip_youtube?: boolean;
  message?: string;
  error?: string;
}

export interface PipelineStatusResult {
  running_count: number;
  running_channel_ids: string[];
}

export const api = {
  session: () => request<SessionResponse>("/api/auth/session"),

  login: (token: string) =>
    request<SessionResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  logout: () =>
    request<{ ok: true }>("/api/auth/logout", {
      method: "POST",
    }),

  health: () => request<HealthResponse>("/health"),

  channels: () =>
    request<{ channels: Channel[] }>("/api/channels"),

  createChannel: (payload: CreateChannelPayload) =>
    request<{ channel: Channel }>("/api/channels", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        creatomate_template_ids: payload.creatomate_template_ids ?? [
          payload.creatomate_template_id,
        ],
        auto_publish: false,
        review_mode: "required",
        max_videos_per_week: 3,
        disclose_synthetic_media: true,
      }),
    }),

  getVideo: (videoId: string) =>
    request<{ video: VideoReviewView }>(`/api/videos/${videoId}`),

  updateVideo: (
    videoId: string,
    data: { title?: string; description?: string; tags?: string[] },
  ) =>
    request<{ video: VideoReviewView }>(`/api/videos/${videoId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  pending: () =>
    request<{ videos: PendingVideo[] }>("/api/pending"),

  costs: () => request<{ costs: CostRow[] }>("/api/costs"),

  monetization: () =>
    request<{
      channels: Array<{
        channel_id: string;
        channel_name: string;
        subs_count: number;
        watch_hours_total: number;
        monetization_eligible: boolean;
      }>;
    }>("/api/monetization"),

  readiness: () =>
    request<{ channels: YppReport[] }>("/api/monetization/readiness"),

  pipelineConfig: () =>
    request<PipelineConfigResult>("/api/pipeline/config"),

  pipelineStatus: () =>
    request<PipelineStatusResult>("/api/pipeline/status"),

  videoActivity: (channelId?: string) =>
    request<{
      activity: VideoActivity[];
      last_error: { message: string; at: string } | null;
    }>(
      channelId
        ? `/api/videos/activity?channel_id=${encodeURIComponent(channelId)}`
        : "/api/videos/activity",
    ),

  runPipeline: (channelId: string, topic?: string, skipYoutube?: boolean) =>
    request<PipelineStartResult>("/api/run-pipeline", {
      method: "POST",
      body: JSON.stringify({
        channel_id: channelId,
        topic,
        skip_youtube: skipYoutube,
      }),
    }),

  publish: (videoId: string, data?: { description?: string; tags?: string[]; title?: string }) =>
    request<{ success: boolean }>(`/api/publish/${videoId}`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  syncAnalytics: () =>
    request<{ success: boolean; videosUpdated: number }>(
      "/api/analytics/sync",
      { method: "POST" },
    ),

  evaluateThumbnails: () =>
    request<{ success: boolean; swapped: number; evaluated: number }>(
      "/api/thumbnails/ab-evaluate",
      { method: "POST" },
    ),

  youtubeOAuthConfig: () =>
    request<{ redirect_uri: string; public_base_url: string }>(
      "/api/youtube/oauth/config",
    ),

  youtubeOAuthStart: (
    clientId: string,
    clientSecret: string,
    options?: { returnPath?: string; channelId?: string },
  ) =>
    request<{ auth_url: string; state: string }>("/api/youtube/oauth/start", {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        return_path: options?.returnPath,
        channel_id: options?.channelId,
      }),
    }),

  youtubeOAuthToken: (state: string) =>
    request<{
      refresh_token: string;
      client_id: string;
      client_secret: string;
      channel_id: string | null;
      return_path: string;
    }>(`/api/youtube/oauth/token?state=${encodeURIComponent(state)}`),

  updateChannel: (
    channelId: string,
    payload: Partial<CreateChannelPayload>,
  ) =>
    request<{ channel: Channel }>(`/api/channels/${channelId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  channelYoutubeStatus: (channelId: string) =>
    request<{
      ok: boolean;
      connected: boolean;
      channel_title?: string | null;
      error?: string;
    }>(`/api/channels/${channelId}/youtube-status`),
};
