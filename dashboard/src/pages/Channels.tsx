import { useEffect, useState } from "react";
import { Copy, Film } from "lucide-react";

import { api, type Channel } from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
} from "../components/Layout";
import { formatNumber } from "../lib/utils";

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.channels();
      setChannels(res.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }

  function copyId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Layout>
      <PageHeader
        title="Channels"
        description="Your registered YouTube channels and their settings"
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No channels registered"
          description="Run npm run setup on your computer to add your first channel to the database."
        />
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => (
            <article
              key={channel.id}
              className="glass glass-hover rounded-2xl p-6 shadow-card animate-slide-up"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">
                      {channel.name}
                    </h3>
                    <span
                      className={
                        channel.status === "active"
                          ? "badge-success"
                          : "badge-neutral"
                      }
                    >
                      {channel.status}
                    </span>
                    {channel.review_mode === "required" && (
                      <span className="badge-warning">Review required</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    {channel.niche_prompt}
                  </p>
                  <button
                    onClick={() => copyId(channel.id)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === channel.id ? "Copied!" : channel.id}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-96">
                  <Metric
                    label="Subscribers"
                    value={formatNumber(channel.stats?.subs_count ?? 0)}
                  />
                  <Metric
                    label="Watch hours"
                    value={formatNumber(
                      Math.round(channel.stats?.watch_hours_total ?? 0),
                    )}
                  />
                  <Metric
                    label="Manual publishes"
                    value={String(channel.manual_publish_count)}
                  />
                  <Metric
                    label="Budget/mo"
                    value={`$${channel.monthly_budget_usd}`}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-surface-border/60 pt-5">
                <Tag label={`${channel.target_duration_minutes}min videos`} />
                <Tag label={`Schedule: ${channel.upload_frequency}`} />
                <Tag
                  label={
                    channel.auto_publish ? "Auto-publish on" : "Auto-publish off"
                  }
                />
                <Tag label={`${channel.max_videos_per_week}/week max`} />
                {channel.stats?.monetization_eligible && (
                  <span className="badge-success">YPP eligible</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-overlay/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-lg bg-surface-overlay px-2.5 py-1 text-xs text-zinc-400">
      {label}
    </span>
  );
}
