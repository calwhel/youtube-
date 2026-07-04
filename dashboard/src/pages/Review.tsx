import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlayCircle, RefreshCw, Sparkles } from "lucide-react";

import { api, type PendingVideo } from "../lib/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <Layout>
      <PageHeader
        title="Review Queue"
        description="Watch, edit description & tags, then publish — all in the app"
        action={
          <button onClick={() => void load()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner label="Loading review queue..." />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing to review"
          description="Generate a video from the Create tab. It appears here when ready."
          action={
            <Link to="/generate" className="btn-primary">
              <Sparkles className="h-4 w-4" /> Generate Video
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {videos.map((video) => (
            <Link
              key={video.id}
              to={`/review/${video.id}`}
              className="glass glass-hover block rounded-2xl p-5 shadow-card animate-slide-up"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="badge-warning">Ready</span>
                <span className="badge-neutral">{video.channel_name}</span>
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
                <PlayCircle className="h-4 w-4" /> Review & Publish
              </span>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
