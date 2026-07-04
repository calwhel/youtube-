import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Link2,
  Sparkles,
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

const emptyForm = {
  name: "",
  niche_prompt: "",
  youtube_client_id: "",
  youtube_client_secret: "",
  youtube_refresh_token: "",
  elevenlabs_voice_id: "",
};

export function SetupPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    void load();
  }, []);

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      setSuccess(`Channel "${res.channel.name}" connected!`);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect channel");
    } finally {
      setSubmitting(false);
    }
  }

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Layout>
      <PageHeader
        title="Connect Channel"
        description="Link your YouTube channel and API keys — one-time setup"
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
            <h2 className="font-display text-lg font-semibold">How to get each key</h2>

            <GuideSection title="1. Google / YouTube OAuth" defaultOpen>
              <ol className="list-decimal space-y-2 pl-4">
                <li>
                  Go to{" "}
                  <a
                    className="text-brand hover:underline"
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Cloud Console
                  </a>
                </li>
                <li>Enable YouTube Data API v3 + YouTube Analytics API</li>
                <li>Create OAuth client → Desktop app</li>
                <li>
                  On your computer run{" "}
                  <code className="rounded bg-surface-overlay px-1">npm run get-token</code>{" "}
                  — paste Client ID & Secret in <code className="rounded bg-surface-overlay px-1">channel.json</code>, open the URL, authorize
                </li>
                <li>Copy the refresh token into the form →</li>
              </ol>
            </GuideSection>

            <GuideSection title="2. ElevenLabs voice ID">
              <ol className="list-decimal space-y-2 pl-4">
                <li>
                  Sign up at{" "}
                  <a className="text-brand hover:underline" href="https://elevenlabs.io" target="_blank" rel="noreferrer">
                    elevenlabs.io
                  </a>
                </li>
                <li>Voice Library → pick a voice → copy Voice ID</li>
              </ol>
            </GuideSection>

            <GuideSection title="3. Anthropic + Railway vars">
              <p>
                Anthropic, ElevenLabs, and Creatomate keys go in Railway → Variables (not here).
                This form only stores your YouTube + voice settings per channel.
              </p>
            </GuideSection>

            {channels.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="mb-3 flex items-center gap-2 font-medium text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" /> Connected channels
                </h3>
                <ul className="space-y-2">
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
                <Link to="/generate" className="btn-primary mt-4 inline-flex">
                  <Sparkles className="h-4 w-4" /> Generate first video
                </Link>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-brand" /> Connect YouTube channel
            </h2>

            <Field label="Channel name" value={form.name} onChange={(v) => update("name", v)} placeholder="My Finance Channel" />
            <Field
              label="Niche prompt (your POV)"
              value={form.niche_prompt}
              onChange={(v) => update("niche_prompt", v)}
              placeholder="I explain personal finance for beginners with real examples..."
              multiline
            />
            <Field label="Google Client ID" value={form.youtube_client_id} onChange={(v) => update("youtube_client_id", v)} />
            <Field label="Google Client Secret" value={form.youtube_client_secret} onChange={(v) => update("youtube_client_secret", v)} type="password" />
            <Field label="YouTube Refresh Token" value={form.youtube_refresh_token} onChange={(v) => update("youtube_refresh_token", v)} type="password" />
            <Field label="ElevenLabs Voice ID" value={form.elevenlabs_voice_id} onChange={(v) => update("elevenlabs_voice_id", v)} />

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Connecting..." : "Connect Channel"}
            </button>
          </form>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
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
          required
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field"
          required
        />
      )}
    </div>
  );
}
