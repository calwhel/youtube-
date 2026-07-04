import { useEffect, useState } from "react";
import { CheckCircle2, Circle, RefreshCw, Target, XCircle } from "lucide-react";

import { api, type YppReport } from "../lib/api";
import {
  EmptyState,
  ErrorBanner,
  Layout,
  LoadingSpinner,
  PageHeader,
} from "../components/Layout";
import { cn, formatNumber } from "../lib/utils";

export function MonetizationPage() {
  const [reports, setReports] = useState<YppReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.readiness();
      setReports(res.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load readiness");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Monetization"
        description="YouTube Partner Program readiness and growth milestones"
        action={
          <button onClick={() => void load()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No readiness data"
          description="Add a channel and publish videos to see YPP readiness scores."
        />
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <article
              key={report.channel_id}
              className="glass rounded-2xl p-6 shadow-card animate-slide-up"
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">
                      {report.channel_name}
                    </h3>
                    {report.ready_to_apply ? (
                      <span className="badge-success">Ready to apply</span>
                    ) : (
                      <span className="badge-warning">Not ready yet</span>
                    )}
                    {report.monetization_eligible && (
                      <span className="badge-success">Eligible</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">
                    Readiness score{" "}
                    <span className="font-semibold text-white">
                      {report.readiness_score}%
                    </span>
                  </p>
                </div>

                <div className="relative flex h-20 w-20 items-center justify-center">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-surface-border"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${report.readiness_score} 100`}
                      className="text-brand"
                    />
                  </svg>
                  <span className="absolute font-display text-sm font-bold">
                    {report.readiness_score}%
                  </span>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Subscribers" value={formatNumber(report.subs_count)} target="1,000" />
                <Stat
                  label="Watch hours"
                  value={formatNumber(Math.round(report.watch_hours_total))}
                  target="4,000"
                />
                <Stat
                  label="Manual publishes"
                  value={String(report.manual_publish_count)}
                  target="5+"
                />
                <Stat
                  label="This week"
                  value={`${report.videos_this_week}/${report.max_videos_per_week || "∞"}`}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-sm font-medium text-zinc-300">
                    Checklist
                  </h4>
                  <ul className="space-y-2">
                    {report.checklist.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-3 rounded-xl bg-surface-overlay/50 px-4 py-3"
                      >
                        {item.passed ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-zinc-500">{item.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {report.recommendations.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-medium text-zinc-300">
                      Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {report.recommendations.map((rec) => (
                        <li
                          key={rec}
                          className="flex items-start gap-3 rounded-xl bg-brand/5 px-4 py-3 ring-1 ring-brand/10"
                        >
                          <Circle className="mt-1.5 h-2 w-2 shrink-0 fill-brand text-brand" />
                          <p className="text-sm text-zinc-300">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}

function Stat({
  label,
  value,
  target,
}: {
  label: string;
  value: string;
  target?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-overlay/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={cn("mt-1 font-display text-lg font-semibold")}>{value}</p>
      {target && (
        <p className="text-[10px] text-zinc-600">Target: {target}</p>
      )}
    </div>
  );
}
