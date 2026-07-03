import { buildServiceConfig } from "./config/channel-config";
import type { PlatformConfig } from "./config";
import { ChannelRepository } from "./db/repositories/channels";
import { TopicsUsedRepository } from "./db/repositories/topics-used";
import { VideoRepository } from "./db/repositories/videos";
import { LlmService } from "./services/llm";
import { runQualityGate } from "./services/quality-gate";
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

  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.channels = new ChannelRepository(platform.encryptionKey);
    this.videos = new VideoRepository();
    this.topicsUsed = new TopicsUsedRepository();
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
    const thumbnail = new ThumbnailService(serviceConfig);

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

      console.log("[pipeline] generating and uploading custom thumbnail...");
      try {
        const thumbnailPath = await thumbnail.generateThumbnail(
          payload,
          runDir,
          localVideoPath,
        );
        await youtube.uploadThumbnail(upload.videoId, thumbnailPath);
        thumbnailUploaded = true;
        console.log("[pipeline] custom thumbnail uploaded");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[pipeline] thumbnail step failed: ${message}`);
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
      });
      await this.topicsUsed.recordTopic(channel.id, payload.topic);

      if (serviceConfig.content.autoPublish && quality.passed) {
        console.log("[pipeline] auto-publishing (quality gate passed)...");
        await youtube.publishVideo(upload.videoId);
        await this.videos.markPublished(videoRecord.id);
        autoPublished = true;
        console.log("[pipeline] video published to public");
      } else if (serviceConfig.content.autoPublish && !quality.passed) {
        console.warn(
          `[pipeline] auto-publish skipped — quality gate failed: ${qualityNotes}`,
        );
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
      };
    } catch (error) {
      await this.videos.markFailed(videoRecord.id);
      throw error;
    } finally {
      await cleanupTmpDir(runDir);
      console.log(`[pipeline] cleaned up ${runDir}`);
    }
  }
}
