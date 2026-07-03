import { buildServiceConfig } from "../config/channel-config";
import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { VideoRepository } from "../db/repositories/videos";
import { ThumbnailService } from "./thumbnail";
import { YouTubeService } from "./youtube";
import { NotificationService } from "./notifications";

export class ThumbnailAbService {
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

  async evaluateAndSwapAll(): Promise<{
    evaluated: number;
    swapped: number;
    errors: string[];
  }> {
    const candidates = await this.videos.listAbSwapCandidates();
    let swapped = 0;
    const errors: string[] = [];

    for (const video of candidates) {
      try {
        const channel = await this.channels.findDecryptedById(video.channel_id);
        if (!channel || !channel.enable_ab_thumbnails) {
          continue;
        }

        if (!video.thumbnail_b_text || !video.thumbnail_b_prompt) {
          continue;
        }

        const channelAvgCtr = await this.videos.getChannelAverageCtr(
          video.channel_id,
        );
        const videoCtr = Number(video.ctr);
        const impressions = Number(video.impressions);

        if (impressions < 100) {
          continue;
        }

        const underperforming =
          channelAvgCtr > 0 ? videoCtr < channelAvgCtr * 0.85 : videoCtr < 0.03;

        if (!underperforming) {
          continue;
        }

        const serviceConfig = buildServiceConfig(this.platform, channel);
        const thumbnail = new ThumbnailService(serviceConfig, this.platform);
        const youtube = new YouTubeService(serviceConfig);

        const variantBPath = await thumbnail.generateVariantB(
          {
            topic: video.topic ?? "",
            title: video.title ?? "",
            description: "",
            tags: [],
            thumbnail_prompt: video.thumbnail_b_prompt,
            thumbnail_text: video.thumbnail_b_text,
            thumbnail_b_prompt: video.thumbnail_b_prompt,
            thumbnail_b_text: video.thumbnail_b_text,
            short_title: "",
            pinned_comment: "",
            unique_thesis: video.unique_thesis ?? "",
            contrarian_angle: "",
            creator_perspective: "",
            specific_examples: [],
            sources_cited: [],
            scenes: [],
          },
          video.id,
        );

        if (!video.youtube_video_id) {
          continue;
        }

        await youtube.uploadThumbnail(video.youtube_video_id, variantBPath);
        await this.videos.markThumbnailSwapped(video.id);
        swapped += 1;

        await this.notifications.notify({
          event: "thumbnail_ab_swap",
          channelName: channel.name,
          title: video.title ?? undefined,
          videoUrl: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
          details: `Swapped to variant B (CTR ${(videoCtr * 100).toFixed(2)}% vs channel avg ${(channelAvgCtr * 100).toFixed(2)}%)`,
        });

        console.log(
          `[thumbnail-ab] swapped video ${video.id} to variant B (ctr=${videoCtr}, avg=${channelAvgCtr})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`video ${video.id}: ${message}`);
      }
    }

    return { evaluated: candidates.length, swapped, errors };
  }
}
