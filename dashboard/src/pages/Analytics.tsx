import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, Zap } from "lucide-react";

import { api, type CostRow } from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";
import { formatCurrency, formatNumber } from "../lib/utils";

export function AnalyticsPage() {
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [monetization, setMonetization] = useState<
    Array<{
      channel_name: string;
      subs_count: number;
      watch_hours_total: number;
      monetization_eligible: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [costsRes, monetRes] = await Promise.all([
        api.costs(),
        api.monetization(),
      ]);
      setCosts(costsRes.costs);
      setMonetization(monetRes.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.syncAnalytics();
      setSuccess(`Analytics synced — ${res.videosUpdated} videos updated`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleThumbnailAb() {
    setEvaluating(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.evaluateThumbnails();
      setSuccess(
        `Thumbnail A/B done — ${res.swapped} swapped of ${res.evaluated} evaluated`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  const totalSpend = costs.reduce((sum, c) => sum + c.total_cost_usd, 0);
  const totalVideos = costs.reduce((sum, c) => sum + c.video_count, 0);

  return (
    <Layout>
      <PageHeader
        title="Analytics"
        description="Costs, performance sync, and thumbnail experiments"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => void handleThumbnailAb()}
              disabled={evaluating}
              className="btn-secondary"
            >
              <Zap className="h-4 w-4" />
              {evaluating ? "Evaluating..." : "A/B Thumbnails"}
            </button>
            <button
              onClick={() => void handleSync()}
              disabled={syncing}
              className="btn-primary"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync Analytics"}
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="glass rounded-2xl p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Total spend
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {formatCurrency(totalSpend)}
              </p>
            </div>
            <div className="glass rounded-2xl p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Videos generated
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {formatNumber(totalVideos)}
              </p>
            </div>
            <div className="glass rounded-2xl p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Avg cost / video
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {totalVideos > 0
                  ? formatCurrency(totalSpend / totalVideos)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="glass rounded-2xl p-6 shadow-card">
              <h2 className="mb-4 font-display font-semibold">Cost breakdown</h2>
              {costs.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No cost data yet"
                  description="Costs appear after your first pipeline run."
                />
              ) : (
                <div className="space-y-3">
                  {costs.map((row) => (
                    <div
                      key={`${row.channel_id}-${row.month}`}
                      className="flex items-center justify-between rounded-xl bg-surface-overlay/60 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{row.channel_name}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(row.month).toLocaleDateString("en", {
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          · {row.video_count} videos
                        </p>
                      </div>
                      <p className="font-display font-semibold text-brand">
                        {formatCurrency(row.total_cost_usd)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="glass rounded-2xl p-6 shadow-card">
              <h2 className="mb-4 font-display font-semibold">
                Channel performance
              </h2>
              {monetization.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No performance data"
                  description="Click Sync Analytics to pull latest stats from YouTube."
                />
              ) : (
                <div className="space-y-3">
                  {monetization.map((ch) => (
                    <div
                      key={ch.channel_name}
                      className="rounded-xl bg-surface-overlay/60 px-4 py-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{ch.channel_name}</p>
                        {ch.monetization_eligible && (
                          <span className="badge-success">YPP</span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-zinc-500">Subscribers</p>
                          <p className="font-semibold">
                            {formatNumber(ch.subs_count)}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Watch hours</p>
                          <p className="font-semibold">
                            {formatNumber(Math.round(ch.watch_hours_total))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </Layout>
  );
}
