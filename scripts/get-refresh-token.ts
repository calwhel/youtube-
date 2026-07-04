import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

import {
  DEFAULT_CHANNEL_FILE,
  loadChannelFile,
  readOAuthCredentialsFromRecord,
  saveRefreshTokenToChannelFile,
} from "./lib/channel-json";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REDIRECT_URI = "http://localhost:53682/oauth2callback";
const PORT = 53682;
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

async function resolveOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  channelFile: string | null;
}> {
  const channelFile = process.argv[2] ?? DEFAULT_CHANNEL_FILE;
  const channelPath = path.resolve(PROJECT_ROOT, channelFile);

  if (existsSync(channelPath)) {
    const { raw } = await loadChannelFile(channelFile);
    const fromChannel = readOAuthCredentialsFromRecord(raw);
    if (fromChannel) {
      return { ...fromChannel, channelFile };
    }
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error(
      `Add youtube_client_id and youtube_client_secret to ${channelFile}, then run again.`,
    );
    process.exit(1);
  }

  return { clientId, clientSecret, channelFile: null };
}

function parseCallbackUrl(requestUrl: string): URL {
  return new URL(requestUrl, REDIRECT_URI);
}

function sendHtml(res: ServerResponse, statusCode: number, body: string): void {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

async function main(): Promise<void> {
  const { clientId, clientSecret, channelFile } = await resolveOAuthCredentials();

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI,
  );

  const consentUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
  });

  console.log("Open this URL in your browser and authorize your YouTube channel:");
  console.log("");
  console.log(consentUrl);
  console.log("");
  console.log("Waiting for authorization...");

  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith("/oauth2callback")) {
        sendHtml(res, 404, "<h1>Not found</h1>");
        return;
      }

      const callbackUrl = parseCallbackUrl(req.url);
      const error = callbackUrl.searchParams.get("error");
      const code = callbackUrl.searchParams.get("code");

      if (error) {
        sendHtml(
          res,
          400,
          `<h1>Authorization failed</h1><p>${error}</p><p>You can close this tab.</p>`,
        );
        server.close();
        reject(new Error(`OAuth authorization denied: ${error}`));
        return;
      }

      if (!code) {
        sendHtml(
          res,
          400,
          "<h1>Authorization failed</h1><p>No authorization code was returned.</p>",
        );
        server.close();
        reject(new Error("OAuth callback did not include a code query parameter."));
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
          sendHtml(
            res,
            400,
            "<h1>Token exchange failed</h1><p>No refresh token was returned. Revoke app access in Google Account settings and try again.</p>",
          );
          server.close();
          reject(
            new Error(
              "No refresh_token returned. Revoke prior app access and re-run.",
            ),
          );
          return;
        }

        const tokenFilePath = path.join(PROJECT_ROOT, ".refresh-token.txt");
        await writeFile(tokenFilePath, `${refreshToken}\n`, {
          encoding: "utf8",
          mode: 0o600,
        });

        if (channelFile) {
          await saveRefreshTokenToChannelFile(channelFile, refreshToken);
          console.log(`Saved refresh token to ${channelFile}`);
        }

        console.log("");
        console.log("Refresh token:");
        console.log(refreshToken);
        console.log("");
        console.log("Next: npm run setup");

        sendHtml(
          res,
          200,
          "<h1>Authorization complete</h1><p>Refresh token saved. Close this tab and run <code>npm run setup</code>.</p>",
        );

        server.close(() => resolve());
      } catch (tokenError) {
        const message =
          tokenError instanceof Error ? tokenError.message : String(tokenError);
        sendHtml(res, 500, `<h1>Token exchange failed</h1><p>${message}</p>`);
        server.close();
        reject(
          tokenError instanceof Error
            ? tokenError
            : new Error(`Token exchange failed: ${message}`),
        );
      }
    });

    server.on("error", (serverError) => {
      reject(serverError);
    });

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Listening for OAuth callback on ${REDIRECT_URI}`);
    });
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
