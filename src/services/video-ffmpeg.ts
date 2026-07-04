import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { VideoPayload } from "../types/video";
import { ffmpegFontDrawtextArg } from "../utils/ffmpeg-font";

const execFileAsync = promisify(execFile);

const SCENE_BACKGROUNDS = [
  "0x1a1a2e",
  "0x16213e",
  "0x0f3460",
  "0x533483",
  "0x2d4059",
  "0x434343",
];

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.join("\n") || text.slice(0, maxCharsPerLine);
}

async function writeSceneTextFile(
  runDir: string,
  sceneIndex: number,
  text: string,
): Promise<string> {
  const textPath = path.join(runDir, `scene-${sceneIndex}-text.txt`);
  await writeFile(textPath, wrapText(text, 42, 4), "utf8");
  return textPath;
}

async function renderSceneSegment(
  payload: VideoPayload,
  sceneIndex: number,
  durationSeconds: number,
  runDir: string,
): Promise<string> {
  const scene = payload.scenes[sceneIndex];
  const outputPath = path.join(runDir, `scene-${sceneIndex + 1}.mp4`);
  const textPath = await writeSceneTextFile(
    runDir,
    sceneIndex + 1,
    scene?.overlay_text?.trim() ||
      scene?.voiceover_text?.trim() ||
      payload.title,
  );
  const background = SCENE_BACKGROUNDS[sceneIndex % SCENE_BACKGROUNDS.length];
  const duration = Math.max(3, durationSeconds);

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${background}:s=1920x1080:d=${duration}`,
    "-vf",
    [
      `drawtext=${ffmpegFontDrawtextArg()}`,
      `textfile=${textPath.replace(/:/g, "\\:")}`,
      "fontcolor=white",
      "fontsize=44",
      "line_spacing=12",
      "x=(w-text_w)/2",
      "y=(h-text_h)/2",
      "box=1",
      "boxcolor=black@0.55",
      "boxborderw=24",
    ].join(":"),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    outputPath,
  ]);

  return outputPath;
}

async function concatVideoSegments(
  segmentPaths: string[],
  runDir: string,
): Promise<string> {
  const listPath = path.join(runDir, "video-concat.txt");
  const listContent = segmentPaths
    .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, listContent, "utf8");

  const outputPath = path.join(runDir, "video-slides.mp4");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);

  return outputPath;
}

async function mergeVideoAndAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function renderVideoWithFfmpeg(
  payload: VideoPayload,
  voiceoverPath: string,
  runDir: string,
): Promise<{ renderedVideoUrl: string; localVideoPath: string }> {
  const segmentPaths: string[] = [];

  for (let index = 0; index < payload.scenes.length; index++) {
    const scene = payload.scenes[index];
    const duration =
      scene?.duration_seconds && scene.duration_seconds > 0
        ? scene.duration_seconds
        : 8;
    segmentPaths.push(
      await renderSceneSegment(payload, index, duration, runDir),
    );
  }

  if (segmentPaths.length === 0) {
    segmentPaths.push(await renderSceneSegment(payload, 0, 60, runDir));
  }

  const slidesPath = await concatVideoSegments(segmentPaths, runDir);
  const localVideoPath = path.join(runDir, "rendered-video.mp4");
  await mergeVideoAndAudio(slidesPath, voiceoverPath, localVideoPath);

  return {
    renderedVideoUrl: localVideoPath,
    localVideoPath,
  };
}
