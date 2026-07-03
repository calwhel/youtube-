import { buildServiceConfig } from "./config/channel-config";
import type { PlatformConfig } from "./config";
import { ChannelRepository } from "./db/repositories/channels";
import { TopicsUsedRepository } from "./db/repositories/topics-used";
import { VideoRepository } from "./db/repositories/videos";
import { LlmService } from "./services/llm";
import { NotificationService } from "./services/notifications";
import { PublishFinalizer } from "./services/publish-finalizer";
import { runQualityGate } from "./services/quality-gate";
import { ShortsService } from "./services/shorts";
import { ThumbnailService } from "./services/thumbnail";
import { TopicResearchService } from "./services/topic-research";
import { VideoService } from "./services/video";
import { VoiceService } from "./services/voice";
import { YouTubeService } from "./services/youtube";
import type { PipelineResult } from "./types/video";
import { estimatePipelineCostUsd } from "./utils/cost";
import { cleanupTmpDir, ensureTmpDir } from "./utils/tmp";

export interface RunPipelineOptions {
  channelId: string;
  topic?: string;
}

export class PipelineOrchestrator {
  private readonly platform: PlatformConfig;
  private readonly channels: ChannelRepository;
  private readonly videos: VideoRepository;
  private readonly topicsUsed: TopicsUsedRepository;
  private readonly notifications: NotificationService;
  private readonly publishFinalizer: PublishFinalizer;

  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.channels = new ChannelRepository(platform.encryptionKey);
    this.videos = new VideoRepository();
    this.topicsUsed = new TopicsUsedRepository();
    this.notifications = new NotificationService(platform);
    this.publishFinalizer = new PublishFinalizer(platform);
  }

  async run(options: RunPipelineOptions): Promise<PipelineResult> {
    const channel = await this.channels.findDecryptedById(options.channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${options.channelId}`);
    }

    if (channel.status !== "active") {
      throw new Error(
        `Channel "${channel.name}" is ${channel.status}; pipeline aborted`,
      );
    }

    const monthlySpend = await this.channels.getMonthlySpend(channel.id);
    const monthlyBudget = Number(channel.monthly_budget_usd);
    const estimatedCost = estimatePipelineCostUsd();

    if (monthlyBudget > 0 && monthlySpend + estimatedCost > monthlyBudget) {
      throw new Error(
        `Monthly budget exceeded for channel "${channel.name}" (${monthlySpend.toFixed(2)} / ${monthlyBudget.toFixed(2)} USD)`,
      );
    }

    const serviceConfig = buildServiceConfig(this.platform, channel);
    const topicResearch = new TopicResearchService(serviceConfig);
    const llm = new LlmService(serviceConfig);
    const voice = new VoiceService(serviceConfig);
    const video = new VideoService(serviceConfig);
    const youtube = new YouTubeService(serviceConfig);
    const thumbnail = new ThumbnailService(serviceConfig, this.platform);
    const shorts = new ShortsService(serviceConfig);

    const excludedTopics = await this.topicsUsed.listTopicTexts(channel.id);
    const topPerformers = await this.videos.getTopPerformingTopics(channel.id);

    const selectedTopic = await topicResearch.selectTopic({
      excludedTopics,
      topPerformers,
      forcedTopic: options.topic,
    });

    const videoRecord = await this.videos.createProcessing(
      channel.id,
      selectedTopic,
    );

    const runDir = await ensureTmpDir(this.platform);
    console.log(
      `[pipeline] channel=${channel.name} (${channel.id}) run=${videoRecord.id} topic="${selectedTopic}" dir=${runDir}`,
    );

    let autoPublished = false;
    let thumbnailUploaded = false;
    let qualityScore: number | null = null;
    let qualityNotes: string | null = null;
    let shortVideoId: string | null = null;
    let shortVideoUrl: string | null = null;
    let engagementApplied = false;

    try {
      console.log("[pipeline] generating retention-optimized script...");
      const payload = await llm.generateScript({
        selectedTopic,
        excludedTopics,
      });
      console.log(
        `[pipeline] script ready: title="${payload.title}" scenes=${payload.scenes.length}`,
      );

      console.log("[pipeline] synthesizing per-scene voiceover...");
      const { voiceoverPath } = await voice.synthesizeVoiceover(payload, runDir);
      console.log(`[pipeline] voiceover saved: ${voiceoverPath}`);

      console.log("[pipeline] rendering video...");
      const { renderedVideoUrl, localVideoPath } = await video.renderVideo(
        payload,
        voiceoverPath,
        runDir,
      );
      console.log(`[pipeline] video rendered: ${renderedVideoUrl}`);

      console.log("[pipeline] uploading to YouTube...");
      const upload = await youtube.uploadVideo(payload, localVideoPath);
      console.log(
        `[pipeline] upload complete (${upload.privacyStatus}): ${upload.videoUrl}`,
      );

      console.log("[pipeline] generating thumbnail variants...");
      try {
        if (serviceConfig.content.enableAbThumbnails) {
          const variants = await thumbnail.generateVariants(
            payload,
            runDir,
            localVideoPath,
          );
          await youtube.uploadThumbnail(upload.videoId, variants.variantAPath);
          thumbnailUploaded = true;
          console.log("[pipeline] thumbnail variant A uploaded");
        } else {
          const thumbnailPath = await thumbnail.generateThumbnail(
            payload,
            runDir,
            localVideoPath,
          );
          await youtube.uploadThumbnail(upload.videoId, thumbnailPath);
          thumbnailUploaded = true;
          console.log("[pipeline] custom thumbnail uploaded");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[pipeline] thumbnail step failed: ${message}`);
      }

      if (serviceConfig.content.autoGenerateShorts) {
        try {
          console.log("[pipeline] generating Shorts derivative...");
          const clipPlan = shorts.planClip(payload);
          const shortPath = await shorts.extractVerticalClip(
            localVideoPath,
            clipPlan,
            runDir,
          );
          const shortUpload = await shorts.uploadShort(
            youtube,
            payload,
            shortPath,
            clipPlan,
            upload.videoUrl,
          );
          shortVideoId = shortUpload.videoId;
          shortVideoUrl = shortUpload.videoUrl;
          console.log(`[pipeline] Shorts uploaded: ${shortVideoUrl}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[pipeline] Shorts generation failed: ${message}`);
        }
      }

      const quality = runQualityGate(payload, serviceConfig.content, {
        thumbnailUploaded,
      });
      qualityScore = quality.score;
      qualityNotes = quality.notes.length > 0 ? quality.notes.join("; ") : null;

      console.log(
        `[pipeline] quality gate score=${quality.score} passed=${quality.passed}`,
      );

      const costUsd = estimatePipelineCostUsd();
      await this.videos.markPrivate(videoRecord.id, {
        topic: payload.topic,
        title: payload.title,
        youtubeVideoId: upload.videoId,
        costUsd,
        thumbnailUploaded,
        qualityScore,
        qualityNotes,
        thumbnailBText: serviceConfig.content.enableAbThumbnails
          ? payload.thumbnail_b_text
          : null,
        thumbnailBPrompt: serviceConfig.content.enableAbThumbnails
          ? payload.thumbnail_b_prompt
          : null,
        shortYoutubeVideoId: shortVideoId,
        pinnedCommentText: payload.pinned_comment,
      });
      await this.topicsUsed.recordTopic(channel.id, payload.topic);

      if (serviceConfig.content.autoPublish && quality.passed) {
        console.log("[pipeline] auto-publishing (quality gate passed)...");
        await this.publishFinalizer.finalize({
          dbVideoId: videoRecord.id,
          channelId: channel.id,
          youtubeVideoId: upload.videoId,
          shortYoutubeVideoId: shortVideoId,
        });
        autoPublished = true;
        engagementApplied = true;
        console.log("[pipeline] video published to public");
      } else {
        await this.notifications.notify({
          event: "pending_review",
          channelName: channel.name,
          title: payload.title,
          topic: payload.topic,
          videoUrl: upload.videoUrl,
          qualityScore,
          qualityNotes,
        });
      }

      return {
        videoId: upload.videoId,
        videoUrl: upload.videoUrl,
        title: payload.title,
        topic: payload.topic,
        privacyStatus: autoPublished ? "public" : upload.privacyStatus,
        dbVideoId: videoRecord.id,
        costUsd,
        thumbnailUploaded,
        autoPublished,
        qualityScore,
        qualityNotes,
        shortVideoId,
        shortVideoUrl,
        thumbnailVariant: "A",
        engagementApplied,
      };
    } catch (error) {
      await this.videos.markFailed(videoRecord.id);
      const message = error instanceof Error ? error.message : String(error);
      await this.notifications.notify({
        event: "pipeline_failed",
        channelName: channel.name,
        topic: selectedTopic,
        error: message,
      });
      throw error;
    } finally {
      await cleanupTmpDir(runDir);
      console.log(`[pipeline] cleaned up ${runDir}`);
    }
  }
}
