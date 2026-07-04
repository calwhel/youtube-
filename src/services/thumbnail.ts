import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { PlatformConfig } from "../config";
import type { ServiceConfig } from "../config/channel-config";
import type { ThumbnailVariants, VideoPayload } from "../types/video";
import { renderClickbaitThumbnail } from "../utils/thumbnail-ffmpeg";
import { sleep, withRetry } from "../utils/tmp";

interface CreatomateRenderResponse {
  id: string;
  status: string;
  url?: string;
  error_message?: string;
}

export class ThumbnailService {
  private readonly config: ServiceConfig;
  private readonly platform: PlatformConfig;

  constructor(config: ServiceConfig, platform: PlatformConfig) {
    this.config = config;
    this.platform = platform;
  }

  async generateVariants(
    payload: VideoPayload,
    runDir: string,
    localVideoPath?: string,
  ): Promise<ThumbnailVariants> {
    const variantAPath = path.join(runDir, "thumbnail-a.jpg");
    const variantBPath = path.join(runDir, "thumbnail-b.jpg");

    await this.renderVariant(payload, variantAPath, "A", localVideoPath);
    await this.renderVariant(payload, variantBPath, "B", localVideoPath);

    return { variantAPath, variantBPath };
  }

  async generateVariantB(
    payload: VideoPayload,
    cacheKey: string,
  ): Promise<string> {
    const cacheDir = path.join(this.platform.tmpDir, "thumbnail-cache", cacheKey);
    await mkdir(cacheDir, { recursive: true });
    const outputPath = path.join(cacheDir, "variant-b.jpg");
    await this.renderVariant(payload, outputPath, "B");
    return outputPath;
  }

  async generateThumbnail(
    payload: VideoPayload,
    runDir: string,
    localVideoPath?: string,
  ): Promise<string> {
    const outputPath = path.join(runDir, "thumbnail.jpg");
    await this.renderVariant(payload, outputPath, "A", localVideoPath);
    return outputPath;
  }

  private async renderVariant(
    payload: VideoPayload,
    outputPath: string,
    variant: "A" | "B",
    localVideoPath?: string,
  ): Promise<void> {
    const thumbnailPrompt =
      variant === "B" ? payload.thumbnail_b_prompt : payload.thumbnail_prompt;
    const thumbnailText =
      variant === "B" ? payload.thumbnail_b_text : payload.thumbnail_text;

    if (this.config.creatomate.thumbnailTemplateId) {
      try {
        await this.renderCreatomateThumbnail(
          { ...payload, thumbnail_prompt: thumbnailPrompt, thumbnail_text: thumbnailText },
          outputPath,
        );
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[thumbnail] Creatomate variant ${variant} failed, falling back: ${message}`,
        );
      }
    }

    if (!localVideoPath) {
      await renderClickbaitThumbnail(
        thumbnailText,
        outputPath,
        variant,
        path.dirname(outputPath),
      );
      return;
    }

    await renderClickbaitThumbnail(
      thumbnailText,
      outputPath,
      variant,
      path.dirname(outputPath),
      localVideoPath,
    );
  }

  private async renderCreatomateThumbnail(
    payload: VideoPayload,
    outputPath: string,
  ): Promise<void> {
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
