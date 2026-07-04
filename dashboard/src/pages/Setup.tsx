import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  Loader2,
  Sparkles,
  Youtube,
} from "lucide-react";

import { api, type Channel } from "../lib/api";
import {
  DatabaseSetupBanner,
  ErrorBanner,
  isDatabaseError,
  Layout,
  LoadingSpinner,
  PageHeader,
  SuccessBanner,
} from "../components/Layout";

function GuideSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass rounded-2xl shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-medium">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-surface-border/60 px-5 py-4 text-sm leading-relaxed text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}

const SETUP_DRAFT_KEY = "pipeline_setup_draft";

type SetupDraft = {
  name: string;
  niche_prompt: string;
  youtube_client_id: string;
  youtube_client_secret: string;
  elevenlabs_voice_id: string;
};

function loadSetupDraft(): Partial<SetupDraft> {
  try {
    const raw = sessionStorage.getItem(SETUP_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<SetupDraft>) : {};
  } catch {
    return {};
  }
}

function saveSetupDraft(form: SetupDraft): void {
  sessionStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(form));
}

function clearSetupDraft(): void {
  sessionStorage.removeItem(SETUP_DRAFT_KEY);
}

const emptyForm = {
  name: "",
  niche_prompt: "",
  youtube_client_id: "",
  youtube_client_secret: "",
  youtube_refresh_token: "",
  elevenlabs_voice_id: "21m00Tcm4TlvDq8ikWAM",
};

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...loadSetupDraft(),
  }));

  useEffect(() => {
    void load();
    void api
      .youtubeOAuthConfig()
      .then((res) => setRedirectUri(res.redirect_uri))
      .catch(() => {});
  }, []);

  useEffect(() => {
    saveSetupDraft({
      name: form.name,
      niche_prompt: form.niche_prompt,
      youtube_client_id: form.youtube_client_id,
      youtube_client_secret: form.youtube_client_secret,
      elevenlabs_voice_id: form.elevenlabs_voice_id,
    });
  }, [form.name, form.niche_prompt, form.youtube_client_id, form.youtube_client_secret, form.elevenlabs_voice_id]);

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
      setShowAddChannel(true);
      void finishOAuth(state);
    }
  }, [searchParams, setSearchParams]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.channels();
      setChannels(res.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function finishOAuth(state: string) {
    setConnectingGoogle(true);
    setError("");
    try {
      const res = await api.youtubeOAuthToken(state);
      setForm((prev) => ({
        ...prev,
        youtube_client_id: res.client_id,
        youtube_client_secret: res.client_secret,
        youtube_refresh_token: res.refresh_token,
      }));
      setYoutubeConnected(true);
      setSuccess("YouTube connected! Tap Save channel below — your details are kept.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish YouTube sign-in");
    } finally {
      setConnectingGoogle(false);
    }
  }

  async function handleConnectGoogle() {
    if (!form.youtube_client_id.trim() || !form.youtube_client_secret.trim()) {
      setError("Paste your Google Client ID and Secret first.");
      return;
    }

    setConnectingGoogle(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.youtubeOAuthStart(
        form.youtube_client_id.trim(),
        form.youtube_client_secret.trim(),
      );
      saveSetupDraft({
        name: form.name,
        niche_prompt: form.niche_prompt,
        youtube_client_id: form.youtube_client_id,
        youtube_client_secret: form.youtube_client_secret,
        elevenlabs_voice_id: form.elevenlabs_voice_id,
      });
      window.location.href = res.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start YouTube sign-in");
      setConnectingGoogle(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.youtube_refresh_token) {
      setError('Click "Sign in with Google" above before saving.');
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.createChannel({
        ...form,
        creatomate_template_id: "ffmpeg",
        creatomate_template_ids: ["ffmpeg"],
        status: "active",
        upload_frequency: "0 14 * * *",
      });
      setSuccess(`Channel "${res.channel.name}" saved!`);
      clearSetupDraft();
      setYoutubeConnected(false);
      await load();
      navigate("/generate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect channel");
    } finally {
      setSubmitting(false);
    }
  }

  function update(field: keyof typeof form, value: string) {
    if (field === "youtube_client_id" || field === "youtube_client_secret") {
      setYoutubeConnected(false);
    }

    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "youtube_client_id" || field === "youtube_client_secret") {
        next.youtube_refresh_token = "";
      }
      return next;
    });
  }

  async function copyRedirectUri() {
    if (!redirectUri) return;
    await navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Layout>
      <PageHeader
        title="Connect Channel"
        description="Everything happens here in the browser — no terminal commands"
      />

      {error && isDatabaseError(error) ? (
        <DatabaseSetupBanner />
      ) : (
        error && <ErrorBanner message={error} />
      )}
      {success && <SuccessBanner message={success} />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {channels.length > 0 ? (
              <div className="glass rounded-2xl p-5 shadow-card">
                <h2 className="font-display text-lg font-semibold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> You&apos;re connected
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Your YouTube channel is saved in the database. You only need
                  to sign in with Google again if you add a new channel.
                </p>
                <ul className="mt-4 space-y-2">
                  {channels.map((ch) => (
                    <li
                      key={ch.id}
                      className="rounded-xl bg-surface-overlay/60 px-4 py-3 text-sm"
                    >
                      <p className="font-medium">{ch.name}</p>
                      <p className="text-xs text-zinc-500">{ch.id}</p>
                    </li>
                  ))}
                </ul>
                <Link to="/generate" className="btn-primary mt-4 inline-flex w-full justify-center">
                  <Sparkles className="h-4 w-4" /> Generate video
                </Link>
              </div>
            ) : (
              <>
                <h2 className="font-display text-lg font-semibold">Quick setup (5 minutes)</h2>

                <GuideSection title="Step 1 — Google Cloud (one time)" defaultOpen>
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>
                      Open{" "}
                      <a
                        className="text-brand hover:underline"
                        href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Google Cloud Console
                      </a>
                    </li>
                    <li>Enable <strong>YouTube Data API v3</strong> and <strong>YouTube Analytics API</strong></li>
                    <li>
                      Credentials → Create OAuth client → type <strong>Web application</strong>
                    </li>
                    <li>
                      Under <strong>Authorized redirect URIs</strong>, paste this exact URL:
                    </li>
                  </ol>
                  {redirectUri ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-overlay/80 p-3">
                      <code className="flex-1 break-all text-xs text-zinc-200">{redirectUri}</code>
                      <button
                        type="button"
                        onClick={() => void copyRedirectUri()}
                        className="btn-ghost shrink-0 p-2"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">Loading redirect URL...</p>
                  )}
                  {copied && (
                    <p className="mt-2 text-xs text-emerald-400">Copied!</p>
                  )}
                  <p className="mt-3">
                    Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the form →
                  </p>
                </GuideSection>

                <GuideSection title="Step 2 — Sign in with Google (in this app)">
                  <p>
                    Paste Client ID + Secret, then click <strong>Sign in with Google</strong>.
                    You’ll pick your YouTube channel in Google’s popup — no commands to run on your computer.
                  </p>
                </GuideSection>

                <GuideSection title="Step 3 — ElevenLabs voice">
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>
                      <a className="text-brand hover:underline" href="https://elevenlabs.io" target="_blank" rel="noreferrer">
                        elevenlabs.io
                      </a>{" "}
                      → Voice Library → copy a Voice ID
                    </li>
                  </ol>
                </GuideSection>

                <GuideSection title="Railway API keys">
                  <p>
                    Anthropic and ElevenLabs API keys live in Railway → Variables on your app service.
                    This page only connects your YouTube channel and voice.
                  </p>
                </GuideSection>
              </>
            )}
          </div>

          {channels.length > 0 && !showAddChannel ? (
            <div className="glass rounded-2xl p-6 shadow-card space-y-4">
              <h2 className="font-display text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Nothing else to connect
              </h2>
              <p className="text-sm text-zinc-400">
                Go to Create to generate a video, or open Review to publish one.
              </p>
              <Link to="/generate" className="btn-primary inline-flex w-full justify-center">
                <Sparkles className="h-4 w-4" /> Create video
              </Link>
              <button
                type="button"
                onClick={() => setShowAddChannel(true)}
                className="btn-secondary w-full"
              >
                Add another channel
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 shadow-card space-y-4">
            {channels.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddChannel(false)}
                className="btn-ghost w-full text-xs"
              >
                Cancel — back to connected channels
              </button>
            )}

            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-brand" />
              {channels.length > 0 ? "Add another channel" : "Your channel"}
            </h2>

            <Field label="Channel name" value={form.name} onChange={(v) => update("name", v)} placeholder="My Finance Channel" />
            <Field
              label="What your channel is about"
              value={form.niche_prompt}
              onChange={(v) => update("niche_prompt", v)}
              placeholder="I explain personal finance for beginners with real examples..."
              multiline
            />

            <div className="rounded-xl border border-surface-border/60 bg-surface-overlay/40 p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-300">YouTube (Google OAuth)</p>
              <Field
                label="Google Client ID"
                value={form.youtube_client_id}
                onChange={(v) => update("youtube_client_id", v)}
                required={!youtubeConnected}
              />
              <Field
                label="Google Client Secret"
                value={form.youtube_client_secret}
                onChange={(v) => update("youtube_client_secret", v)}
                type="password"
                required={!youtubeConnected}
              />

              <button
                type="button"
                onClick={() => void handleConnectGoogle()}
                disabled={connectingGoogle}
                className="btn-secondary w-full"
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

              {youtubeConnected && (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> YouTube authorized — now tap Save channel below
                </p>
              )}
            </div>

            <Field label="ElevenLabs Voice ID" value={form.elevenlabs_voice_id} onChange={(v) => update("elevenlabs_voice_id", v)} />

            <button type="submit" disabled={submitting || !youtubeConnected} className="btn-primary w-full">
              {submitting ? "Saving..." : "Save channel"}
            </button>
          </form>
          )}
        </div>
      )}
    </Layout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="input-field resize-none"
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field"
          required={required}
        />
      )}
    </div>
  );
}
