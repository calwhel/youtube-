import { buildServiceConfig } from "../config/channel-config";
import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { VideoRepository } from "../db/repositories/videos";
import { NotificationService } from "./notifications";
import { YouTubeService } from "./youtube";

export class AnalyticsSyncService {
  private readonly platform: PlatformConfig;
  private readonly channels: ChannelRepository;
  private readonly videos: VideoRepository;
  private readonly notifications: NotificationService;

  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.channels = new ChannelRepository(platform.encryptionKey);
    this.videos = new VideoRepository();
    this.notifications = new NotificationService(platform);
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
        const statsBefore = await this.channels.getStatsRaw(channel.id);

        const stats = await youtube.fetchMonetizationStats();
        await this.channels.upsertStats(channel.id, {
          subs_count: stats.subsCount,
          watch_hours_total: stats.watchHoursTotal,
          monetization_eligible: stats.monetizationEligible,
          monetization_alert_sent: statsBefore?.monetization_alert_sent ?? false,
        });

        await this.notifyMonetizationMilestones(
          channel.name,
          channel.id,
          stats,
          statsBefore?.monetization_alert_sent ?? false,
        );

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

  private async notifyMonetizationMilestones(
    channelName: string,
    channelId: string,
    stats: {
      subsCount: number;
      watchHoursTotal: number;
      monetizationEligible: boolean;
    },
    alertAlreadySent: boolean,
  ): Promise<void> {
    if (stats.monetizationEligible && !alertAlreadySent) {
      await this.notifications.notify({
        event: "monetization_eligible",
        channelName,
        subsCount: stats.subsCount,
        watchHours: stats.watchHoursTotal,
        details: "Channel meets YouTube Partner Program thresholds (1K subs + 4K watch hours)",
      });
      await this.channels.markMonetizationAlertSent(channelId);
      return;
    }

    if (
      !alertAlreadySent &&
      stats.subsCount >= 800 &&
      stats.subsCount < 1000 &&
      stats.watchHoursTotal >= 3500
    ) {
      await this.notifications.notify({
        event: "monetization_approaching",
        channelName,
        subsCount: stats.subsCount,
        watchHours: stats.watchHoursTotal,
        details: "Approaching monetization — push for 1K subs and 4K watch hours",
      });
      await this.channels.markMonetizationAlertSent(channelId);
    }
  }
}
