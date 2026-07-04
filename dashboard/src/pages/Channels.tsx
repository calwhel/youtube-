import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Copy,
  Film,
  Link2,
  Loader2,
  RefreshCw,
  Youtube,
} from "lucide-react";

import { api, type Channel } from "../lib/api";
import { formatPipelineError } from "../lib/errors";
import {
  DatabaseSetupBanner,
  EmptyState,
  ErrorBanner,
  isDatabaseError,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";
import { formatNumber } from "../lib/utils";

type YoutubeStatus = {
  connected: boolean;
  channelTitle?: string | null;
  error?: string;
};

export function ChannelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [youtubeStatus, setYoutubeStatus] = useState<Record<string, YoutubeStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState("");
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const oauthResult = searchParams.get("youtube_oauth");
    const state = searchParams.get("state");
    const message = searchParams.get("message");

    if (!oauthResult) {
      return;
    }

    setSearchParams({}, { replace: true });

    if (oauthResult === "error") {
      setError(
        message ||
          "YouTube sign-in failed. Check your Google OAuth settings and try again.",
      );
      return;
    }

    if (oauthResult === "success" && state) {
      void finishReconnect(state);
    }
  }, [searchParams, setSearchParams]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.channels();
      setChannels(res.channels);

      const statuses: Record<string, YoutubeStatus> = {};
      await Promise.all(
        res.channels.map(async (channel) => {
          try {
            const status = await api.channelYoutubeStatus(channel.id);
            statuses[channel.id] = {
              connected: status.connected,
              channelTitle: status.channel_title,
              error: status.error,
            };
          } catch {
            statuses[channel.id] = {
              connected: false,
              error: "Could not check YouTube connection",
            };
          }
        }),
      );
      setYoutubeStatus(statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }

  async function finishReconnect(state: string) {
    setConnectingGoogle(true);
    setError("");
    setSuccess("");
    try {
      const tokenRes = await api.youtubeOAuthToken(state);
      const channelId = tokenRes.channel_id;
      if (!channelId) {
        throw new Error("Missing channel for reconnect");
      }

      await api.updateChannel(channelId, {
        youtube_client_id: tokenRes.client_id,
        youtube_client_secret: tokenRes.client_secret,
        youtube_refresh_token: tokenRes.refresh_token,
      });

      setSuccess("YouTube reconnected! Try Create again.");
      setReconnectId(null);
      setClientSecret("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconnect YouTube");
    } finally {
      setConnectingGoogle(false);
    }
  }

  async function handleReconnectGoogle(channel: Channel) {
    if (!channel.youtube_client_id.trim() || !clientSecret.trim()) {
      setError("Paste your Google Client Secret, then sign in with Google.");
      return;
    }

    setConnectingGoogle(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.youtubeOAuthStart(
        channel.youtube_client_id.trim(),
        clientSecret.trim(),
        {
          returnPath: "/channels",
          channelId: channel.id,
        },
      );
      window.location.href = res.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start YouTube sign-in");
      setConnectingGoogle(false);
    }
  }

  function copyId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const anyDisconnected = channels.some(
    (channel) => youtubeStatus[channel.id]?.connected === false,
  );

  return (
    <Layout>
      <PageHeader
        title="Channels"
        description="Your registered YouTube channels and their settings"
        action={
          <button onClick={() => void load()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && isDatabaseError(error) ? (
        <DatabaseSetupBanner />
      ) : (
        error && <ErrorBanner message={error} />
      )}
      {success && <SuccessBanner message={success} />}

      {anyDisconnected && !loading && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            YouTube connection needs refresh — not a dashboard login problem
          </p>
          <p className="mt-2 text-amber-200/90">
            Your video rendered but upload failed because Google rejected the
            saved token. Tap <strong>Reconnect YouTube</strong> below — you keep
            your channel name and settings. Testing-mode OAuth apps expire tokens
            after ~7 days.
          </p>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No channels yet"
          description="Connect your YouTube channel on the Connect page, then tap Save channel (not just Sign in with Google)."
          action={
            <Link to="/setup" className="btn-primary">
              <Link2 className="h-4 w-4" /> Go to Connect
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => {
            const status = youtubeStatus[channel.id];
            const needsReconnect = status?.connected === false;

            return (
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
                      {status && (
                        <span
                          className={
                            status.connected ? "badge-success" : "badge-warning"
                          }
                        >
                          {status.connected
                            ? `YouTube: ${status.channelTitle ?? "connected"}`
                            : "YouTube: reconnect needed"}
                        </span>
                      )}
                      {channel.review_mode === "required" && (
                        <span className="badge-warning">Review required</span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {channel.niche_prompt}
                    </p>
                    {needsReconnect && status?.error && (
                      <p className="mt-2 text-xs text-amber-200/90">
                        {formatPipelineError(status.error)}
                      </p>
                    )}
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

                {needsReconnect && (
                  <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    {reconnectId === channel.id ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-amber-100">
                          Reconnect YouTube for {channel.name}
                        </p>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Google Client ID
                          </label>
                          <input
                            value={channel.youtube_client_id}
                            readOnly
                            className="input-field text-zinc-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Google Client Secret
                          </label>
                          <input
                            type="password"
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            placeholder="Same secret from Google Cloud Console"
                            className="input-field"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleReconnectGoogle(channel)}
                            disabled={connectingGoogle}
                            className="btn-primary"
                          >
                            {connectingGoogle ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
                              </>
                            ) : (
                              <>
                                <Youtube className="h-4 w-4" /> Sign in with Google
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReconnectId(null);
                              setClientSecret("");
                            }}
                            className="btn-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReconnectId(channel.id);
                          setClientSecret("");
                          setError("");
                        }}
                        className="btn-primary"
                      >
                        <Youtube className="h-4 w-4" /> Reconnect YouTube
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
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
