import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { ServiceConfig } from "../config/channel-config";
import type {
  ShortClipPlan,
  ShortUploadResult,
  VideoPayload,
} from "../types/video";
import { withRetry } from "../utils/tmp";
import type { YouTubeService } from "./youtube";

const execFileAsync = promisify(execFile);

const MIN_SHORT_SECONDS = 30;
const MAX_SHORT_SECONDS = 59;

export class ShortsService {
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  planClip(payload: VideoPayload): ShortClipPlan {
    let startSeconds = 0;
    let durationSeconds = payload.scenes[0]?.duration_seconds ?? 15;

    if (payload.scenes.length > 1) {
      durationSeconds += payload.scenes[1]?.duration_seconds ?? 15;
    }

    durationSeconds = Math.min(
      MAX_SHORT_SECONDS,
      Math.max(MIN_SHORT_SECONDS, durationSeconds),
    );

    const title = payload.short_title?.trim() || `${payload.title} #Shorts`;

    return { startSeconds, durationSeconds, title };
  }

  async extractVerticalClip(
    localVideoPath: string,
    plan: ShortClipPlan,
    runDir: string,
  ): Promise<string> {
    const outputPath = path.join(runDir, "short-vertical.mp4");

    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      String(plan.startSeconds),
      "-i",
      localVideoPath,
      "-t",
      String(plan.durationSeconds),
      "-vf",
      "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920:flags=lanczos",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return outputPath;
  }

  async uploadShort(
    youtube: YouTubeService,
    payload: VideoPayload,
    localShortPath: string,
    plan: ShortClipPlan,
    longVideoUrl: string,
  ): Promise<ShortUploadResult> {
    const description =
      `${payload.topic}\n\n` +
      `Watch the full video: ${longVideoUrl}\n\n` +
      `#Shorts ${payload.tags.slice(0, 5).map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ")}`;

    return withRetry(
      () =>
        youtube.uploadShortVideo({
          title: plan.title,
          description,
          tags: [...payload.tags, "Shorts"],
          localVideoPath: localShortPath,
        }),
      {
        ...this.config.retry,
        label: "shorts-upload-wrapper",
      },
    );
  }
}
