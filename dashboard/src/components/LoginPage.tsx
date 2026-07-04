import { useState } from "react";
import { Film, KeyRound, Sparkles } from "lucide-react";

import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setWarning("");
    setSuccess("");
    setLoading(true);

    try {
      const trimmed = token.trim();
      if (!trimmed) {
        throw new ApiError("Please paste your auth token", 400);
      }

      const session = await login(trimmed);

      if (session.database === "disconnected") {
        setWarning(
          "Logged in, but database is not connected. Link Postgres DATABASE_URL in Railway, then refresh.",
        );
      }

      if (session.channels.length > 0) {
        const names = session.channels.map((channel) => channel.name).join(", ");
        setSuccess(
          `Welcome back — ${names} ${session.channels.length === 1 ? "is" : "are"} still connected. You do not need to reconnect YouTube.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "Wrong token — copy AUTH_TOKEN exactly from Railway → Variables"
            : err.message
          : "Could not reach server — check your Railway app is running.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 ring-1 ring-brand/30 shadow-glow">
            <Film className="h-8 w-8 text-brand" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Pipeline Studio
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            YouTube automation dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 shadow-card">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Auth Token
          </label>
          <div className="relative mb-4">
            <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your AUTH_TOKEN from Railway"
              className="input-field pl-10"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {warning && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {warning}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Signing in..." : "Enter Dashboard"}
          </button>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
            Railway → your app → Variables → copy{" "}
            <code className="rounded bg-surface-overlay px-1.5 py-0.5 text-zinc-400">
              AUTH_TOKEN
            </code>{" "}
            once. Your login stays saved for a year — reconnecting YouTube is only needed if you delete your channel from the app.
          </p>
        </form>
      </div>
    </div>
  );
}
