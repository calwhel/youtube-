import { buildServiceConfig } from "../config/channel-config";
import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { VideoRepository } from "../db/repositories/videos";
import { YouTubeService } from "./youtube";

export class AnalyticsSyncService {
  private readonly platform: PlatformConfig;
  private readonly channels: ChannelRepository;
  private readonly videos: VideoRepository;

  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.channels = new ChannelRepository(platform.encryptionKey);
    this.videos = new VideoRepository();
  }

  async syncAll(): Promise<{
    channelsProcessed: number;
    videosUpdated: number;
    errors: string[];
  }> {
    const channelList = await this.channels.listAll();
    let videosUpdated = 0;
    const errors: string[] = [];

    for (const channel of channelList) {
      try {
        const decrypted = await this.channels.findDecryptedById(channel.id);
        if (!decrypted) {
          continue;
        }

        const serviceConfig = buildServiceConfig(this.platform, decrypted);
        const youtube = new YouTubeService(serviceConfig);

        const stats = await youtube.fetchMonetizationStats();
        await this.channels.upsertStats(channel.id, {
          subs_count: stats.subsCount,
          watch_hours_total: stats.watchHoursTotal,
          monetization_eligible: stats.monetizationEligible,
        });

        if (
          stats.subsCount >= 800 &&
          stats.subsCount < 1000 &&
          stats.watchHoursTotal >= 3500
        ) {
          console.log(
            `[analytics] channel "${channel.name}" approaching monetization: ${stats.subsCount} subs, ${stats.watchHoursTotal.toFixed(0)} watch hours`,
          );
        }

        const syncable = await this.videos.listForAnalyticsSync(channel.id);
        for (const video of syncable) {
          if (!video.youtube_video_id) {
            continue;
          }

          try {
            const analytics = await youtube.fetchVideoAnalytics(
              video.youtube_video_id,
            );
            await this.videos.updateAnalytics(video.id, analytics);
            videosUpdated += 1;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            errors.push(
              `video ${video.id} (${video.youtube_video_id}): ${message}`,
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`channel ${channel.id}: ${message}`);
      }
    }

    return {
      channelsProcessed: channelList.length,
      videosUpdated,
      errors,
    };
  }
}
