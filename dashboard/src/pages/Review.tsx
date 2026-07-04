import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, PlayCircle, RefreshCw, Sparkles } from "lucide-react";

import { api, type PendingVideo, type VideoActivity } from "../lib/api";
import { formatPipelineError, isYouTubeAuthError } from "../lib/errors";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
} from "../components/Layout";
import { formatCurrency, formatDate } from "../lib/utils";

export function ReviewPage() {
  const [videos, setVideos] = useState<PendingVideo[]>([]);
  const [processing, setProcessing] = useState<VideoActivity[]>([]);
  const [failed, setFailed] = useState<VideoActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (processing.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void load({ quiet: true });
    }, 10000);

    return () => window.clearInterval(interval);
  }, [processing.length]);

  async function load(options?: { quiet?: boolean }) {
    if (!options?.quiet) {
      setLoading(true);
    }
    setError("");
    try {
      const res = await api.reviewQueue();
      setVideos(res.ready);
      setProcessing(res.processing);
      setFailed(res.failed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      if (!options?.quiet) {
        setLoading(false);
      }
    }
  }

  const isEmpty =
    videos.length === 0 && processing.length === 0 && failed.length === 0;

  return (
    <Layout>
      <PageHeader
        title="Review Queue"
        description="Watch previews here — no YouTube needed while testing quality"
        action={
          <button onClick={() => void load()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner label="Loading review queue..." />
      ) : isEmpty ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing to review yet"
          description="Generate a preview from Create — it takes 5–10 minutes, then appears here automatically."
          action={
            <Link to="/generate" className="btn-primary">
              <Sparkles className="h-4 w-4" /> Generate Preview
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {processing.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-sm font-semibold text-brand">
                Generating now
              </h2>
              {processing.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 text-sm"
                >
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />
                  <div>
                    <p className="font-medium">
                      {item.title ?? item.topic ?? "Creating video..."}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {item.channel_name} · started {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-zinc-500">
                This page refreshes every 10 seconds while a video is generating.
              </p>
            </div>
          )}

          {failed.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-sm font-semibold text-red-300">
                Failed attempts
              </h2>
              {failed.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm"
                >
                  <p className="font-medium">{item.title ?? item.topic ?? "Untitled"}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.channel_name}</p>
                  <p className="mt-2 text-xs text-red-200">
                    {formatPipelineError(
                      item.quality_notes ??
                        "Generation failed — check Railway variables (ANTHROPIC_MODEL, API keys).",
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isYouTubeAuthError(item.quality_notes ?? "") && (
                      <Link to="/channels" className="btn-primary inline-flex text-xs">
                        Reconnect YouTube
                      </Link>
                    )}
                    <Link to="/generate" className="btn-secondary inline-flex text-xs">
                      Try again on Create
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {videos.length > 0 && (
            <div className="space-y-3">
              {processing.length > 0 || failed.length > 0 ? (
                <h2 className="font-display text-sm font-semibold text-emerald-300">
                  Ready to watch
                </h2>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                {videos.map((video) => (
                  <Link
                    key={video.id}
                    to={`/review/${video.id}`}
                    className="glass glass-hover block rounded-2xl p-5 shadow-card animate-slide-up"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="badge-warning">
                        {video.preview_only ? "Preview" : "Ready"}
                      </span>
                      <span className="badge-neutral">{video.channel_name}</span>
                      {video.preview_only && video.preview_available === false && (
                        <span className="badge-neutral">File expired — regenerate</span>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-semibold line-clamp-2">
                      {video.title ?? video.topic ?? "Untitled"}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatDate(video.created_at)} · {formatCurrency(video.cost_usd)}
                      {video.quality_score !== null &&
                        ` · Quality ${Math.round(video.quality_score)}`}
                    </p>
                    <span className="btn-primary mt-4 inline-flex w-full justify-center sm:w-auto">
                      <PlayCircle className="h-4 w-4" /> Watch & Review
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
