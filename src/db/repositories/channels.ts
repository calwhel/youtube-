import type { PoolClient } from "pg";

import { encrypt, decrypt } from "../../utils/crypto";
import type {
  AudienceLevel,
  ChannelPublicView,
  ChannelRecord,
  ChannelStatsRecord,
  CreateChannelInput,
  TitleStyle,
  UpdateChannelInput,
} from "../../types/channel";
import { query, queryOne } from "../pool";

function mapChannelPublic(
  channel: ChannelRecord,
  stats: ChannelStatsRecord | null,
): ChannelPublicView {
  return {
    id: channel.id,
    name: channel.name,
    niche_prompt: channel.niche_prompt,
    youtube_client_id: channel.youtube_client_id,
    elevenlabs_voice_id: channel.elevenlabs_voice_id,
    creatomate_template_id: channel.creatomate_template_id,
    upload_frequency: channel.upload_frequency,
    monthly_budget_usd: Number(channel.monthly_budget_usd),
    status: channel.status,
    target_duration_minutes: channel.target_duration_minutes,
    audience_level: channel.audience_level,
    title_style: channel.title_style,
    auto_publish: channel.auto_publish,
    youtube_category_id: channel.youtube_category_id,
    creatomate_thumbnail_template_id: channel.creatomate_thumbnail_template_id,
    require_thumbnail: channel.require_thumbnail,
    auto_generate_shorts: channel.auto_generate_shorts,
    enable_ab_thumbnails: channel.enable_ab_thumbnails,
    enable_engagement: channel.enable_engagement,
    default_playlist_id: channel.default_playlist_id,
    created_at: channel.created_at.toISOString(),
    stats: stats
      ? {
          subs_count: Number(stats.subs_count),
          watch_hours_total: Number(stats.watch_hours_total),
          monetization_eligible: stats.monetization_eligible,
          last_checked_at: stats.last_checked_at?.toISOString() ?? null,
        }
      : null,
  };
}

export interface DecryptedChannel extends Omit<
  ChannelRecord,
  "youtube_client_secret" | "youtube_refresh_token"
> {
  youtube_client_secret: string;
  youtube_refresh_token: string;
}

export class ChannelRepository {
  constructor(private readonly encryptionKey: string) {}

  decryptChannel(channel: ChannelRecord): DecryptedChannel {
    return {
      ...channel,
      youtube_client_secret: decrypt(
        channel.youtube_client_secret,
        this.encryptionKey,
      ),
      youtube_refresh_token: decrypt(
        channel.youtube_refresh_token,
        this.encryptionKey,
      ),
    };
  }

  async findById(id: string): Promise<ChannelRecord | null> {
    return queryOne<ChannelRecord>(
      `SELECT * FROM channels WHERE id = $1`,
      [id],
    );
  }

  async findDecryptedById(id: string): Promise<DecryptedChannel | null> {
    const channel = await this.findById(id);
    return channel ? this.decryptChannel(channel) : null;
  }

  async listActive(): Promise<ChannelRecord[]> {
    return query<ChannelRecord>(
      `SELECT * FROM channels WHERE status = 'active' ORDER BY created_at ASC`,
    );
  }

  async listAll(): Promise<ChannelPublicView[]> {
    const channels = await query<ChannelRecord>(
      `SELECT * FROM channels ORDER BY created_at ASC`,
    );

    const views: ChannelPublicView[] = [];
    for (const channel of channels) {
      const stats = await this.getStats(channel.id);
      views.push(mapChannelPublic(channel, stats));
    }

    return views;
  }

  async getPublicView(id: string): Promise<ChannelPublicView | null> {
    const channel = await this.findById(id);
    if (!channel) {
      return null;
    }

    const stats = await this.getStats(id);
    return mapChannelPublic(channel, stats);
  }

  async getStats(channelId: string): Promise<ChannelStatsRecord | null> {
    return queryOne<ChannelStatsRecord>(
      `SELECT * FROM channel_stats WHERE channel_id = $1`,
      [channelId],
    );
  }

  async create(input: CreateChannelInput): Promise<ChannelPublicView> {
    const row = await queryOne<ChannelRecord>(
      `
      INSERT INTO channels (
        name,
        niche_prompt,
        youtube_client_id,
        youtube_client_secret,
        youtube_refresh_token,
        elevenlabs_voice_id,
        creatomate_template_id,
        upload_frequency,
        monthly_budget_usd,
        status,
        target_duration_minutes,
        audience_level,
        title_style,
        auto_publish,
        youtube_category_id,
        creatomate_thumbnail_template_id,
        require_thumbnail,
        auto_generate_shorts,
        enable_ab_thumbnails,
        enable_engagement,
        default_playlist_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
      `,
      [
        input.name,
        input.niche_prompt,
        input.youtube_client_id,
        encrypt(input.youtube_client_secret, this.encryptionKey),
        encrypt(input.youtube_refresh_token, this.encryptionKey),
        input.elevenlabs_voice_id,
        input.creatomate_template_id,
        input.upload_frequency ?? "0 14 * * *",
        input.monthly_budget_usd ?? 0,
        input.status ?? "paused",
        input.target_duration_minutes ?? 10,
        input.audience_level ?? "general",
        input.title_style ?? "curiosity",
        input.auto_publish ?? false,
        input.youtube_category_id ?? "28",
        input.creatomate_thumbnail_template_id ?? null,
        input.require_thumbnail ?? true,
        input.auto_generate_shorts ?? true,
        input.enable_ab_thumbnails ?? true,
        input.enable_engagement ?? true,
        input.default_playlist_id ?? null,
      ],
    );

    if (!row) {
      throw new Error("Failed to create channel");
    }

    await query(
      `
      INSERT INTO channel_stats (channel_id, subs_count, watch_hours_total, monetization_eligible)
      VALUES ($1, 0, 0, FALSE)
      ON CONFLICT (channel_id) DO NOTHING
      `,
      [row.id],
    );

    return mapChannelPublic(row, await this.getStats(row.id));
  }

  async update(
    id: string,
    input: UpdateChannelInput,
  ): Promise<ChannelPublicView | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const row = await queryOne<ChannelRecord>(
      `
      UPDATE channels
      SET
        name = COALESCE($2, name),
        niche_prompt = COALESCE($3, niche_prompt),
        youtube_client_id = COALESCE($4, youtube_client_id),
        youtube_client_secret = COALESCE($5, youtube_client_secret),
        youtube_refresh_token = COALESCE($6, youtube_refresh_token),
        elevenlabs_voice_id = COALESCE($7, elevenlabs_voice_id),
        creatomate_template_id = COALESCE($8, creatomate_template_id),
        upload_frequency = COALESCE($9, upload_frequency),
        monthly_budget_usd = COALESCE($10, monthly_budget_usd),
        status = COALESCE($11, status),
        target_duration_minutes = COALESCE($12, target_duration_minutes),
        audience_level = COALESCE($13, audience_level),
        title_style = COALESCE($14, title_style),
        auto_publish = COALESCE($15, auto_publish),
        youtube_category_id = COALESCE($16, youtube_category_id),
        creatomate_thumbnail_template_id = COALESCE($17, creatomate_thumbnail_template_id),
        require_thumbnail = COALESCE($18, require_thumbnail),
        auto_generate_shorts = COALESCE($19, auto_generate_shorts),
        enable_ab_thumbnails = COALESCE($20, enable_ab_thumbnails),
        enable_engagement = COALESCE($21, enable_engagement),
        default_playlist_id = COALESCE($22, default_playlist_id)
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.name ?? null,
        input.niche_prompt ?? null,
        input.youtube_client_id ?? null,
        input.youtube_client_secret
          ? encrypt(input.youtube_client_secret, this.encryptionKey)
          : null,
        input.youtube_refresh_token
          ? encrypt(input.youtube_refresh_token, this.encryptionKey)
          : null,
        input.elevenlabs_voice_id ?? null,
        input.creatomate_template_id ?? null,
        input.upload_frequency ?? null,
        input.monthly_budget_usd ?? null,
        input.status ?? null,
        input.target_duration_minutes ?? null,
        input.audience_level ?? null,
        input.title_style ?? null,
        input.auto_publish ?? null,
        input.youtube_category_id ?? null,
        input.creatomate_thumbnail_template_id ?? null,
        input.require_thumbnail ?? null,
        input.auto_generate_shorts ?? null,
        input.enable_ab_thumbnails ?? null,
        input.enable_engagement ?? null,
        input.default_playlist_id ?? null,
      ],
    );

    if (!row) {
      return null;
    }

    return mapChannelPublic(row, await this.getStats(id));
  }

  async markMonetizationAlertSent(channelId: string): Promise<void> {
    await query(
      `
      UPDATE channel_stats
      SET monetization_alert_sent = TRUE
      WHERE channel_id = $1
      `,
      [channelId],
    );
  }

  async getStatsRaw(channelId: string): Promise<ChannelStatsRecord | null> {
    return this.getStats(channelId);
  }

  async delete(id: string): Promise<boolean> {
    const result = await query<{ id: string }>(
      `DELETE FROM channels WHERE id = $1 RETURNING id`,
      [id],
    );
    return result.length > 0;
  }

  async getMonthlySpend(channelId: string): Promise<number> {
    const row = await queryOne<{ total: string }>(
      `
      SELECT COALESCE(SUM(cost_usd), 0)::text AS total
      FROM videos
      WHERE channel_id = $1
        AND created_at >= date_trunc('month', NOW())
      `,
      [channelId],
    );

    return Number(row?.total ?? 0);
  }

  async upsertStats(
    channelId: string,
    stats: {
      subs_count: number;
      watch_hours_total: number;
      monetization_eligible: boolean;
      monetization_alert_sent?: boolean;
    },
    client?: PoolClient,
  ): Promise<void> {
    const sql = `
      INSERT INTO channel_stats (
        channel_id,
        subs_count,
        watch_hours_total,
        monetization_eligible,
        monetization_alert_sent,
        last_checked_at
      )
      VALUES ($1, $2, $3, $4, COALESCE($5, FALSE), NOW())
      ON CONFLICT (channel_id)
      DO UPDATE SET
        subs_count = EXCLUDED.subs_count,
        watch_hours_total = EXCLUDED.watch_hours_total,
        monetization_eligible = EXCLUDED.monetization_eligible,
        monetization_alert_sent = COALESCE(EXCLUDED.monetization_alert_sent, channel_stats.monetization_alert_sent),
        last_checked_at = NOW()
    `;
    const params = [
      channelId,
      stats.subs_count,
      stats.watch_hours_total,
      stats.monetization_eligible,
      stats.monetization_alert_sent ?? null,
    ];

    if (client) {
      await client.query(sql, params);
      return;
    }

    await query(sql, params);
  }
}

export function isAudienceLevel(value: string): value is AudienceLevel {
  return ["beginner", "intermediate", "advanced", "general"].includes(value);
}

export function isTitleStyle(value: string): value is TitleStyle {
  return ["curiosity", "question", "listicle", "story", "controversy"].includes(
    value,
  );
}
