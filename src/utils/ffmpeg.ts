import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getAudioDurationSeconds(
  filePath: string,
): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  } catch {
    // fall through to estimate
  }

  return estimateDurationFromFileSize(filePath);
}

async function estimateDurationFromFileSize(
  filePath: string,
): Promise<number> {
  const { stat } = await import("node:fs/promises");
  const stats = await stat(filePath);
  // Rough MP3 bitrate estimate ~128kbps
  return Math.max(3, stats.size / 16_000);
}

export async function concatAudioFiles(
  inputPaths: string[],
  outputPath: string,
  tmpDir: string,
): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("No audio files to concatenate");
  }

  if (inputPaths.length === 1) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(inputPaths[0], outputPath);
    return;
  }

  const listPath = path.join(tmpDir, "concat-list.txt");
  const listContent = inputPaths
    .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, listContent, "utf8");

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
}

export async function extractVideoFrame(
  videoPath: string,
  outputPath: string,
  seekSeconds = 3,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    String(seekSeconds),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
}

export function estimateWordCountDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, words / 2.5);
}
