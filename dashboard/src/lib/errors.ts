const YOUTUBE_AUTH_PATTERNS = [
  /^unauthorized$/i,
  /invalid_grant/i,
  /token has been expired or revoked/i,
  /invalid credentials/i,
  /youtube connection expired/i,
  /youtube-upload/i,
];

export function isYouTubeAuthError(message: string): boolean {
  return YOUTUBE_AUTH_PATTERNS.some((pattern) => pattern.test(message));
}

export function formatPipelineError(message: string): string {
  if (message === "Unauthorized") {
    return "YouTube connection expired — not a dashboard login issue. Open Channels → Reconnect YouTube.";
  }

  if (isYouTubeAuthError(message)) {
    return "YouTube connection expired. Open Channels → Reconnect YouTube (your channel settings stay saved).";
  }

  if (message.includes("claude-3-5-sonnet") || message.includes("not_found_error")) {
    return "AI model outdated. In Railway → Variables, set ANTHROPIC_MODEL to claude-sonnet-4-6, redeploy, then try again.";
  }

  if (message === "Load failed" || message === "Failed to fetch") {
    return "Connection dropped — generation may still be running on the server. Check Review in 5–10 minutes.";
  }

  return message;
}
