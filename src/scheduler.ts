import cron, { type ScheduledTask } from "node-cron";

import type { PlatformConfig } from "./config";
import { ChannelRepository } from "./db/repositories/channels";
import { bootstrapSchema } from "./db/pool";
import type { PipelineOrchestrator } from "./pipeline";
import { runPipelineForChannel } from "./routes/pipeline";
import { AnalyticsSyncService } from "./services/analytics-sync";
import { ThumbnailAbService } from "./services/thumbnail-ab";

export class ChannelScheduler {
  private readonly channels: ChannelRepository;
  private readonly jobs = new Map<string, ScheduledTask>();
  private reloadTask: ScheduledTask | null = null;
  private analyticsTask: ScheduledTask | null = null;
  private thumbnailAbTask: ScheduledTask | null = null;

  constructor(
    private readonly platform: PlatformConfig,
    private readonly orchestrator: PipelineOrchestrator,
  ) {
    this.channels = new ChannelRepository(platform.encryptionKey);
  }

  async start(): Promise<void> {
    await bootstrapSchema();
    await this.reloadJobs();

    this.reloadTask = cron.schedule("*/5 * * * *", () => {
      void this.reloadJobs();
    });

    this.analyticsTask = cron.schedule("0 3 * * *", () => {
      void this.runAnalyticsSync();
    });

    this.thumbnailAbTask = cron.schedule("0 4 * * *", () => {
      void this.runThumbnailAbEvaluation();
    });

    console.log(
      "[scheduler] started; cron reload 5m, analytics 03:00 UTC, thumbnail A/B 04:00 UTC",
    );
  }

  async stop(): Promise<void> {
    this.reloadTask?.stop();
    this.analyticsTask?.stop();
    this.thumbnailAbTask?.stop();
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  private async runAnalyticsSync(): Promise<void> {
    try {
      const sync = new AnalyticsSyncService(this.platform);
      const result = await sync.syncAll();
      console.log(
        `[scheduler] analytics sync complete: ${result.videosUpdated} videos updated, ${result.errors.length} errors`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scheduler] analytics sync failed: ${message}`);
    }
  }

  private async runThumbnailAbEvaluation(): Promise<void> {
    try {
      const ab = new ThumbnailAbService(this.platform);
      const result = await ab.evaluateAndSwapAll();
      console.log(
        `[scheduler] thumbnail A/B evaluation: ${result.swapped}/${result.evaluated} swapped, ${result.errors.length} errors`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scheduler] thumbnail A/B evaluation failed: ${message}`);
    }
  }

  private async reloadJobs(): Promise<void> {
    try {
      for (const job of this.jobs.values()) {
        job.stop();
      }
      this.jobs.clear();

      const activeChannels = await this.channels.listActive();

      for (const channel of activeChannels) {
        if (!cron.validate(channel.upload_frequency)) {
          console.error(
            `[scheduler] invalid cron for channel ${channel.name} (${channel.id}): ${channel.upload_frequency}`,
          );
          continue;
        }

        const job = cron.schedule(channel.upload_frequency, () => {
          console.log(
            `[scheduler] triggering pipeline for channel ${channel.name} (${channel.id})`,
          );
          void runPipelineForChannel(this.orchestrator, channel.id);
        });

        this.jobs.set(channel.id, job);
        console.log(
          `[scheduler] registered cron "${channel.upload_frequency}" for channel ${channel.name}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scheduler] failed to reload jobs: ${message}`);
    }
  }
}
