import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type { ServiceConfig } from "../config/channel-config";
import type { SceneAudioSegment, VideoPayload } from "../types/video";
import {
  concatAudioFiles,
  estimateWordCountDurationSeconds,
  getAudioDurationSeconds,
} from "../utils/ffmpeg";
import { withRetry } from "../utils/tmp";

export class VoiceService {
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  buildMasterScript(payload: VideoPayload): string {
    return payload.scenes
      .map((scene) => scene.voiceover_text.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  async synthesizeVoiceover(
    payload: VideoPayload,
    runDir: string,
  ): Promise<{ voiceoverPath: string; segments: SceneAudioSegment[] }> {
    const segments: SceneAudioSegment[] = [];

    for (const [index, scene] of payload.scenes.entries()) {
      const scenePath = path.join(runDir, `scene-${index + 1}.mp3`);
      await this.synthesizeScene(scene.voiceover_text, scenePath);

      let durationSeconds = await getAudioDurationSeconds(scenePath);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        durationSeconds = estimateWordCountDurationSeconds(scene.voiceover_text);
      }

      payload.scenes[index].duration_seconds = durationSeconds;
      segments.push({
        sceneIndex: index,
        filePath: scenePath,
        durationSeconds,
      });
    }

    const voiceoverPath = path.join(runDir, "voiceover.mp3");
    await concatAudioFiles(
      segments.map((segment) => segment.filePath),
      voiceoverPath,
      runDir,
    );

    return { voiceoverPath, segments };
  }

  private async synthesizeScene(text: string, outputPath: string): Promise<void> {
    await withRetry(
      async () => {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabs.voiceId}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "xi-api-key": this.config.elevenlabs.apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: this.config.elevenlabs.modelId,
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.8,
              style: 0.25,
              use_speaker_boost: true,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `ElevenLabs TTS failed (${response.status}): ${errorBody}`,
          );
        }

        if (!response.body) {
          throw new Error("ElevenLabs TTS response had no body stream");
        }

        const nodeStream = Readable.fromWeb(
          response.body as import("node:stream/web").ReadableStream,
        );
        const fileStream = createWriteStream(outputPath);
        nodeStream.pipe(fileStream);
        await finished(fileStream);
      },
      {
        ...this.config.retry,
        label: "elevenlabs-tts-scene",
      },
    );
  }
}
