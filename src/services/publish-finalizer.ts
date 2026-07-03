import { buildServiceConfig } from "../config/channel-config";
import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { VideoRepository } from "../db/repositories/videos";
import { EngagementService } from "./engagement";
import { NotificationService } from "./notifications";
import { YouTubeService } from "./youtube";

export interface FinalizePublishInput {
  dbVideoId: string;
  channelId: string;
  youtubeVideoId: string;
  shortYoutubeVideoId?: string | null;
}

export class PublishFinalizer {
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

  async finalize(input: FinalizePublishInput): Promise<void> {
    const channel = await this.channels.findDecryptedById(input.channelId);
    const video = await this.videos.findById(input.dbVideoId);

    if (!channel || !video) {
      throw new Error("Channel or video not found for publish finalization");
    }

    const serviceConfig = buildServiceConfig(this.platform, channel);
    const youtube = new YouTubeService(serviceConfig);

    await youtube.publishVideo(input.youtubeVideoId);

    if (input.shortYoutubeVideoId) {
      try {
        await youtube.publishVideo(input.shortYoutubeVideoId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[publish] short publish failed: ${message}`);
      }
    }

    await this.videos.markPublished(input.dbVideoId);

    if (!video.engagement_applied && video.title && video.topic) {
      const previousPublished = await this.videos.getLatestPublishedVideo(
        input.channelId,
        input.dbVideoId,
      );

      const engagement = new EngagementService(serviceConfig);
      const { pinnedCommentId } = await engagement.apply(youtube, {
        payload: {
          topic: video.topic,
          title: video.title,
          description: "",
          tags: [],
          thumbnail_prompt: "",
          thumbnail_text: "",
          thumbnail_b_prompt: video.thumbnail_b_prompt ?? "",
          thumbnail_b_text: video.thumbnail_b_text ?? "",
          short_title: "",
          pinned_comment:
            video.pinned_comment_text ??
            `What surprised you most about ${video.topic}? Drop a comment below.`,
          scenes: [],
        },
        youtubeVideoId: input.youtubeVideoId,
        videoUrl: `https://www.youtube.com/watch?v=${input.youtubeVideoId}`,
        relatedVideoUrl: previousPublished?.youtube_video_id
          ? `https://www.youtube.com/watch?v=${previousPublished.youtube_video_id}`
          : null,
      });

      await this.videos.markEngagementApplied(input.dbVideoId, pinnedCommentId);
    }

    await this.notifications.notify({
      event: "published",
      channelName: channel.name,
      title: video.title ?? undefined,
      topic: video.topic ?? undefined,
      videoUrl: `https://www.youtube.com/watch?v=${input.youtubeVideoId}`,
      qualityScore: video.quality_score ? Number(video.quality_score) : null,
    });
  }
}
