import type { Request, Response, Router } from "express";
import { google } from "googleapis";

import type { PlatformConfig } from "../config";
import {
  consumePendingRefreshToken,
  createPendingOAuth,
  getPendingOAuth,
  setPendingOAuthResult,
} from "../services/youtube-oauth-pending";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

function youtubeRedirectUri(config: PlatformConfig): string {
  return `${config.publicBaseUrl}/api/youtube/oauth/callback`;
}

function parseStartBody(body: unknown): { clientId: string; clientSecret: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;
  const clientId =
    typeof record.client_id === "string" ? record.client_id.trim() : "";
  const clientSecret =
    typeof record.client_secret === "string" ? record.client_secret.trim() : "";

  if (!clientId || !clientSecret) {
    throw new Error("Client ID and Client Secret are required");
  }

  return { clientId, clientSecret };
}

export function createYoutubeOAuthRoutes(
  router: Router,
  config: PlatformConfig,
): void {
  router.get("/youtube/oauth/config", (_req, res) => {
    res.json({
      redirect_uri: youtubeRedirectUri(config),
      public_base_url: config.publicBaseUrl,
    });
  });

  router.post("/youtube/oauth/start", (req, res) => {
    try {
      const { clientId, clientSecret } = parseStartBody(req.body);
      const state = createPendingOAuth(clientId, clientSecret);
      const redirectUri = youtubeRedirectUri(config);

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
      );

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state,
        redirect_uri: redirectUri,
      });

      res.json({ auth_url: authUrl, state });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  router.get("/youtube/oauth/token", (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!state) {
      res.status(400).json({ error: "Missing state parameter" });
      return;
    }

    const pending = getPendingOAuth(state);
    if (!pending) {
      res.status(404).json({ error: "OAuth session expired. Connect again." });
      return;
    }

    if (pending.error) {
      res.status(400).json({ error: pending.error });
      return;
    }

    if (!pending.refreshToken) {
      res.status(202).json({ status: "pending" });
      return;
    }

    const refreshToken = consumePendingRefreshToken(state);
    if (!refreshToken) {
      res.status(404).json({ error: "OAuth session expired. Connect again." });
      return;
    }

    res.json({ refresh_token: refreshToken });
  });
}

export async function handleYoutubeOAuthCallback(
  req: Request,
  res: Response,
  config: PlatformConfig,
): Promise<void> {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : null;
  const code = typeof req.query.code === "string" ? req.query.code : null;

  const setupUrl = `${config.publicBaseUrl}/setup`;

  if (!state || !getPendingOAuth(state)) {
    res.redirect(`${setupUrl}?youtube_oauth=error&message=session_expired`);
    return;
  }

  if (error) {
    setPendingOAuthResult(state, { error });
    res.redirect(
      `${setupUrl}?youtube_oauth=error&state=${encodeURIComponent(state)}`,
    );
    return;
  }

  if (!code) {
    setPendingOAuthResult(state, { error: "No authorization code returned" });
    res.redirect(
      `${setupUrl}?youtube_oauth=error&state=${encodeURIComponent(state)}`,
    );
    return;
  }

  const pending = getPendingOAuth(state)!;
  const redirectUri = youtubeRedirectUri(config);

  try {
    const oauth2Client = new google.auth.OAuth2(
      pending.clientId,
      pending.clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      setPendingOAuthResult(state, {
        error:
          "No refresh token returned. In Google Account → Security → Third-party access, remove this app and connect again.",
      });
      res.redirect(
        `${setupUrl}?youtube_oauth=error&state=${encodeURIComponent(state)}`,
      );
      return;
    }

    setPendingOAuthResult(state, { refreshToken });
    res.redirect(
      `${setupUrl}?youtube_oauth=success&state=${encodeURIComponent(state)}`,
    );
  } catch (tokenError) {
    const message =
      tokenError instanceof Error ? tokenError.message : String(tokenError);
    setPendingOAuthResult(state, { error: message });
    res.redirect(
      `${setupUrl}?youtube_oauth=error&state=${encodeURIComponent(state)}&message=${encodeURIComponent(message)}`,
    );
  }
}
