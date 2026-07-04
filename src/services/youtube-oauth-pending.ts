export interface YoutubeOAuthPending {
  clientId: string;
  clientSecret: string;
  refreshToken: string | null;
  error: string | null;
  createdAt: number;
  returnPath: string;
  channelId: string | null;
}

const TTL_MS = 15 * 60 * 1000;
const pending = new Map<string, YoutubeOAuthPending>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [state, entry] of pending) {
    if (now - entry.createdAt > TTL_MS) {
      pending.delete(state);
    }
  }
}

export function createPendingOAuth(
  clientId: string,
  clientSecret: string,
  options?: { returnPath?: string; channelId?: string },
): string {
  purgeExpired();
  const state = crypto.randomUUID();
  pending.set(state, {
    clientId,
    clientSecret,
    refreshToken: null,
    error: null,
    createdAt: Date.now(),
    returnPath: options?.returnPath ?? "/setup",
    channelId: options?.channelId ?? null,
  });
  return state;
}

export function getPendingOAuth(state: string): YoutubeOAuthPending | null {
  purgeExpired();
  return pending.get(state) ?? null;
}

export function setPendingOAuthResult(
  state: string,
  result: { refreshToken: string } | { error: string },
): boolean {
  const entry = pending.get(state);
  if (!entry) {
    return false;
  }

  if ("refreshToken" in result) {
    entry.refreshToken = result.refreshToken;
    entry.error = null;
  } else {
    entry.error = result.error;
    entry.refreshToken = null;
  }

  return true;
}

export function consumePendingOAuthSession(state: string): {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  returnPath: string;
  channelId: string | null;
} | null {
  const entry = pending.get(state);
  if (!entry?.refreshToken) {
    return null;
  }

  const session = {
    refreshToken: entry.refreshToken,
    clientId: entry.clientId,
    clientSecret: entry.clientSecret,
    returnPath: entry.returnPath,
    channelId: entry.channelId,
  };
  pending.delete(state);
  return session;
}
