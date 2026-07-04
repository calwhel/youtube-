import type {
  CostSummaryRow,
  PendingVideoView,
  TopPerformingTopic,
  VideoAnalyticsUpdate,
  VideoRecord,
  VideoReviewView,
  VideoStatus,
} from "../../types/video";
import { query, queryOne } from "../pool";

export class VideoRepository {
  async createProcessing(
    channelId: string,
    topic: string | null,
  ): Promise<VideoRecord> {
    const row = await queryOne<VideoRecord>(
      `
      INSERT INTO videos (channel_id, topic, status, video_type)
      VALUES ($1, $2, 'processing', 'long')
      RETURNING *
      `,
      [channelId, topic],
    );

    if (!row) {
      throw new Error("Failed to create video record");
    }

    return row;
  }

  async markPrivate(
    videoId: string,
    data: {
      topic: string;
      title: string;
      youtubeVideoId: string;
      costUsd: number;
      thumbnailUploaded: boolean;
      qualityScore: number | null;
      qualityNotes: string | null;
      thumbnailBText: string | null;
      thumbnailBPrompt: string | null;
      shortYoutubeVideoId: string | null;
      pinnedCommentText: string | null;
      uniqueThesis: string | null;
      authenticityScore: number | null;
      inauthenticityRiskScore: number | null;
      creatomateTemplateUsed: string | null;
      sourcesCited: string[] | null;
      description: string | null;
      tags: string[] | null;
      thumbnailText: string | null;
      shortTitle: string | null;
    },
  ): Promise<VideoRecord | null> {
    return queryOne<VideoRecord>(
      `
      UPDATE videos
      SET
        topic = $2,
        title = $3,
        status = 'private',
        youtube_video_id = $4,
        cost_usd = $5,
        thumbnail_uploaded = $6,
        quality_score = $7,
        quality_notes = $8,
        thumbnail_b_text = $9,
        thumbnail_b_prompt = $10,
        short_youtube_video_id = $11,
        pinned_comment_text = $12,
        unique_thesis = $13,
        authenticity_score = $14,
        inauthenticity_risk_score = $15,
        creatomate_template_used = $16,
        sources_cited = $17,
        description = $18,
        tags = $19,
        thumbnail_text = $20,
        short_title = $21
      WHERE id = $1
      RETURNING *
      `,
      [
        videoId,
        data.topic,
        data.title,
        data.youtubeVideoId,
        data.costUsd,
        data.thumbnailUploaded,
        data.qualityScore,
        data.qualityNotes,
        data.thumbnailBText,
        data.thumbnailBPrompt,
        data.shortYoutubeVideoId,
        data.pinnedCommentText,
        data.uniqueThesis,
        data.authenticityScore,
        data.inauthenticityRiskScore,
        data.creatomateTemplateUsed,
        data.sourcesCited ? JSON.stringify(data.sourcesCited) : null,
        data.description,
        data.tags ? JSON.stringify(data.tags) : null,
        data.thumbnailText,
        data.shortTitle,
      ],
    );
  }

  async updateReviewMetadata(
    videoId: string,
    data: {
      title?: string;
      description?: string;
      tags?: string[];
    },
  ): Promise<VideoRecord | null> {
    const existing = await this.findById(videoId);
    if (!existing) {
      return null;
    }

    return queryOne<VideoRecord>(
      `
      UPDATE videos
      SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        tags = COALESCE($4, tags)
      WHERE id = $1
      RETURNING *
      `,
      [
        videoId,
        data.title ?? null,
        data.description ?? null,
        data.tags ? JSON.stringify(data.tags) : null,
      ],
    );
  }

  async findReviewById(videoId: string): Promise<VideoReviewView | null> {
    const row = await queryOne<{
      id: string;
      channel_id: string;
      channel_name: string;
      topic: string | null;
      title: string | null;
      description: string | null;
      tags: unknown;
      thumbnail_text: string | null;
      pinned_comment_text: string | null;
      status: VideoStatus;
      youtube_video_id: string | null;
      short_youtube_video_id: string | null;
      created_at: Date;
      cost_usd: string;
      quality_score: string | null;
      quality_notes: string | null;
      authenticity_score: string | null;
      inauthenticity_risk_score: string | null;
      thumbnail_uploaded: boolean;
      unique_thesis: string | null;
    }>(
      `
      SELECT
        v.id,
        v.channel_id,
        c.name AS channel_name,
        v.topic,
        v.title,
        v.description,
        v.tags,
        v.thumbnail_text,
        v.pinned_comment_text,
        v.status,
        v.youtube_video_id,
        v.short_youtube_video_id,
        v.created_at,
        v.cost_usd,
        v.quality_score,
        v.quality_notes,
        v.authenticity_score,
        v.inauthenticity_risk_score,
        v.thumbnail_uploaded,
        v.unique_thesis
      FROM videos v
      INNER JOIN channels c ON c.id = v.channel_id
      WHERE v.id = $1
        AND v.video_type = 'long'
      `,
      [videoId],
    );

    if (!row) {
      return null;
    }

    const tags = Array.isArray(row.tags)
      ? row.tags.filter((t): t is string => typeof t === "string")
      : [];

    const ytId = row.youtube_video_id;

    return {
      id: row.id,
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      topic: row.topic,
      title: row.title,
      description: row.description,
      tags,
      thumbnail_text: row.thumbnail_text,
      pinned_comment_text: row.pinned_comment_text,
      status: row.status,
      youtube_video_id: ytId,
      short_youtube_video_id: row.short_youtube_video_id,
      youtube_embed_url: ytId ? `https://www.youtube.com/embed/${ytId}` : null,
      youtube_watch_url: ytId ? `https://www.youtube.com/watch?v=${ytId}` : null,
      thumbnail_url: ytId
        ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
        : null,
      created_at: row.created_at.toISOString(),
      cost_usd: Number(row.cost_usd),
      quality_score: row.quality_score ? Number(row.quality_score) : null,
      quality_notes: row.quality_notes,
      authenticity_score: row.authenticity_score
        ? Number(row.authenticity_score)
        : null,
      inauthenticity_risk_score: row.inauthenticity_risk_score
        ? Number(row.inauthenticity_risk_score)
        : null,
      thumbnail_uploaded: row.thumbnail_uploaded,
      unique_thesis: row.unique_thesis,
    };
  }

  async markFailed(videoId: string, errorMessage?: string): Promise<void> {
    await query(
      `
      UPDATE videos
      SET
        status = 'failed',
        quality_notes = COALESCE($2, quality_notes)
      WHERE id = $1
      `,
      [videoId, errorMessage ?? null],
    );
  }

  async markPublished(videoId: string): Promise<VideoRecord | null> {
    return queryOne<VideoRecord>(
      `
      UPDATE videos
      SET
        status = 'published',
        published_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [videoId],
    );
  }

  async markEngagementApplied(
    videoId: string,
    pinnedCommentId: string | null,
  ): Promise<void> {
    await query(
      `
      UPDATE videos
      SET
        engagement_applied = TRUE,
        pinned_comment_id = COALESCE($2, pinned_comment_id)
      WHERE id = $1
      `,
      [videoId, pinnedCommentId],
    );
  }

  async markThumbnailSwapped(videoId: string): Promise<void> {
    await query(
      `
      UPDATE videos
      SET
        thumbnail_variant = 'B',
        thumbnail_swapped_at = NOW()
      WHERE id = $1
      `,
      [videoId],
    );
  }

  async findById(videoId: string): Promise<VideoRecord | null> {
    return queryOne<VideoRecord>(
      `SELECT * FROM videos WHERE id = $1`,
      [videoId],
    );
  }

  async getLatestPublishedVideo(
    channelId: string,
    excludeVideoId: string,
  ): Promise<VideoRecord | null> {
    return queryOne<VideoRecord>(
      `
      SELECT *
      FROM videos
      WHERE channel_id = $1
        AND id <> $2
        AND status = 'published'
        AND video_type = 'long'
        AND youtube_video_id IS NOT NULL
      ORDER BY published_at DESC NULLS LAST
      LIMIT 1
      `,
      [channelId, excludeVideoId],
    );
  }

  async listPending(): Promise<PendingVideoView[]> {
    const rows = await query<{
      id: string;
      channel_id: string;
      channel_name: string;
      topic: string | null;
      title: string | null;
      status: VideoStatus;
      youtube_video_id: string | null;
      created_at: Date;
      cost_usd: string;
      view_count: string;
      ctr: string;
      thumbnail_uploaded: boolean;
      quality_score: string | null;
      short_youtube_video_id: string | null;
    }>(
      `
      SELECT
        v.id,
        v.channel_id,
        c.name AS channel_name,
        v.topic,
        v.title,
        v.status,
        v.youtube_video_id,
        v.created_at,
        v.cost_usd,
        v.view_count,
        v.ctr,
        v.thumbnail_uploaded,
        v.quality_score,
        v.short_youtube_video_id
      FROM videos v
      INNER JOIN channels c ON c.id = v.channel_id
      WHERE v.status = 'private'
        AND v.video_type = 'long'
      ORDER BY v.created_at DESC
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      topic: row.topic,
      title: row.title,
      status: row.status,
      youtube_video_id: row.youtube_video_id,
      created_at: row.created_at.toISOString(),
      cost_usd: Number(row.cost_usd),
      view_count: Number(row.view_count),
      ctr: Number(row.ctr),
      thumbnail_uploaded: row.thumbnail_uploaded,
      quality_score: row.quality_score ? Number(row.quality_score) : null,
      short_youtube_video_id: row.short_youtube_video_id,
    }));
  }

  async listRecentActivity(channelId?: string): Promise<
    Array<{
      id: string;
      channel_id: string;
      channel_name: string;
      topic: string | null;
      title: string | null;
      status: VideoStatus;
      created_at: string;
      quality_notes: string | null;
    }>
  > {
    const params: unknown[] = [];
    let channelFilter = "";
    if (channelId) {
      channelFilter = "AND v.channel_id = $1";
      params.push(channelId);
    }

    const rows = await query<{
      id: string;
      channel_id: string;
      channel_name: string;
      topic: string | null;
      title: string | null;
      status: VideoStatus;
      created_at: Date;
      quality_notes: string | null;
    }>(
      `
      SELECT
        v.id,
        v.channel_id,
        c.name AS channel_name,
        v.topic,
        v.title,
        v.status,
        v.created_at,
        v.quality_notes
      FROM videos v
      INNER JOIN channels c ON c.id = v.channel_id
      WHERE v.video_type = 'long'
        AND v.status IN ('processing', 'private', 'failed')
        ${channelFilter}
      ORDER BY v.created_at DESC
      LIMIT 10
      `,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      topic: row.topic,
      title: row.title,
      status: row.status,
      created_at: row.created_at.toISOString(),
      quality_notes: row.quality_notes,
    }));
  }

  async getCostSummary(): Promise<CostSummaryRow[]> {
    const rows = await query<{
      channel_id: string;
      channel_name: string;
      month: Date;
      total_cost_usd: string;
      video_count: string;
    }>(
      `
      SELECT
        v.channel_id,
        c.name AS channel_name,
        date_trunc('month', v.created_at) AS month,
        COALESCE(SUM(v.cost_usd), 0)::text AS total_cost_usd,
        COUNT(*)::text AS video_count
      FROM videos v
      INNER JOIN channels c ON c.id = v.channel_id
      GROUP BY v.channel_id, c.name, date_trunc('month', v.created_at)
      ORDER BY month DESC, channel_name ASC
      `,
    );

    return rows.map((row) => ({
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      month: row.month.toISOString().slice(0, 7),
      total_cost_usd: Number(row.total_cost_usd),
      video_count: Number(row.video_count),
    }));
  }

  async listForAnalyticsSync(channelId: string): Promise<VideoRecord[]> {
    return query<VideoRecord>(
      `
      SELECT *
      FROM videos
      WHERE channel_id = $1
        AND youtube_video_id IS NOT NULL
        AND status IN ('private', 'published')
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [channelId],
    );
  }

  async listAbSwapCandidates(): Promise<VideoRecord[]> {
    return query<VideoRecord>(
      `
      SELECT *
      FROM videos
      WHERE video_type = 'long'
        AND status = 'published'
        AND thumbnail_variant = 'A'
        AND thumbnail_swapped_at IS NULL
        AND thumbnail_b_text IS NOT NULL
        AND thumbnail_b_prompt IS NOT NULL
        AND published_at IS NOT NULL
        AND published_at <= NOW() - INTERVAL '24 hours'
        AND published_at >= NOW() - INTERVAL '14 days'
      ORDER BY published_at ASC
      LIMIT 50
      `,
    );
  }

  async getChannelAverageCtr(channelId: string): Promise<number> {
    const row = await queryOne<{ avg_ctr: string }>(
      `
      SELECT COALESCE(AVG(ctr), 0)::text AS avg_ctr
      FROM videos
      WHERE channel_id = $1
        AND status = 'published'
        AND impressions >= 100
      `,
      [channelId],
    );

    return Number(row?.avg_ctr ?? 0);
  }

  async updateAnalytics(
    videoId: string,
    analytics: VideoAnalyticsUpdate,
  ): Promise<void> {
    await query(
      `
      UPDATE videos
      SET
        view_count = $2,
        ctr = $3,
        avg_view_duration_seconds = $4,
        impressions = $5,
        analytics_synced_at = NOW()
      WHERE id = $1
      `,
      [
        videoId,
        analytics.view_count,
        analytics.ctr,
        analytics.avg_view_duration_seconds,
        analytics.impressions,
      ],
    );
  }

  async getTopPerformingTopics(
    channelId: string,
    limit = 10,
  ): Promise<TopPerformingTopic[]> {
    const rows = await query<{
      topic: string;
      view_count: string;
      ctr: string;
    }>(
      `
      SELECT topic, view_count::text, ctr::text
      FROM videos
      WHERE channel_id = $1
        AND topic IS NOT NULL
        AND status IN ('private', 'published')
        AND view_count > 0
      ORDER BY view_count DESC, ctr DESC
      LIMIT $2
      `,
      [channelId, limit],
    );

    return rows.map((row) => ({
      topic: row.topic,
      view_count: Number(row.view_count),
      ctr: Number(row.ctr),
    }));
  }

  async countPublishedLongForm(channelId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM videos
      WHERE channel_id = $1
        AND status = 'published'
        AND video_type = 'long'
      `,
      [channelId],
    );
    return Number(row?.count ?? 0);
  }

  async countTotalLongForm(channelId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM videos
      WHERE channel_id = $1
        AND video_type = 'long'
        AND status IN ('private', 'published')
      `,
      [channelId],
    );
    return Number(row?.count ?? 0);
  }

  async countVideosThisWeek(channelId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM videos
      WHERE channel_id = $1
        AND video_type = 'long'
        AND created_at >= date_trunc('week', NOW())
        AND status IN ('processing', 'private', 'published')
      `,
      [channelId],
    );
    return Number(row?.count ?? 0);
  }

  async getRecentTitles(channelId: string, limit = 5): Promise<string[]> {
    const rows = await query<{ title: string | null }>(
      `
      SELECT title
      FROM videos
      WHERE channel_id = $1
        AND video_type = 'long'
        AND title IS NOT NULL
        AND status IN ('private', 'published')
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [channelId, limit],
    );
    return rows
      .map((row) => row.title)
      .filter((title): title is string => Boolean(title));
  }

  async getAverageAuthenticityScore(channelId: string): Promise<number> {
    const row = await queryOne<{ avg: string }>(
      `
      SELECT COALESCE(AVG(authenticity_score), 0)::text AS avg
      FROM videos
      WHERE channel_id = $1
        AND authenticity_score IS NOT NULL
        AND status IN ('private', 'published')
      `,
      [channelId],
    );
    return Number(row?.avg ?? 0);
  }

  async getAverageInauthenticityRisk(channelId: string): Promise<number> {
    const row = await queryOne<{ avg: string }>(
      `
      SELECT COALESCE(AVG(inauthenticity_risk_score), 0)::text AS avg
      FROM videos
      WHERE channel_id = $1
        AND inauthenticity_risk_score IS NOT NULL
        AND status IN ('private', 'published')
      `,
      [channelId],
    );
    return Number(row?.avg ?? 0);
  }

  async getVariationScore(channelId: string): Promise<number> {
    const rows = await query<{ title: string | null; topic: string | null }>(
      `
      SELECT title, topic
      FROM videos
      WHERE channel_id = $1
        AND video_type = 'long'
        AND status IN ('private', 'published')
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [channelId],
    );

    if (rows.length < 2) {
      return rows.length === 1 ? 50 : 0;
    }

    const titles = rows
      .map((row) => row.title?.toLowerCase().trim())
      .filter(Boolean) as string[];
    const topics = rows
      .map((row) => row.topic?.toLowerCase().trim())
      .filter(Boolean) as string[];

    const uniqueTitles = new Set(titles).size;
    const uniqueTopics = new Set(topics).size;
    const titleRatio = uniqueTitles / titles.length;
    const topicRatio = uniqueTopics / topics.length;

    return Math.round(((titleRatio + topicRatio) / 2) * 100);
  }
}
