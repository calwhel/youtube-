import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clapperboard,
  ListChecks,
  Radio,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  api,
  type Channel,
  type HealthResponse,
  type PendingVideo,
} from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
  StatCard,
} from "../components/Layout";
import { formatCurrency, formatNumber } from "../lib/utils";

export function OverviewPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [pending, setPending] = useState<PendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [healthRes, channelsRes, pendingRes] = await Promise.all([
        api.health(),
        api.channels(),
        api.pending(),
      ]);
      setHealth(healthRes);
      setChannels(channelsRes.channels);
      setPending(pendingRes.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  const totalSubs = channels.reduce(
    (sum, c) => sum + (c.stats?.subs_count ?? 0),
    0,
  );
  const totalWatchHours = channels.reduce(
    (sum, c) => sum + (c.stats?.watch_hours_total ?? 0),
    0,
  );

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner label="Loading dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Overview"
        description="Your YouTube pipeline at a glance"
        action={
          <button onClick={() => void load()} className="btn-secondary">
            Refresh
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="System Status"
          value={health?.status === "ok" ? "Online" : "Offline"}
          sub={`${health?.runningPipelines ?? 0} pipelines running`}
          icon={Radio}
          accent="emerald"
        />
        <StatCard
          label="Pending Review"
          value={pending.length}
          sub="Videos awaiting publish"
          icon={ListChecks}
          accent="amber"
        />
        <StatCard
          label="Subscribers"
          value={formatNumber(totalSubs)}
          sub="Across all channels"
          icon={Users}
          accent="accent"
        />
        <StatCard
          label="Watch Hours"
          value={formatNumber(Math.round(totalWatchHours))}
          sub="Total tracked"
          icon={TrendingUp}
          accent="brand"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Review Queue</h2>
            <Link to="/review" className="btn-ghost text-xs">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {pending.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="All caught up"
              description="No videos waiting for review. Generate a new one to get started."
              action={
                <Link to="/generate" className="btn-primary">
                  <Clapperboard className="h-4 w-4" /> Generate Video
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {pending.slice(0, 4).map((video) => (
                <li
                  key={video.id}
                  className="flex items-center justify-between rounded-xl bg-surface-overlay/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {video.title ?? video.topic ?? "Untitled"}
                    </p>
                    <p className="text-xs text-zinc-500">{video.channel_name}</p>
                  </div>
                  <span className="badge-warning ml-3 shrink-0">Review</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Your Channels</h2>
            <Link to="/channels" className="btn-ghost text-xs">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {channels.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No channels yet"
              description="Run npm run setup locally to register your first channel."
            />
          ) : (
            <ul className="space-y-3">
              {channels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex items-center justify-between rounded-xl bg-surface-overlay/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{channel.name}</p>
                    <p className="text-xs text-zinc-500">
                      {channel.stats?.subs_count ?? 0} subs ·{" "}
                      {channel.manual_publish_count} manual publishes
                    </p>
                  </div>
                  <span
                    className={
                      channel.status === "active"
                        ? "badge-success"
                        : "badge-neutral"
                    }
                  >
                    {channel.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pending.length > 0 && (
        <div className="mt-6 glass rounded-2xl p-4">
          <p className="text-sm text-zinc-400">
            <span className="font-medium text-white">{pending.length}</span>{" "}
            video{pending.length !== 1 ? "s" : ""} ready — total cost{" "}
            <span className="text-brand">
              {formatCurrency(
                pending.reduce((sum, v) => sum + v.cost_usd, 0),
              )}
            </span>
          </p>
        </div>
      )}
    </Layout>
  );
}
