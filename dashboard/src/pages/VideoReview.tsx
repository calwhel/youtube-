import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Globe, Loader2, Upload } from "lucide-react";

import { api, type VideoReviewView } from "../lib/api";
import {
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";
import { formatCurrency } from "../lib/utils";

export function VideoReviewPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoReviewView | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (videoId) {
      void load(videoId);
    }
  }, [videoId]);

  async function load(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await api.getVideo(id);
      setVideo(res.video);
      setTitle(res.video.title ?? "");
      setDescription(res.video.description ?? "");
      setTagsText(res.video.tags.join(", "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setLoading(false);
    }
  }

  function parseTags(): string[] {
    return tagsText
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handlePublish() {
    if (!videoId || !video) return;
    setPublishing(true);
    setError("");
    setSuccess("");
    try {
      const tags = parseTags();
      await api.updateVideo(videoId, { title, description, tags });
      await api.publish(videoId, { title, description, tags });
      setSuccess("Published! Video is now live on YouTube with description, tags, and engagement.");
      setTimeout(() => navigate("/review"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner label="Loading video for review..." />
      </Layout>
    );
  }

  if (!video) {
    return (
      <Layout>
        <ErrorBanner message={error || "Video not found"} />
        <Link to="/review" className="btn-secondary mt-4 inline-flex">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Review & Publish"
        description={video.channel_name}
        action={
          <Link to="/review" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Queue
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            {video.preview_video_url ? (
              <div className="relative aspect-video w-full bg-black">
                <video
                  controls
                  playsInline
                  className="absolute inset-0 h-full w-full"
                  src={video.preview_video_url}
                />
              </div>
            ) : video.youtube_embed_url ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  title="Video preview"
                  src={`${video.youtube_embed_url}?rel=0`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              video.thumbnail_url && (
                <img
                  src={video.thumbnail_url}
                  alt="Thumbnail"
                  className="aspect-video w-full object-cover"
                />
              )
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {video.preview_only && (
              <span className="badge-warning">Preview only — not on YouTube</span>
            )}
            {video.quality_score !== null && (
              <span className="badge-success">Quality {Math.round(video.quality_score)}</span>
            )}
            {video.thumbnail_uploaded && (
              <span className="badge-success">Thumbnail uploaded</span>
            )}
            <span className="badge-neutral">Cost {formatCurrency(video.cost_usd)}</span>
            {video.thumbnail_text && (
              <span className="badge-warning">Thumb: {video.thumbnail_text}</span>
            )}
          </div>

          {video.quality_notes && (
            <p className="text-xs text-zinc-500">{video.quality_notes}</p>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5 shadow-card space-y-4">
            <h3 className="font-display font-semibold">
              {video.preview_only ? "Preview details" : "Publish settings"}
            </h3>
            <p className="text-xs text-zinc-500">
              {video.preview_only
                ? "Check title, description, and tags. When quality is good, go to Create, uncheck preview mode, and generate again to upload to YouTube."
                : "Edit before publishing. This updates YouTube title, description, hashtags, then goes public with pinned comment + playlist."}
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Title</label>
              <input
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Description</label>
              <textarea
                className="input-field min-h-[160px] resize-y font-mono text-xs leading-relaxed"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Tags / hashtags (comma separated)
              </label>
              <textarea
                className="input-field min-h-[80px] resize-y text-sm"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="finance, money tips, passive income"
              />
            </div>

            {video.pinned_comment_text && (
              <div className="rounded-xl bg-surface-overlay/60 p-3 text-xs text-zinc-400">
                <p className="mb-1 font-medium text-zinc-300">Pinned comment on publish:</p>
                {video.pinned_comment_text}
              </div>
            )}

            <button
              onClick={() => void handlePublish()}
              disabled={publishing || video.status === "published" || video.preview_only}
              className="btn-primary w-full"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
                </>
              ) : video.preview_only ? (
                "Upload to YouTube from Create (disable preview mode)"
              ) : video.status === "published" ? (
                "Already published"
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Publish to YouTube
                </>
              )}
            </button>

            {video.youtube_watch_url && (
              <a
                href={video.youtube_watch_url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary w-full"
              >
                <Globe className="h-4 w-4" /> Open on YouTube
              </a>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
