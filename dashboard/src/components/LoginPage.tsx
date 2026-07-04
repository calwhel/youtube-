import { useState } from "react";
import { Film, KeyRound, Sparkles } from "lucide-react";

import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmed = token.trim();
      const response = await fetch("/api/channels", {
        headers: { "x-auth-token": trimmed },
      });

      if (response.status === 401) {
        throw new ApiError("Invalid auth token", 401);
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new ApiError(data.error ?? "Connection failed", response.status);
      }

      login(trimmed);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not connect. Check your token and try again.",
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
              required
            />
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Connecting..." : "Enter Dashboard"}
          </button>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
            Find your token in Railway → your app service → Variables →{" "}
            <code className="rounded bg-surface-overlay px-1.5 py-0.5 text-zinc-400">
              AUTH_TOKEN
            </code>
          </p>
        </form>
      </div>
    </div>
  );
}
