import type { VideoPayload, AuthenticityGateResult } from "../types/video";
import { estimateScriptWordCount } from "./quality-gate";

const YEAR_PATTERN = /\b(19|20)\d{2}\b/g;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?%?\b/g;
const PROPER_NOUN_PATTERN = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g;

function tokenizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenizeTitle(a);
  const tokensB = tokenizeTitle(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

function countEntitySignals(text: string): number {
  const years = text.match(YEAR_PATTERN)?.length ?? 0;
  const numbers = text.match(NUMBER_PATTERN)?.length ?? 0;
  const properNouns = text.match(PROPER_NOUN_PATTERN)?.length ?? 0;
  return years + numbers + properNouns;
}

export function runAuthenticityGate(
  payload: VideoPayload,
  recentTitles: string[],
): AuthenticityGateResult {
  const notes: string[] = [];
  let authenticityScore = 100;
  let inauthenticityRisk = 0;

  if (payload.unique_thesis.trim().length < 30) {
    authenticityScore -= 20;
    inauthenticityRisk += 25;
    notes.push("Unique thesis is too short — needs a clear, original argument");
  }

  if (payload.contrarian_angle.trim().length < 20) {
    authenticityScore -= 15;
    inauthenticityRisk += 20;
    notes.push("Missing contrarian angle — video may read as generic recap");
  }

  if (payload.creator_perspective.trim().length < 25) {
    authenticityScore -= 15;
    inauthenticityRisk += 20;
    notes.push("Creator perspective too weak — add channel POV and editorial judgment");
  }

  if (payload.specific_examples.length < 3) {
    authenticityScore -= 15;
    inauthenticityRisk += 20;
    notes.push(`Only ${payload.specific_examples.length} specific examples (need 3+)`);
  }

  if (payload.sources_cited.length < 2) {
    authenticityScore -= 10;
    inauthenticityRisk += 15;
    notes.push(`Only ${payload.sources_cited.length} sources cited (need 2+)`);
  }

  const fullScript = payload.scenes.map((scene) => scene.voiceover_text).join(" ");
  const entitySignals = countEntitySignals(fullScript);

  if (entitySignals < 8) {
    authenticityScore -= 15;
    inauthenticityRisk += 25;
    notes.push(
      `Low factual density (${entitySignals} entity signals) — add names, dates, numbers`,
    );
  }

  const genericPhrases =
    /\b(in this video|did you know|let's dive in|without further ado|in conclusion|subscribe for more)\b/gi;
  const genericMatches = fullScript.match(genericPhrases)?.length ?? 0;
  if (genericMatches > 4) {
    authenticityScore -= 10;
    inauthenticityRisk += 15;
    notes.push("Script uses too many generic YouTube filler phrases");
  }

  for (const recentTitle of recentTitles) {
    const similarity = titleSimilarity(payload.title, recentTitle);
    if (similarity >= 0.6) {
      authenticityScore -= 15;
      inauthenticityRisk += 20;
      notes.push(`Title too similar to recent video: "${recentTitle}"`);
      break;
    }
  }

  const totalWords = estimateScriptWordCount(payload);
  if (totalWords > 0) {
    const exampleWords = payload.specific_examples.join(" ").split(/\s+/).length;
    const insightRatio = exampleWords / totalWords;
    if (insightRatio < 0.08) {
      authenticityScore -= 10;
      inauthenticityRisk += 10;
      notes.push("Specific examples are not substantively woven into the script");
    }
  }

  authenticityScore = Math.max(0, Math.min(100, authenticityScore));
  inauthenticityRisk = Math.max(0, Math.min(100, inauthenticityRisk));

  const passed = authenticityScore >= 65 && inauthenticityRisk <= 40;

  return {
    passed,
    authenticityScore,
    inauthenticityRisk,
    notes,
  };
}

export function appendSourcesToDescription(
  description: string,
  sources: string[],
): string {
  if (sources.length === 0) {
    return description;
  }

  const sourceBlock = sources.map((source) => `- ${source}`).join("\n");
  return `${description.trim()}\n\nSources & further reading:\n${sourceBlock}`;
}
