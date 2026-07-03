import path from "node:path";

import type { ServiceConfig } from "../config/channel-config";
import type { VideoPayload } from "../types/video";
import { extractVideoFrame } from "../utils/ffmpeg";
import { sleep, withRetry } from "../utils/tmp";

interface CreatomateRenderResponse {
  id: string;
  status: string;
  url?: string;
  error_message?: string;
}

export class ThumbnailService {
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  async generateThumbnail(
    payload: VideoPayload,
    runDir: string,
    localVideoPath?: string,
  ): Promise<string> {
    const outputPath = path.join(runDir, "thumbnail.jpg");

    if (this.config.creatomate.thumbnailTemplateId) {
      try {
        return await this.renderCreatomateThumbnail(payload, outputPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[thumbnail] Creatomate render failed, falling back to frame extract: ${message}`,
        );
      }
    }

    if (!localVideoPath) {
      throw new Error(
        "No thumbnail template configured and no video available for frame extraction",
      );
    }

    await extractVideoFrame(localVideoPath, outputPath, 3);
    return outputPath;
  }

  private async renderCreatomateThumbnail(
    payload: VideoPayload,
    outputPath: string,
  ): Promise<string> {
    const templateId = this.config.creatomate.thumbnailTemplateId;
    if (!templateId) {
      throw new Error("Creatomate thumbnail template ID is not configured");
    }

    const renderId = await withRetry(
      async () => {
        const response = await fetch("https://api.creatomate.com/v2/renders", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.creatomate.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: templateId,
            modifications: {
              "Thumbnail-Image.prompt": payload.thumbnail_prompt,
              "Thumbnail-Text.text": payload.thumbnail_text,
              "Title-Text.text": payload.title,
            },
            output_format: "jpg",
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Creatomate thumbnail request failed (${response.status}): ${errorBody}`,
          );
        }

        const renders = (await response.json()) as CreatomateRenderResponse[];
        const render = Array.isArray(renders) ? renders[0] : renders;
        if (!render?.id) {
          throw new Error("Creatomate thumbnail response missing render id");
        }

        return render.id;
      },
      {
        ...this.config.retry,
        label: "creatomate-thumbnail-create",
      },
    );

    const imageUrl = await this.pollRender(renderId);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download thumbnail (${imageResponse.status})`,
      );
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const { writeFile } = await import("node:fs/promises");
    await writeFile(outputPath, buffer);
    return outputPath;
  }

  private async pollRender(renderId: string): Promise<string> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.config.creatomate.pollTimeoutMs) {
      const response = await fetch(
        `https://api.creatomate.com/v1/renders/${renderId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.creatomate.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Creatomate thumbnail poll failed (${response.status}): ${errorBody}`,
        );
      }

      const render = (await response.json()) as CreatomateRenderResponse;
      if (render.status === "succeeded" && render.url) {
        return render.url;
      }

      if (render.status === "failed") {
        throw new Error(
          `Creatomate thumbnail failed: ${render.error_message ?? "unknown error"}`,
        );
      }

      await sleep(this.config.creatomate.pollIntervalMs);
    }

    throw new Error("Creatomate thumbnail render timed out");
  }
}
