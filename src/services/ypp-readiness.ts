import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { VideoRepository } from "../db/repositories/videos";
import type { YppReadinessReport } from "../types/channel";
import { canAutoPublish, parseTemplateIds } from "../utils/template-picker";

export class YppReadinessService {
  private readonly channels: ChannelRepository;
  private readonly videos: VideoRepository;

  constructor(platform: PlatformConfig) {
    this.channels = new ChannelRepository(platform.encryptionKey);
    this.videos = new VideoRepository();
  }

  async evaluateChannel(channelId: string): Promise<YppReadinessReport | null> {
    const channel = await this.channels.findById(channelId);
    if (!channel) {
      return null;
    }

    const stats = await this.channels.getStats(channelId);
    const publishedCount = await this.videos.countPublishedLongForm(channelId);
    const videosThisWeek = await this.videos.countVideosThisWeek(channelId);
    const variationScore = await this.videos.getVariationScore(channelId);
    const avgAuth = await this.videos.getAverageAuthenticityScore(channelId);
    const avgRisk = await this.videos.getAverageInauthenticityRisk(channelId);
    const templatePool = parseTemplateIds(channel);

    const subsCount = Number(stats?.subs_count ?? 0);
    const watchHours = Number(stats?.watch_hours_total ?? 0);
    const monetizationEligible = stats?.monetization_eligible ?? false;
    const autoPublishAllowed = canAutoPublish(channel);

    const checklist = [
      {
        id: "video_count",
        label: "At least 15 published long-form videos",
        passed: publishedCount >= 15,
        detail: `${publishedCount} published`,
      },
      {
        id: "variation",
        label: "Title/topic variation score ≥ 60",
        passed: variationScore >= 60,
        detail: `Variation score: ${variationScore.toFixed(0)}/100`,
      },
      {
        id: "authenticity",
        label: "Average authenticity score ≥ 70",
        passed: avgAuth >= 70,
        detail: `Avg authenticity: ${avgAuth.toFixed(0)}/100`,
      },
      {
        id: "inauthenticity_risk",
        label: "Average inauthenticity risk ≤ 35",
        passed: avgRisk <= 35,
        detail: `Avg risk: ${avgRisk.toFixed(0)}/100 (lower is better)`,
      },
      {
        id: "manual_review",
        label: "Manual review track record (5+ manual publishes if review_mode=required)",
        passed:
          channel.review_mode !== "required" ||
          channel.manual_publish_count >= channel.min_manual_publishes_before_auto,
        detail: `${channel.manual_publish_count}/${channel.min_manual_publishes_before_auto} manual publishes`,
      },
      {
        id: "template_rotation",
        label: "Multiple Creatomate templates configured",
        passed: templatePool.length >= 2,
        detail: `${Math.max(templatePool.length, 1)} template(s) in rotation pool`,
      },
      {
        id: "slow_lane",
        label: "Publishing within weekly slow-lane limit",
        passed:
          channel.max_videos_per_week === 0 ||
          videosThisWeek <= channel.max_videos_per_week,
        detail: `${videosThisWeek}/${channel.max_videos_per_week || "∞"} videos this week`,
      },
      {
        id: "subs",
        label: "1,000+ subscribers",
        passed: subsCount >= 1000,
        detail: `${subsCount} subscribers`,
      },
      {
        id: "watch_hours",
        label: "4,000+ watch hours (last 12 months)",
        passed: watchHours >= 4000,
        detail: `${watchHours.toFixed(0)} watch hours`,
      },
    ];

    const passedCount = checklist.filter((item) => item.passed).length;
    const readinessScore = Math.round((passedCount / checklist.length) * 100);

    const recommendations: string[] = [];
    if (publishedCount < 15) {
      recommendations.push(
        "Publish 15–20 reviewed videos before applying to YPP — quality over speed.",
      );
    }
    if (variationScore < 60) {
      recommendations.push(
        "Topics and titles are too similar — diversify angles and sharpen niche_prompt with a unique POV.",
      );
    }
    if (avgAuth < 70) {
      recommendations.push(
        "Scripts lack original thesis and specific examples — reject low authenticity scores during review.",
      );
    }
    if (templatePool.length < 2) {
      recommendations.push(
        "Add 2–3 Creatomate templates to creatomate_template_ids to avoid template-spam signals.",
      );
    }
    if (!autoPublishAllowed && channel.auto_publish) {
      recommendations.push(
        "auto_publish is enabled but review_mode blocks it — complete manual publishes first.",
      );
    }
    if (channel.max_videos_per_week > 3) {
      recommendations.push(
        "Reduce max_videos_per_week to 2–3 pre-monetization to avoid mass-production flags.",
      );
    }

    return {
      channel_id: channel.id,
      channel_name: channel.name,
      readiness_score: readinessScore,
      ready_to_apply:
        readinessScore >= 70 &&
        publishedCount >= 15 &&
        variationScore >= 60 &&
        avgAuth >= 70 &&
        avgRisk <= 35,
      variation_score: variationScore,
      avg_authenticity_score: avgAuth,
      avg_inauthenticity_risk: avgRisk,
      published_video_count: publishedCount,
      manual_publish_count: channel.manual_publish_count,
      videos_this_week: videosThisWeek,
      max_videos_per_week: channel.max_videos_per_week,
      auto_publish_allowed: autoPublishAllowed,
      subs_count: subsCount,
      watch_hours_total: watchHours,
      monetization_eligible: monetizationEligible,
      checklist,
      recommendations,
    };
  }

  async evaluateAll(): Promise<YppReadinessReport[]> {
    const channels = await this.channels.listAll();
    const reports: YppReadinessReport[] = [];

    for (const channel of channels) {
      const report = await this.evaluateChannel(channel.id);
      if (report) {
        reports.push(report);
      }
    }

    return reports;
  }
}
