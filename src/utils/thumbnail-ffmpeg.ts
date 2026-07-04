import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VARIANT_STYLES = {
  A: {
    background: "0x1a0008",
    accent: "0xff0033",
    fontcolor: "yellow",
  },
  B: {
    background: "0x000818",
    accent: "0xffaa00",
    fontcolor: "white",
  },
} as const;

function sanitizeThumbText(text: string, maxWords = 4): string {
  const words = text
    .trim()
    .replace(/[^\w\s!?.$-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  return (words.join(" ") || "WATCH THIS").toUpperCase();
}

async function writeTextFile(dir: string, name: string, text: string): Promise<string> {
  const filePath = path.join(dir, name);
  await writeFile(filePath, text, "utf8");
  return filePath;
}

async function renderBackground(
  outputPath: string,
  variant: "A" | "B",
  textPath: string,
): Promise<void> {
  const style = VARIANT_STYLES[variant];

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${style.background}:s=1280x720:d=1`,
    "-vf",
    [
      `drawtext=textfile=${textPath.replace(/:/g, "\\:")}`,
      `fontcolor=${style.fontcolor}`,
      "fontsize=78",
      "line_spacing=10",
      "x=(w-text_w)/2",
      "y=(h-text_h)/2-20",
      "borderw=5",
      "bordercolor=black",
      "box=1",
      `boxcolor=${style.accent}@0.85`,
      "boxborderw=28",
    ].join(":"),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
}

async function compositeOnVideoFrame(
  videoPath: string,
  outputPath: string,
  variant: "A" | "B",
  textPath: string,
  seekSeconds: number,
): Promise<void> {
  const style = VARIANT_STYLES[variant];
  const framePath = outputPath.replace(/\.jpg$/i, "-frame.jpg");

  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    String(seekSeconds),
    "-i",
    videoPath,
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=brightness=-0.08:saturation=1.35",
    "-frames:v",
    "1",
    framePath,
  ]);

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    framePath,
    "-vf",
    [
      "boxblur=6:1",
      `drawtext=textfile=${textPath.replace(/:/g, "\\:")}`,
      `fontcolor=${style.fontcolor}`,
      "fontsize=76",
      "line_spacing=10",
      "x=(w-text_w)/2",
      "y=h-130",
      "borderw=6",
      "bordercolor=black",
      "box=1",
      `boxcolor=${style.accent}@0.9`,
      "boxborderw=24",
    ].join(":"),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
}

export async function renderClickbaitThumbnail(
  thumbnailText: string,
  outputPath: string,
  variant: "A" | "B",
  runDir: string,
  localVideoPath?: string,
): Promise<void> {
  const text = sanitizeThumbText(thumbnailText);
  const textPath = await writeTextFile(
    runDir,
    `thumb-${variant}-text.txt`,
    text,
  );

  if (localVideoPath) {
    const seek = variant === "B" ? 10 : 4;
    await compositeOnVideoFrame(
      localVideoPath,
      outputPath,
      variant,
      textPath,
      seek,
    );
    return;
  }

  await renderBackground(outputPath, variant, textPath);
}
