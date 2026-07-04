const YOUTUBE_AUTH_PATTERNS = [
  /^unauthorized$/i,
  /invalid_grant/i,
  /token has been expired or revoked/i,
  /invalid credentials/i,
  /access token/i,
  /refresh token/i,
  /youtube-upload/i,
  /youtube-shorts-upload/i,
  /youtube-publish/i,
];

export function isYouTubeAuthError(message: string): boolean {
  return YOUTUBE_AUTH_PATTERNS.some((pattern) => pattern.test(message));
}

export function formatYouTubeAuthError(message: string): string {
  if (!isYouTubeAuthError(message)) {
    return message;
  }

  return [
    "YouTube connection expired or is invalid.",
    "Open Channels → Reconnect YouTube (keeps your channel name and settings).",
    "If your Google OAuth app is in Testing mode, refresh tokens expire after 7 days — reconnect or publish the app in Google Cloud.",
  ].join(" ");
}

export function formatPipelineError(message: string): string {
  if (message === "Unauthorized") {
    return formatYouTubeAuthError(message);
  }

  return formatYouTubeAuthError(message);
}
