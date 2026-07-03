import type { PlatformConfig } from "../config";

export type NotificationEvent =
  | "pending_review"
  | "published"
  | "pipeline_failed"
  | "monetization_approaching"
  | "monetization_eligible"
  | "thumbnail_ab_swap";

export interface NotificationPayload {
  event: NotificationEvent;
  channelName: string;
  title?: string;
  topic?: string;
  videoUrl?: string;
  qualityScore?: number | null;
  qualityNotes?: string | null;
  error?: string;
  subsCount?: number;
  watchHours?: number;
  details?: string;
}

export class NotificationService {
  constructor(private readonly platform: PlatformConfig) {}

  async notify(payload: NotificationPayload): Promise<void> {
    if (!this.shouldNotify(payload.event)) {
      return;
    }

    const tasks: Promise<void>[] = [];

    if (this.platform.notifications.slackWebhookUrl) {
      tasks.push(
        this.postSlack(this.platform.notifications.slackWebhookUrl, payload),
      );
    }

    if (this.platform.notifications.discordWebhookUrl) {
      tasks.push(
        this.postDiscord(this.platform.notifications.discordWebhookUrl, payload),
      );
    }

    if (tasks.length === 0) {
      return;
    }

    await Promise.allSettled(tasks);
  }

  private shouldNotify(event: NotificationEvent): boolean {
    switch (event) {
      case "pending_review":
        return this.platform.notifications.notifyPending;
      case "published":
      case "thumbnail_ab_swap":
        return this.platform.notifications.notifyPublish;
      case "pipeline_failed":
        return this.platform.notifications.notifyFailure;
      case "monetization_approaching":
      case "monetization_eligible":
        return this.platform.notifications.notifyMonetization;
      default:
        return true;
    }
  }

  private eventTitle(event: NotificationEvent): string {
    switch (event) {
      case "pending_review":
        return "Video pending review";
      case "published":
        return "Video published";
      case "pipeline_failed":
        return "Pipeline failed";
      case "monetization_approaching":
        return "Approaching monetization";
      case "monetization_eligible":
        return "Monetization eligible!";
      case "thumbnail_ab_swap":
        return "Thumbnail A/B swap applied";
      default:
        return "Pipeline notification";
    }
  }

  private eventColor(event: NotificationEvent): number {
    switch (event) {
      case "published":
      case "monetization_eligible":
        return 0x22_c5_5e;
      case "pending_review":
      case "monetization_approaching":
      case "thumbnail_ab_swap":
        return 0xfa_a6_1a;
      case "pipeline_failed":
        return 0xef_44_44;
      default:
        return 0x63_66_f1;
    }
  }

  private buildFields(payload: NotificationPayload): Array<{
    name: string;
    value: string;
    inline?: boolean;
  }> {
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Channel", value: payload.channelName, inline: true },
    ];

    if (payload.title) {
      fields.push({ name: "Title", value: payload.title, inline: false });
    }
    if (payload.topic) {
      fields.push({ name: "Topic", value: payload.topic, inline: false });
    }
    if (payload.videoUrl) {
      fields.push({ name: "URL", value: payload.videoUrl, inline: false });
    }
    if (payload.qualityScore != null) {
      fields.push({
        name: "Quality score",
        value: String(payload.qualityScore),
        inline: true,
      });
    }
    if (payload.subsCount != null) {
      fields.push({
        name: "Subscribers",
        value: String(payload.subsCount),
        inline: true,
      });
    }
    if (payload.watchHours != null) {
      fields.push({
        name: "Watch hours",
        value: payload.watchHours.toFixed(0),
        inline: true,
      });
    }
    if (payload.error) {
      fields.push({ name: "Error", value: payload.error, inline: false });
    }
    if (payload.details) {
      fields.push({ name: "Details", value: payload.details, inline: false });
    }
    if (payload.qualityNotes) {
      fields.push({ name: "Notes", value: payload.qualityNotes, inline: false });
    }

    return fields;
  }

  private async postSlack(
    webhookUrl: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const fields = this.buildFields(payload);
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: this.eventTitle(payload.event),
        },
      },
      ...fields.map((field) => ({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*${field.name}*\n${field.value}` },
        ],
      })),
    ];

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[notify] Slack webhook failed (${response.status}): ${body}`);
    }
  }

  private async postDiscord(
    webhookUrl: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const fields = this.buildFields(payload).map((field) => ({
      name: field.name,
      value: field.value.slice(0, 1024),
      inline: field.inline ?? false,
    }));

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: this.eventTitle(payload.event),
            color: this.eventColor(payload.event),
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(
        `[notify] Discord webhook failed (${response.status}): ${body}`,
      );
    }
  }
}
