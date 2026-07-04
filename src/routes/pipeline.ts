import type { Request, Response, Router } from "express";
import { createReadStream, existsSync } from "node:fs";

import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { VideoRepository } from "../db/repositories/videos";
import type { PipelineOrchestrator } from "../pipeline";
import { AnalyticsSyncService } from "../services/analytics-sync";
import { PublishFinalizer } from "../services/publish-finalizer";
import { ThumbnailAbService } from "../services/thumbnail-ab";
import { YouTubeService } from "../services/youtube";
import { YppReadinessService } from "../services/ypp-readiness";
import {
  getPreviewThumbnailPath,
  getPreviewVideoPath,
  previewVideoExists,
} from "../utils/preview-storage";

const runningChannels = new Set<string>();
const lastPipelineErrors = new Map<
  string,
  { message: string; at: string }
>();
const lastPipelineSuccess = new Map<
  string,
  { video_id: string; title: string | null; preview: boolean; at: string }
>();

export function getLastPipelineSuccess(
  channelId: string,
): { video_id: string; title: string | null; preview: boolean; at: string } | null {
  return lastPipelineSuccess.get(channelId) ?? null;
}

export function getLastPipelineError(
  channelId: string,
): { message: string; at: string } | null {
  return lastPipelineErrors.get(channelId) ?? null;
}

export function isChannelPipelineRunning(channelId: string): boolean {
  return runningChannels.has(channelId);
}

export function getRunningChannelCount(): number {
  return runningChannels.size;
}

export function getRunningChannelIds(): string[] {
  return [...runningChannels];
}

export function createPipelineRoutes(
  router: Router,
  platform: PlatformConfig,
  orchestrator: PipelineOrchestrator,
): void {
  const handleRunPipeline = async (req: Request, res: Response): Promise<void> => {
    const channelId =
      typeof req.body?.channel_id === "string"
        ? req.body.channel_id
        : typeof req.query.channel_id === "string"
          ? req.query.channel_id
          : undefined;

    if (!channelId) {
      res.status(400).json({ error: "channel_id is required" });
      return;
    }

    if (runningChannels.has(channelId)) {
      res.status(409).json({
        error: "Pipeline is already running for this channel",
        status: "running",
        channel_id: channelId,
      });
      return;
    }

    const topic =
      typeof req.body?.topic === "string" ? req.body.topic : undefined;
    const skipYoutube =
      typeof req.body?.skip_youtube === "boolean"
        ? req.body.skip_youtube
        : platform.skipYoutubeUpload;

    runningChannels.add(channelId);

    void (async () => {
      try {
        const result = await orchestrator.run({ channelId, topic, skipYoutube });
        lastPipelineErrors.delete(channelId);
        lastPipelineSuccess.set(channelId, {
          video_id: result.dbVideoId,
          title: result.title,
          preview: skipYoutube,
          at: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[pipeline] channel=${channelId} failed:`, message);
        lastPipelineErrors.set(channelId, {
          message,
          at: new Date().toISOString(),
        });
      } finally {
        runningChannels.delete(channelId);
      }
    })();

    res.status(202).json({
      success: true,
      status: "started",
      channel_id: channelId,
      skip_youtube: skipYoutube,
      message: skipYoutube
        ? "Video is generating for in-app preview (no YouTube upload). Check Review in 5–10 minutes."
        : "Video is generating in the background. Check the Review tab in 5–10 minutes.",
    });
  };

  router.get("/pipeline/config", (_req, res) => {
    res.status(200).json({
      skip_youtube_upload_default: platform.skipYoutubeUpload,
    });
  });

  router.get("/pipeline/status", (_req, res) => {
    res.status(200).json({
      running_count: getRunningChannelCount(),
      running_channel_ids: getRunningChannelIds(),
    });
  });

  router.post("/run-pipeline", (req, res) => {
    void handleRunPipeline(req, res);
  });

  router.get("/run-pipeline", (req, res) => {
    void handleRunPipeline(req, res);
  });

  const videos = new VideoRepository();
  const channels = new ChannelRepository(platform.encryptionKey);

  router.get("/pending", async (_req, res) => {
    const pending = await videos.listPending();
    const enriched = await Promise.all(
      pending.map(async (video) => ({
        ...video,
        preview_only: !video.youtube_video_id,
        preview_available: video.youtube_video_id
          ? false
          : await previewVideoExists(platform.tmpDir, video.id),
      })),
    );
    res.status(200).json({ videos: enriched });
  });

  router.get("/review/queue", async (_req, res) => {
    const [pending, activity] = await Promise.all([
      videos.listPending(),
      videos.listRecentActivity(),
    ]);

    const processing = activity.filter((item) => item.status === "processing");
    const failed = activity.filter((item) => item.status === "failed");

    const ready = await Promise.all(
      pending.map(async (video) => ({
        ...video,
        preview_only: !video.youtube_video_id,
        preview_available: video.youtube_video_id
          ? false
          : await previewVideoExists(platform.tmpDir, video.id),
      })),
    );

    res.status(200).json({
      ready,
      processing,
      failed,
    });
  });

  router.get("/videos/activity", async (req, res) => {
    const channelId =
      typeof req.query.channel_id === "string" ? req.query.channel_id : undefined;
    const activity = await videos.listRecentActivity(channelId);
    const lastError = channelId ? getLastPipelineError(channelId) : null;
    const lastSuccess = channelId ? getLastPipelineSuccess(channelId) : null;
    res.status(200).json({ activity, last_error: lastError, last_success: lastSuccess });
  });

  router.get("/videos/:video_id/preview/thumbnail", async (req, res) => {
    const thumbnailPath = getPreviewThumbnailPath(
      platform.tmpDir,
      req.params.video_id,
    );
    if (!existsSync(thumbnailPath)) {
      res.status(404).json({ error: "Preview thumbnail not found" });
      return;
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(thumbnailPath).pipe(res);
  });

  router.get("/videos/:video_id/preview", async (req, res) => {
    const videoPath = getPreviewVideoPath(platform.tmpDir, req.params.video_id);
    if (!existsSync(videoPath)) {
      res.status(404).json({ error: "Preview video not found" });
      return;
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(videoPath).pipe(res);
  });

  router.get("/videos/:video_id", async (req, res) => {
    const review = await videos.findReviewByIdEnriched(
      req.params.video_id,
      platform.tmpDir,
    );
    if (!review) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.status(200).json({ video: review });
  });

  router.patch("/videos/:video_id", async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const title = typeof body.title === "string" ? body.title : undefined;
    let tags: string[] | undefined;
    if (Array.isArray(body.tags)) {
      tags = body.tags.filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      );
    }

    const updated = await videos.updateReviewMetadata(req.params.video_id, {
      title,
      description,
      tags,
    });

    if (!updated) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const video = await videos.findById(req.params.video_id);
    if (video?.youtube_video_id && (description || title || tags)) {
      const channel = await channels.findDecryptedById(video.channel_id);
      if (channel) {
        const { buildServiceConfig } = await import("../config/channel-config");
        const youtube = new YouTubeService(buildServiceConfig(platform, channel));
        await youtube.updateVideoMetadata(video.youtube_video_id, {
          title: title ?? video.title ?? undefined,
          description: description ?? video.description ?? undefined,
          tags: tags ?? (Array.isArray(video.tags) ? video.tags : undefined),
        });
      }
    }

    const review = await videos.findReviewByIdEnriched(
      req.params.video_id,
      platform.tmpDir,
    );
    res.status(200).json({ video: review });
  });

  router.post("/publish/:video_id", async (req, res) => {
    const video = await videos.findById(req.params.video_id);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    if (video.status !== "private") {
      res.status(400).json({
        error: "Only private videos awaiting review can be published",
      });
      return;
    }

    if (!video.youtube_video_id) {
      res.status(400).json({
        error:
          "This is a preview-only video. Turn off preview mode on Create to upload to YouTube, or reconnect YouTube and regenerate.",
      });
      return;
    }

    const channel = await channels.findDecryptedById(video.channel_id);
    if (!channel) {
      res.status(404).json({ error: "Channel not found for video" });
      return;
    }

    try {
      const body = req.body as Record<string, unknown>;
      if (
        typeof body.description === "string" ||
        Array.isArray(body.tags) ||
        typeof body.title === "string"
      ) {
        const tags = Array.isArray(body.tags)
          ? body.tags.filter(
              (t): t is string => typeof t === "string" && t.trim() !== "",
            )
          : undefined;
        await videos.updateReviewMetadata(video.id, {
          title: typeof body.title === "string" ? body.title : undefined,
          description:
            typeof body.description === "string" ? body.description : undefined,
          tags,
        });
      }

      const finalizer = new PublishFinalizer(platform);
      await finalizer.finalize({
        dbVideoId: video.id,
        channelId: video.channel_id,
        youtubeVideoId: video.youtube_video_id,
        shortYoutubeVideoId: video.short_youtube_video_id,
        isManualPublish: true,
      });
      const updated = await videos.findById(video.id);

      res.status(200).json({
        success: true,
        video: updated,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get("/costs", async (_req, res) => {
    const costs = await videos.getCostSummary();
    res.status(200).json({ costs });
  });

  router.get("/monetization", async (_req, res) => {
    const sync = new AnalyticsSyncService(platform);
    const result = await sync.syncAll();

    const channelList = await channels.listAll();
    const results = channelList.map((channel) => ({
      channel_id: channel.id,
      channel_name: channel.name,
      subs_count: channel.stats?.subs_count ?? 0,
      watch_hours_total: channel.stats?.watch_hours_total ?? 0,
      monetization_eligible: channel.stats?.monetization_eligible ?? false,
    }));

    res.status(200).json({
      channels: results,
      sync: {
        videos_updated: result.videosUpdated,
        errors: result.errors,
      },
    });
  });

  router.post("/analytics/sync", async (_req, res) => {
    try {
      const sync = new AnalyticsSyncService(platform);
      const result = await sync.syncAll();
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post("/thumbnails/ab-evaluate", async (_req, res) => {
    try {
      const ab = new ThumbnailAbService(platform);
      const result = await ab.evaluateAndSwapAll();
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get("/monetization/readiness", async (_req, res) => {
    try {
      const readiness = new YppReadinessService(platform);
      const channels = await readiness.evaluateAll();
      res.status(200).json({ channels });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get("/monetization/readiness/:channel_id", async (req, res) => {
    try {
      const readiness = new YppReadinessService(platform);
      const report = await readiness.evaluateChannel(req.params.channel_id);
      if (!report) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.status(200).json({ report });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });
}

export async function runPipelineForChannel(
  orchestrator: PipelineOrchestrator,
  channelId: string,
): Promise<void> {
  if (runningChannels.has(channelId)) {
    console.warn(
      `[scheduler] skipped channel ${channelId}; pipeline already running`,
    );
    return;
  }

  runningChannels.add(channelId);

  try {
    await orchestrator.run({ channelId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[scheduler] channel ${channelId} failed:`, message);
  } finally {
    runningChannels.delete(channelId);
  }
}
