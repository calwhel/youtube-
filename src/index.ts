import express from "express";
import path from "node:path";

import { loadConfig } from "./config";
import { createAuthMiddleware } from "./middleware/auth";
import { PipelineOrchestrator } from "./pipeline";
import { createAuthRoutes } from "./routes/auth";
import { createChannelRoutes } from "./routes/channels";
import {
  createPipelineRoutes,
  getRunningChannelCount,
} from "./routes/pipeline";
import {
  createYoutubeOAuthRoutes,
  handleYoutubeOAuthCallback,
} from "./routes/youtube-oauth";
import { ChannelScheduler } from "./scheduler";
import { streamTransientAsset } from "./utils/assets";

async function main(): Promise<void> {
  const platform = loadConfig();
  const app = express();
  const orchestrator = new PipelineOrchestrator(platform);
  const scheduler = new ChannelScheduler(platform, orchestrator);
  const authenticate = createAuthMiddleware(platform);

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      runningPipelines: getRunningChannelCount(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/youtube/oauth/callback", (req, res) => {
    void handleYoutubeOAuthCallback(req, res, platform);
  });

  app.get("/internal/assets/:token", (req, res) => {
    const asset = streamTransientAsset(req.params.token);
    if (!asset) {
      res.status(404).json({ error: "Asset not found or expired" });
      return;
    }

    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Cache-Control", "no-store");
    asset.stream.pipe(res);
  });

  const publicDir = path.join(__dirname, "public");
  app.use(express.static(publicDir));

  const apiRouter = express.Router();
  createAuthRoutes(apiRouter);
  createYoutubeOAuthRoutes(apiRouter, platform);
  createChannelRoutes(apiRouter, platform);
  createPipelineRoutes(apiRouter, platform, orchestrator);
  app.use("/api", authenticate, apiRouter);

  app.get(/^\/(?!api|internal|health).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.listen(platform.port, () => {
    console.log(
      `YouTube pipeline server listening on port ${platform.port}`,
    );

    void scheduler.start().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scheduler] failed to start: ${message}`);
    });
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});
