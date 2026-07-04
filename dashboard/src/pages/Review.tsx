import { useEffect, useState } from "react";
import {
  ExternalLink,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";

import { api, type PendingVideo } from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";
import {
  formatCurrency,
  formatDate,
  youtubeStudioUrl,
  youtubeWatchUrl,
} from "../lib/utils";

export function ReviewPage() {
  const [videos, setVideos] = useState<PendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.pending();
      setVideos(res.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(videoId: string) {
    setPublishing(videoId);
    setError("");
    setSuccess("");
    try {
      await api.publish(videoId);
      setSuccess("Video published successfully!");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(null);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Review Queue"
        description="Preview private uploads in YouTube Studio, then publish when ready"
        action={
          <button onClick={() => void load()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {loading ? (
        <LoadingSpinner label="Loading review queue..." />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing to review"
          description="When the pipeline generates a video, it appears here as a private upload waiting for your approval."
        />
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <article
              key={video.id}
              className="glass glass-hover rounded-2xl p-6 shadow-card animate-slide-up"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="badge-warning">{video.status}</span>
                    <span className="badge-neutral">{video.channel_name}</span>
                    {video.quality_score !== null && (
                      <span className="badge-success">
                        Quality {Math.round(video.quality_score)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {video.title ?? video.topic ?? "Untitled Video"}
                  </h3>
                  {video.topic && video.title && (
                    <p className="mt-1 text-sm text-zinc-500">{video.topic}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                    <span>Created {formatDate(video.created_at)}</span>
                    <span>Cost {formatCurrency(video.cost_usd)}</span>
                    {video.thumbnail_uploaded && (
                      <span className="text-emerald-400">Thumbnail uploaded</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {video.youtube_video_id && (
                    <>
                      <a
                        href={youtubeStudioUrl(video.youtube_video_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <ExternalLink className="h-4 w-4" /> Studio
                      </a>
                      <a
                        href={youtubeWatchUrl(video.youtube_video_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <Play className="h-4 w-4" /> Preview
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => void handlePublish(video.id)}
                    disabled={publishing === video.id}
                    className="btn-primary"
                  >
                    <Upload className="h-4 w-4" />
                    {publishing === video.id ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </div>

              {video.short_youtube_video_id && (
                <div className="mt-4 rounded-xl bg-surface-overlay/50 px-4 py-3 text-sm text-zinc-400">
                  Short also uploaded —{" "}
                  <a
                    href={youtubeWatchUrl(video.short_youtube_video_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    view short
                  </a>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
