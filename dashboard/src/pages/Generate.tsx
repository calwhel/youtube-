import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { api, type Channel, type PipelineResult } from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";
import { formatCurrency } from "../lib/utils";

export function GeneratePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PipelineResult["result"] | null>(null);

  useEffect(() => {
    void loadChannels();
  }, []);

  async function loadChannels() {
    setLoading(true);
    try {
      const res = await api.channels();
      setChannels(res.channels.filter((c) => c.status === "active"));
      if (res.channels[0]) {
        setChannelId(res.channels[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!channelId) return;

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const res = await api.runPipeline(
        channelId,
        topic.trim() || undefined,
      );
      if (!res.success || !res.result) {
        throw new Error(res.error ?? "Pipeline failed");
      }
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  }

  const selected = channels.find((c) => c.id === channelId);

  return (
    <Layout>
      <PageHeader
        title="Generate Video"
        description="Run the full pipeline — research, script, voice, video, upload"
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No active channels"
          description="Register a channel with npm run setup before generating videos."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <form
            onSubmit={handleGenerate}
            className="glass rounded-2xl p-6 shadow-card lg:col-span-2"
          >
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Channel
              </label>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="input-field"
                disabled={running}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Topic{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Leave blank for AI topic research"
                className="input-field"
                disabled={running}
              />
            </div>

            <button
              type="submit"
              disabled={running}
              className="btn-primary w-full"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating... (2–10 min)
                </>
              ) : (
                <>
                  <Clapperboard className="h-4 w-4" />
                  Start Pipeline
                </>
              )}
            </button>

            {running && (
              <p className="mt-4 text-center text-xs text-zinc-500 animate-pulse-soft">
                Researching topic → writing script → voice → video → uploading...
              </p>
            )}
          </form>

          <div className="lg:col-span-3 space-y-4">
            {selected && (
              <div className="glass rounded-2xl p-6 shadow-card">
                <h3 className="font-display font-semibold">{selected.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400 line-clamp-3">
                  {selected.niche_prompt}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-surface-overlay/60 p-3">
                    <p className="text-zinc-500">Duration target</p>
                    <p className="mt-1 font-medium">
                      {selected.target_duration_minutes} min
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-overlay/60 p-3">
                    <p className="text-zinc-500">Weekly limit</p>
                    <p className="mt-1 font-medium">
                      {selected.max_videos_per_week || "∞"} videos
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-overlay/60 p-3">
                    <p className="text-zinc-500">Auto publish</p>
                    <p className="mt-1 font-medium">
                      {selected.auto_publish ? "On" : "Off"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-overlay/60 p-3">
                    <p className="text-zinc-500">Manual publishes</p>
                    <p className="mt-1 font-medium">
                      {selected.manual_publish_count} /{" "}
                      {selected.min_manual_publishes_before_auto}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="glass rounded-2xl p-6 shadow-card animate-slide-up">
                <SuccessBanner message="Video generated successfully!" />
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold">
                      {result.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">{result.topic}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-lg bg-surface-overlay px-3 py-1.5 text-zinc-300">
                        Cost {formatCurrency(result.costUsd)}
                      </span>
                      {result.qualityScore !== null && (
                        <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-400">
                          Quality {Math.round(result.qualityScore)}
                        </span>
                      )}
                      <span
                        className={
                          result.autoPublished
                            ? "badge-success"
                            : "badge-warning"
                        }
                      >
                        {result.autoPublished ? "Auto-published" : "Needs review"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={result.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <ExternalLink className="h-4 w-4" /> View on YouTube
                      </a>
                      {result.shortVideoUrl && (
                        <a
                          href={result.shortVideoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                        >
                          <ExternalLink className="h-4 w-4" /> View Short
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
