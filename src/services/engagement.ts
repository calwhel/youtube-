import type { ServiceConfig } from "../config/channel-config";
import type { VideoPayload } from "../types/video";
import type { YouTubeService } from "./youtube";

export interface EngagementContext {
  payload: VideoPayload;
  youtubeVideoId: string;
  videoUrl: string;
  relatedVideoUrl?: string | null;
}

export class EngagementService {
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  async apply(
    youtube: YouTubeService,
    context: EngagementContext,
  ): Promise<{ pinnedCommentId: string | null }> {
    if (!this.config.content.enableEngagement) {
      return { pinnedCommentId: null };
    }

    let pinnedCommentId: string | null = null;

    if (this.config.content.defaultPlaylistId) {
      try {
        await youtube.addVideoToPlaylist(
          this.config.content.defaultPlaylistId,
          context.youtubeVideoId,
        );
        console.log(
          `[engagement] added video to playlist ${this.config.content.defaultPlaylistId}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[engagement] playlist insert failed: ${message}`);
      }
    }

    if (context.relatedVideoUrl) {
      try {
        await youtube.appendWatchNextToDescription(
          context.youtubeVideoId,
          context.relatedVideoUrl,
        );
        console.log("[engagement] appended watch-next link to description");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[engagement] description update failed: ${message}`);
      }
    }

    if (context.payload.pinned_comment?.trim()) {
      try {
        pinnedCommentId = await youtube.postPinnedComment(
          context.youtubeVideoId,
          context.payload.pinned_comment.trim(),
        );
        console.log(`[engagement] pinned comment posted: ${pinnedCommentId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[engagement] pinned comment failed: ${message}`);
      }
    }

    return { pinnedCommentId };
  }
}
