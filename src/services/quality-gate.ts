import type { VideoPayload, QualityGateResult } from "../types/video";
import type { ContentSettings } from "../types/channel";

const HOOK_PATTERNS = [
  /\b(why|how|what if|never|secret|hidden|truth|shocking|nobody)\b/i,
  /\b\d+\b/,
  /\?$/,
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateScriptWordCount(payload: VideoPayload): number {
  return payload.scenes.reduce(
    (total, scene) => total + countWords(scene.voiceover_text),
    0,
  );
}

export function buildDescriptionWithChapters(
  payload: VideoPayload,
): string {
  if (!payload.chapters || payload.chapters.length === 0) {
    return payload.description;
  }

  const chapterBlock = payload.chapters
    .map((chapter) => `${chapter.timestamp} ${chapter.title}`)
    .join("\n");

  return `${payload.description.trim()}\n\nChapters:\n${chapterBlock}`;
}

export function runQualityGate(
  payload: VideoPayload,
  content: ContentSettings,
  options: { thumbnailUploaded: boolean },
): QualityGateResult {
  const notes: string[] = [];
  let score = 100;

  const titleLength = payload.title.trim().length;
  if (titleLength < 30 || titleLength > 70) {
    score -= 15;
    notes.push(`Title length ${titleLength} chars (target 30-70 for CTR)`);
  }

  const hasHookPattern = HOOK_PATTERNS.some((pattern) =>
    pattern.test(payload.title),
  );
  if (!hasHookPattern) {
    score -= 10;
    notes.push("Title lacks a strong curiosity hook pattern");
  }

  const firstSceneWords = countWords(payload.scenes[0]?.voiceover_text ?? "");
  if (firstSceneWords < 25) {
    score -= 15;
    notes.push("Opening scene voiceover is too short for a retention hook");
  } else {
    const firstSceneText = payload.scenes[0]?.voiceover_text ?? "";
    const hookSignals = /\b(you|imagine|what if|here's|secret|never|why)\b/i.test(
      firstSceneText,
    );
    if (!hookSignals) {
      score -= 10;
      notes.push("Opening scene missing direct hook language");
    }
  }

  const totalWords = estimateScriptWordCount(payload);
  const targetWords = content.targetDurationMinutes * 150;
  const minWords = Math.floor(targetWords * 0.75);
  const maxWords = Math.ceil(targetWords * 1.25);

  if (totalWords < minWords || totalWords > maxWords) {
    score -= 15;
    notes.push(
      `Script ${totalWords} words (target ${minWords}-${maxWords} for ${content.targetDurationMinutes} min)`,
    );
  }

  if (payload.tags.length < 8) {
    score -= 10;
    notes.push(`Only ${payload.tags.length} tags (target 8+)`);
  }

  if (payload.description.trim().length < 200) {
    score -= 10;
    notes.push("Description too short for SEO");
  }

  if (payload.scenes.length < 5) {
    score -= 10;
    notes.push(`Only ${payload.scenes.length} scenes (target 5+)`);
  }

  if (payload.thumbnail_text.trim().split(/\s+/).length > 6) {
    score -= 5;
    notes.push("Thumbnail text exceeds 6 words");
  }

  if (content.requireThumbnail && !options.thumbnailUploaded) {
    score -= 20;
    notes.push("Custom thumbnail was not uploaded");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    passed: score >= 70,
    score,
    notes,
  };
}
