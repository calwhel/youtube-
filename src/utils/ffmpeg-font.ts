import { existsSync } from "node:fs";
import path from "node:path";

const FONT_CANDIDATES = [
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  path.join(__dirname, "fonts", "DejaVuSans-Bold.ttf"),
  path.join(__dirname, "..", "assets", "fonts", "DejaVuSans-Bold.ttf"),
];

export function getFfmpegFontFile(): string {
  for (const candidate of FONT_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No font found for ffmpeg drawtext. Rebuild the Docker image (needs ttf-dejavu).",
  );
}

export function ffmpegFontDrawtextArg(): string {
  return `fontfile=${escapeFfmpegPath(getFfmpegFontFile())}`;
}

function escapeFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}
