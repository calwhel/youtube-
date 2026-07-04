import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Eye, Loader2 } from "lucide-react";

import { api, type Channel } from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";

export function GeneratePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [backgroundRunning, setBackgroundRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadChannels();
  }, []);

  useEffect(() => {
    if (!backgroundRunning || !channelId) {
      return;
    }

    const interval = window.setInterval(() => {
      void checkPipelineStatus();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [backgroundRunning, channelId]);

  async function loadChannels() {
    setLoading(true);
    setError("");
    try {
      const [channelsRes, statusRes] = await Promise.all([
        api.channels(),
        api.pipelineStatus(),
      ]);
      const active = channelsRes.channels.filter((c) => c.status === "active");
      setChannels(active);
      const id = channelId || active[0]?.id || "";
      if (!channelId && active[0]) {
        setChannelId(active[0].id);
      }
      if (id && statusRes.running_channel_ids.includes(id)) {
        setBackgroundRunning(true);
        setSuccess(
          "Video is still generating in the background. You can close this app — check Review in a few minutes.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setError(
        message === "Load failed" || message === "Failed to fetch"
          ? "Connection lost. Pull down to refresh or reopen the app."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkPipelineStatus() {
    try {
      const status = await api.pipelineStatus();
      if (!status.running_channel_ids.includes(channelId)) {
        setBackgroundRunning(false);
        setSuccess(
          "Generation finished (or stopped). Open Review to watch and publish your video.",
        );
      }
    } catch {
      // Ignore polling errors — server may still be working
    }
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!channelId) return;

    setStarting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.runPipeline(
        channelId,
        topic.trim() || undefined,
      );
      if (!res.success) {
        throw new Error(res.error ?? "Could not start pipeline");
      }
      setBackgroundRunning(true);
      setSuccess(
        res.message ??
          "Video is generating in the background. Close the app if you want — check Review in 5–10 minutes.",
      );
    } catch (err) {
      let message = err instanceof Error ? err.message : "Generation failed";
      if (message.includes("already running")) {
        setBackgroundRunning(true);
        setSuccess(
          "Already creating a video for this channel. Check Review in a few minutes.",
        );
        message = "";
      } else if (message.includes("claude-3-5-sonnet") || message.includes("not_found_error")) {
        message =
          "AI model outdated. In Railway → Variables, set ANTHROPIC_MODEL to claude-sonnet-4-6, redeploy, then try again.";
      } else if (message === "Load failed" || message === "Failed to fetch") {
        message =
          "Connection dropped — but generation may still be running on the server. Check Review in 5–10 minutes.";
        setBackgroundRunning(true);
      }
      if (message) {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  }

  const selected = channels.find((c) => c.id === channelId);
  const busy = starting || backgroundRunning;

  return (
    <Layout>
      <PageHeader
        title="Generate Video"
        description="Runs in the background — safe to leave the app"
      />

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {loading ? (
        <LoadingSpinner />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No active channels"
          description="Connect your YouTube channel first."
          action={
            <Link to="/setup" className="btn-primary">
              Connect channel
            </Link>
          }
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
                disabled={busy}
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
                disabled={busy}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : backgroundRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating in background...
                </>
              ) : (
                <>
                  <Clapperboard className="h-4 w-4" />
                  Start Pipeline
                </>
              )}
            </button>

            {backgroundRunning && (
              <div className="mt-4 space-y-3 text-center">
                <p className="text-xs text-zinc-500">
                  Research → script → voice → video → upload (5–10 min). You can
                  switch apps or lock your phone.
                </p>
                <Link to="/review" className="btn-secondary inline-flex w-full justify-center">
                  <Eye className="h-4 w-4" /> Open Review queue
                </Link>
              </div>
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
          </div>
        </div>
      )}
    </Layout>
  );
}
