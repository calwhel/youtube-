import type { ChannelRecord } from "../types/channel";
import type { DecryptedChannel } from "../db/repositories/channels";

type ChannelWithTemplates = Pick<
  ChannelRecord | DecryptedChannel,
  "creatomate_template_id" | "creatomate_template_ids"
>;

export function parseTemplateIds(channel: ChannelWithTemplates): string[] {
  const raw = channel.creatomate_template_ids;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string" && id.trim() !== "");
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (id): id is string => typeof id === "string" && id.trim() !== "",
        );
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function pickCreatomateTemplate(
  channel: ChannelWithTemplates,
  videoIndex: number,
): string {
  const pool = parseTemplateIds(channel);
  const candidates =
    pool.length > 0
      ? pool
      : [channel.creatomate_template_id].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error("No Creatomate template configured for channel");
  }

  return candidates[videoIndex % candidates.length];
}

export function canAutoPublish(
  channel: Pick<
    ChannelRecord,
    | "auto_publish"
    | "review_mode"
    | "manual_publish_count"
    | "min_manual_publishes_before_auto"
  >,
): boolean {
  if (!channel.auto_publish) {
    return false;
  }

  if (channel.review_mode === "required") {
    return (
      channel.manual_publish_count >= channel.min_manual_publishes_before_auto
    );
  }

  return true;
}
