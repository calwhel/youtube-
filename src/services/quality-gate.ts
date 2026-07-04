import type { VideoPayload, QualityGateResult } from "../types/video";
import type { ContentSettings } from "../types/channel";
import { appendSourcesToDescription } from "./authenticity-gate";

const THUMBNAIL_POWER_WORDS =
  /\b(exposed|truth|wrong|secret|hidden|insane|finally|shocking|never|why|how|stop|don't|won't|revealed|debunked|real reason)\b/i;

const TITLE_POWER_WORDS =
  /\b(why|how|secret|hidden|truth|wrong|never|everyone|actually|real|exposed|shocking|debunked)\b/i;

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
  let description = payload.description;

  if (payload.chapters && payload.chapters.length > 0) {
    const chapterBlock = payload.chapters
      .map((chapter) => `${chapter.timestamp} ${chapter.title}`)
      .join("\n");
    description = `${description.trim()}\n\nChapters:\n${chapterBlock}`;
  }

  return appendSourcesToDescription(description, payload.sources_cited ?? []);
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

  const hasHookPattern =
    TITLE_POWER_WORDS.test(payload.title) ||
    /\b\d+\b/.test(payload.title) ||
    /\?/.test(payload.title) ||
    /!/.test(payload.title);
  if (!hasHookPattern) {
    score -= 15;
    notes.push("Title lacks clickbait hook (add why/how/number/shocking angle)");
  }

  const thumbWords = payload.thumbnail_text.trim().split(/\s+/).length;
  if (thumbWords > 4) {
    score -= 10;
    notes.push("Thumbnail text too long (max 4 words for mobile CTR)");
  } else if (!THUMBNAIL_POWER_WORDS.test(payload.thumbnail_text)) {
    score -= 8;
    notes.push("Thumbnail text missing power words (EXPOSED, TRUTH, SECRET, etc.)");
  }

  if (
    payload.thumbnail_text.trim().toUpperCase() ===
    payload.title.trim().toUpperCase()
  ) {
    score -= 10;
    notes.push("Thumbnail text duplicates title — use a complementary hook");
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

  if (
    content.enableAbThumbnails &&
    payload.thumbnail_b_text.trim().toUpperCase() ===
      payload.thumbnail_text.trim().toUpperCase()
  ) {
    score -= 5;
    notes.push("Thumbnail A/B variants use identical overlay text");
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
