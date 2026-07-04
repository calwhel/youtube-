import { createReadStream } from "node:fs";
import { google, type youtubeAnalytics_v2, type youtube_v3 } from "googleapis";

import type { ServiceConfig } from "../config/channel-config";
import type { VideoAnalyticsUpdate, VideoPayload } from "../types/video";
import { buildDescriptionWithChapters } from "./quality-gate";
import { withRetry } from "../utils/tmp";
import { formatYouTubeAuthError } from "../utils/youtube-auth-error";

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  privacyStatus: string;
}

export interface ChannelMonetizationStats {
  subsCount: number;
  watchHoursTotal: number;
  monetizationEligible: boolean;
}

export class YouTubeService {
  private readonly config: ServiceConfig;
  private readonly youtube: youtube_v3.Youtube;
  private readonly oauth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(config: ServiceConfig) {
    this.config = config;

    this.oauth2Client = new google.auth.OAuth2(
      config.youtube.clientId,
      config.youtube.clientSecret,
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.youtube.refreshToken,
    });

    this.youtube = google.youtube({
      version: "v3",
      auth: this.oauth2Client,
    });
  }

  private getAnalyticsClient(): youtubeAnalytics_v2.Youtubeanalytics {
    return google.youtubeAnalytics({
      version: "v2",
      auth: this.oauth2Client,
    });
  }

  async verifyConnection(): Promise<{ ok: true; channelTitle: string | null }> {
    try {
      const response = await this.youtube.channels.list({
        part: ["snippet"],
        mine: true,
        maxResults: 1,
      });

      const title = response.data.items?.[0]?.snippet?.title ?? null;
      return { ok: true, channelTitle: title };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(formatYouTubeAuthError(message));
    }
  }

  async uploadVideo(
    payload: VideoPayload,
    localVideoPath: string,
  ): Promise<YouTubeUploadResult> {
    return withRetry(
      async () => {
        const privacyStatus = this.config.youtube.privacyStatus;
        // Unlisted allows in-dashboard embed preview; publish step sets public
        const uploadPrivacy =
          privacyStatus === "private" ? "unlisted" : privacyStatus;
        const description = buildDescriptionWithChapters(payload);

        const response = await this.youtube.videos.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: {
              title: payload.title,
              description,
              tags: payload.tags,
              categoryId: this.config.youtube.categoryId,
            },
            status: {
              privacyStatus: uploadPrivacy,
              selfDeclaredMadeForKids: false,
              containsSyntheticMedia:
                this.config.youtube.discloseSyntheticMedia,
            } as youtube_v3.Schema$VideoStatus & {
              containsSyntheticMedia?: boolean;
            },
          },
          media: {
            body: createReadStream(localVideoPath),
          },
        });

        const videoId = response.data.id;
        if (!videoId) {
          throw new Error("YouTube upload succeeded but no video ID returned");
        }

        return {
          videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          privacyStatus: uploadPrivacy,
        };
      },
      {
        ...this.config.retry,
        label: "youtube-upload",
      },
    );
  }

  async uploadShortVideo(input: {
    title: string;
    description: string;
    tags: string[];
    localVideoPath: string;
  }): Promise<YouTubeUploadResult> {
    return withRetry(
      async () => {
        const privacyStatus = this.config.youtube.privacyStatus;

        const response = await this.youtube.videos.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: {
              title: input.title.slice(0, 100),
              description: input.description,
              tags: input.tags,
              categoryId: this.config.youtube.categoryId,
            },
            status: {
              privacyStatus,
              selfDeclaredMadeForKids: false,
              containsSyntheticMedia:
                this.config.youtube.discloseSyntheticMedia,
            } as youtube_v3.Schema$VideoStatus & {
              containsSyntheticMedia?: boolean;
            },
          },
          media: {
            body: createReadStream(input.localVideoPath),
          },
        });

        const videoId = response.data.id;
        if (!videoId) {
          throw new Error("YouTube Shorts upload succeeded but no video ID returned");
        }

        return {
          videoId,
          videoUrl: `https://www.youtube.com/shorts/${videoId}`,
          privacyStatus,
        };
      },
      {
        ...this.config.retry,
        label: "youtube-shorts-upload",
      },
    );
  }

  async addVideoToPlaylist(
    playlistId: string,
    youtubeVideoId: string,
  ): Promise<void> {
    await withRetry(
      async () => {
        await this.youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: "youtube#video",
                videoId: youtubeVideoId,
              },
            },
          },
        });
      },
      {
        ...this.config.retry,
        label: "youtube-playlist-insert",
      },
    );
  }

  async appendWatchNextToDescription(
    youtubeVideoId: string,
    relatedVideoUrl: string,
  ): Promise<void> {
    await withRetry(
      async () => {
        const current = await this.youtube.videos.list({
          part: ["snippet"],
          id: [youtubeVideoId],
        });

        const snippet = current.data.items?.[0]?.snippet;
        if (!snippet) {
          throw new Error("Video snippet not found for description update");
        }

        const watchNextBlock = `\n\n▶ Watch Next: ${relatedVideoUrl}`;
        const description = snippet.description?.includes(relatedVideoUrl)
          ? snippet.description
          : `${snippet.description ?? ""}${watchNextBlock}`.trim();

        await this.youtube.videos.update({
          part: ["snippet"],
          requestBody: {
            id: youtubeVideoId,
            snippet: {
              ...snippet,
              description,
            },
          },
        });
      },
      {
        ...this.config.retry,
        label: "youtube-description-update",
      },
    );
  }

  async postPinnedComment(
    youtubeVideoId: string,
    commentText: string,
  ): Promise<string> {
    return withRetry(
      async () => {
        const thread = await this.youtube.commentThreads.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              videoId: youtubeVideoId,
              topLevelComment: {
                snippet: {
                  textOriginal: commentText,
                },
              },
            },
          },
        });

        const commentId = thread.data.id;
        if (!commentId) {
          throw new Error("Comment thread created but no ID returned");
        }

        return commentId;
      },
      {
        ...this.config.retry,
        label: "youtube-pinned-comment",
      },
    );
  }

  async uploadThumbnail(
    youtubeVideoId: string,
    thumbnailPath: string,
  ): Promise<void> {
    await withRetry(
      async () => {
        await this.youtube.thumbnails.set({
          videoId: youtubeVideoId,
          media: {
            body: createReadStream(thumbnailPath),
          },
        });
      },
      {
        ...this.config.retry,
        label: "youtube-thumbnail-upload",
      },
    );
  }

  async updateVideoMetadata(
    youtubeVideoId: string,
    input: {
      title?: string;
      description?: string;
      tags?: string[];
    },
  ): Promise<void> {
    await withRetry(
      async () => {
        const current = await this.youtube.videos.list({
          part: ["snippet"],
          id: [youtubeVideoId],
        });

        const snippet = current.data.items?.[0]?.snippet;
        if (!snippet) {
          throw new Error("Video snippet not found for metadata update");
        }

        await this.youtube.videos.update({
          part: ["snippet"],
          requestBody: {
            id: youtubeVideoId,
            snippet: {
              ...snippet,
              title: input.title ?? snippet.title,
              description: input.description ?? snippet.description,
              tags: input.tags ?? snippet.tags ?? undefined,
            },
          },
        });
      },
      {
        ...this.config.retry,
        label: "youtube-metadata-update",
      },
    );
  }

  async publishVideo(youtubeVideoId: string): Promise<void> {
    await withRetry(
      async () => {
        await this.youtube.videos.update({
          part: ["status"],
          requestBody: {
            id: youtubeVideoId,
            status: {
              privacyStatus: "public",
              selfDeclaredMadeForKids: false,
            },
          },
        });
      },
      {
        ...this.config.retry,
        label: "youtube-publish",
      },
    );
  }

  async fetchMonetizationStats(): Promise<ChannelMonetizationStats> {
    const channelResponse = await this.youtube.channels.list({
      part: ["statistics"],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];
    const subsCount = Number(channel?.statistics?.subscriberCount ?? 0);

    let watchHoursTotal = 0;

    try {
      const analytics = this.getAnalyticsClient();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const formatDate = (date: Date): string =>
        date.toISOString().slice(0, 10);

      const analyticsResponse = await analytics.reports.query({
        ids: "channel==MINE",
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        metrics: "estimatedMinutesWatched",
      });

      const minutesWatched = Number(
        analyticsResponse.data.rows?.[0]?.[0] ?? 0,
      );
      watchHoursTotal = minutesWatched / 60;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[youtube] analytics unavailable for channel ${this.config.channelId}: ${message}`,
      );
    }

    const monetizationEligible = subsCount >= 1000 && watchHoursTotal >= 4000;

    return {
      subsCount,
      watchHoursTotal,
      monetizationEligible,
    };
  }

  async fetchVideoAnalytics(
    youtubeVideoId: string,
  ): Promise<VideoAnalyticsUpdate> {
    const statsResponse = await this.youtube.videos.list({
      part: ["statistics"],
      id: [youtubeVideoId],
    });

    const item = statsResponse.data.items?.[0];
    const viewCount = Number(item?.statistics?.viewCount ?? 0);

    let ctr = 0;
    let impressions = 0;
    let avgViewDurationSeconds = 0;

    try {
      const analytics = this.getAnalyticsClient();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 28);

      const formatDate = (date: Date): string =>
        date.toISOString().slice(0, 10);

      const report = await analytics.reports.query({
        ids: "channel==MINE",
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        metrics:
          "views,impressions,clickThroughRate,averageViewDuration",
        filters: `video==${youtubeVideoId}`,
      });

      const row = report.data.rows?.[0];
      if (row) {
        impressions = Number(row[1] ?? 0);
        ctr = Number(row[2] ?? 0);
        avgViewDurationSeconds = Number(row[3] ?? 0);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[youtube] video analytics unavailable for ${youtubeVideoId}: ${message}`,
      );
    }

    return {
      view_count: viewCount,
      ctr,
      avg_view_duration_seconds: avgViewDurationSeconds,
      impressions,
    };
  }
}
