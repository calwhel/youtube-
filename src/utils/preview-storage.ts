import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

export function getPreviewDir(tmpDir: string): string {
  return path.join(tmpDir, "previews");
}

export function getPreviewVideoPath(tmpDir: string, videoId: string): string {
  return path.join(getPreviewDir(tmpDir), `${videoId}.mp4`);
}

export function getPreviewThumbnailPath(
  tmpDir: string,
  videoId: string,
): string {
  return path.join(getPreviewDir(tmpDir), `${videoId}.jpg`);
}

export async function savePreviewVideo(
  tmpDir: string,
  videoId: string,
  sourcePath: string,
): Promise<string> {
  const previewDir = getPreviewDir(tmpDir);
  await mkdir(previewDir, { recursive: true });
  const destination = getPreviewVideoPath(tmpDir, videoId);
  await copyFile(sourcePath, destination);
  return destination;
}

export async function savePreviewThumbnail(
  tmpDir: string,
  videoId: string,
  sourcePath: string,
): Promise<string> {
  const previewDir = getPreviewDir(tmpDir);
  await mkdir(previewDir, { recursive: true });
  const destination = getPreviewThumbnailPath(tmpDir, videoId);
  await copyFile(sourcePath, destination);
  return destination;
}

export async function previewVideoExists(
  tmpDir: string,
  videoId: string,
): Promise<boolean> {
  try {
    const fileStat = await stat(getPreviewVideoPath(tmpDir, videoId));
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}

export async function previewThumbnailExists(
  tmpDir: string,
  videoId: string,
): Promise<boolean> {
  try {
    const fileStat = await stat(getPreviewThumbnailPath(tmpDir, videoId));
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}
