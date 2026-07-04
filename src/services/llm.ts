import Anthropic from "@anthropic-ai/sdk";

import type { ServiceConfig } from "../config/channel-config";
import type { VideoPayload } from "../types/video";
import { withRetry } from "../utils/tmp";

function buildSystemPrompt(
  config: ServiceConfig,
  excludedTopics: string[],
  selectedTopic: string,
): string {
  const exclusionBlock =
    excludedTopics.length > 0
      ? `\nDo NOT reuse these previously covered topics:\n${excludedTopics
          .map((topic) => `- ${topic}`)
          .join("\n")}`
      : "";

  const targetWords = config.content.targetDurationMinutes * 150;
  const minWords = Math.floor(targetWords * 0.85);
  const maxWords = Math.ceil(targetWords * 1.15);

  return `You are an elite YouTube scriptwriter optimized for CTR, retention, and watch time.

Channel niche and style:
${config.nichePrompt}

Audience level: ${config.content.audienceLevel}
Title style preference: ${config.content.titleStyle}
Target runtime: ${config.content.targetDurationMinutes} minutes (~${minWords}-${maxWords} total voiceover words)

Selected episode topic (build the entire video around this):
${selectedTopic}

Return ONLY a single minified valid JSON object with no markdown, no code fences, and no commentary.

The JSON must match this TypeScript interface exactly:
interface VideoPayload {
  topic: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail_prompt: string;
  thumbnail_text: string;
  thumbnail_b_prompt: string;
  thumbnail_b_text: string;
  short_title: string;
  pinned_comment: string;
  unique_thesis: string;
  contrarian_angle: string;
  creator_perspective: string;
  specific_examples: string[];
  sources_cited: string[];
  chapters: Array<{ timestamp: string; title: string }>;
  scenes: Array<{
    voiceover_text: string;
    visual_prompt: string;
    overlay_text: string;
  }>;
}

Retention and packaging rules (MAXIMIZE CLICKS — thumbnail and title are priority #1):
- topic: must match the selected episode topic above (one concise sentence)
- title: 45-65 characters, HIGH CTR clickbait-style — curiosity gap, bold claim, numbers, or "why X is wrong" — must still be deliverable in the video (no outright lies)
- description: 2-4 SEO paragraphs PLUS a subscribe CTA; front-load the hook in line 1; include 3-5 searchable keywords naturally
- tags: 12-15 tags mixing viral broad terms + long-tail search phrases
- thumbnail_prompt: extreme close-up face or object, high saturation, dramatic lighting, single focal point, mobile-readable, MrBeast/viral documentary style
- thumbnail_text: 2-4 words MAX, ALL CAPS, power words (EXPOSED, TRUTH, WRONG, SECRET, INSANE, HIDDEN, FINALLY) — must create curiosity WITHOUT repeating the title verbatim
- thumbnail_b_prompt: alternate composition — different color mood (e.g. red vs yellow accent), zoomed subject, arrow or shock visual implied in prompt
- thumbnail_b_text: different hook angle from variant A — test fear vs curiosity vs controversy (2-4 words ALL CAPS)
- short_title: punchy hook under 60 chars + #Shorts — open loop in first 5 words
- pinned_comment: controversial or debate-sparking question to drive comments (essential for algorithm)

Authenticity rules (CRITICAL for YouTube monetization — avoid inauthentic/mass-produced content flags):
- unique_thesis: one sentence stating the video's original argument — what conventional wisdom gets wrong, or your channel's fresh take
- contrarian_angle: 1-2 sentences explaining what most videos on this topic miss, and why your angle is different
- creator_perspective: 2-3 sentences in the channel's editorial voice — use "we" or "this channel" and show human judgment, not generic narration
- specific_examples: array of 3-6 concrete examples with names, dates, numbers, or real-world cases (not vague generalities)
- sources_cited: array of 2-5 plausible reference sources (studies, institutions, missions, books, official reports — format as readable citations)
- Weave specific_examples naturally into scene voiceovers — do NOT just list facts; explain why each example matters
- Avoid generic filler: "in this video", "did you know", "without further ado", "smash that subscribe button"
- Each video must feel materially different in substance, not just wording

- chapters: 4-8 entries with MM:SS timestamps starting at 00:00; align to scene boundaries
- scenes: 6-10 scenes

Script structure (critical for retention):
1. Scene 1 HOOK (first ~40 words): open a curiosity loop — bold claim, surprising fact, or "what if" — speak directly to the viewer
2. Scenes 2-3: deliver on the hook promise quickly; add stakes
3. Middle scenes: pattern interrupts every 45-60 seconds — "But here's where it gets strange...", mini-reveals, contrast, or rhetorical questions
4. Penultimate scene: biggest payoff / climax
5. Final scene: strong conclusion + subscribe CTA + tease related topic

Per-scene rules:
- voiceover_text: 2-5 sentences, conversational, paced for spoken delivery
- visual_prompt: cinematic, specific, matches voiceover beat (documentary/stock style)
- overlay_text: 3-6 words max for on-screen emphasis

Total voiceover word count MUST land between ${minWords} and ${maxWords} words.
Stay strictly within the channel niche and tone.
Output must be parseable JSON only.${exclusionBlock}`;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("LLM response did not contain a JSON object");
}

function assertVideoPayload(value: unknown): VideoPayload {
  if (!value || typeof value !== "object") {
    throw new Error("LLM payload is not an object");
  }

  const payload = value as Record<string, unknown>;

  const requiredStrings = [
    "topic",
    "title",
    "description",
    "thumbnail_prompt",
    "thumbnail_text",
    "thumbnail_b_prompt",
    "thumbnail_b_text",
    "short_title",
    "pinned_comment",
    "unique_thesis",
    "contrarian_angle",
    "creator_perspective",
  ] as const;

  for (const key of requiredStrings) {
    if (typeof payload[key] !== "string" || payload[key].trim() === "") {
      throw new Error(`LLM payload missing or invalid field: ${key}`);
    }
  }

  for (const arrayField of ["specific_examples", "sources_cited"] as const) {
    if (
      !Array.isArray(payload[arrayField]) ||
      payload[arrayField].length === 0
    ) {
      throw new Error(`LLM payload missing or invalid field: ${arrayField}`);
    }
    for (const [index, item] of payload[arrayField].entries()) {
      if (typeof item !== "string" || item.trim() === "") {
        throw new Error(`${arrayField}[${index}] must be a non-empty string`);
      }
    }
  }

  if (!Array.isArray(payload.tags) || payload.tags.length === 0) {
    throw new Error("LLM payload missing or invalid field: tags");
  }

  if (!Array.isArray(payload.scenes) || payload.scenes.length === 0) {
    throw new Error("LLM payload missing or invalid field: scenes");
  }

  if (payload.chapters !== undefined && !Array.isArray(payload.chapters)) {
    throw new Error("LLM payload invalid field: chapters");
  }

  for (const [index, scene] of payload.scenes.entries()) {
    if (!scene || typeof scene !== "object") {
      throw new Error(`Scene ${index} is not an object`);
    }
    const sceneRecord = scene as Record<string, unknown>;
    for (const key of ["voiceover_text", "visual_prompt", "overlay_text"] as const) {
      if (
        typeof sceneRecord[key] !== "string" ||
        sceneRecord[key].trim() === ""
      ) {
        throw new Error(`Scene ${index} missing or invalid field: ${key}`);
      }
    }
  }

  return payload as unknown as VideoPayload;
}

export interface GenerateScriptOptions {
  selectedTopic: string;
  excludedTopics?: string[];
}

export class LlmService {
  private readonly client: Anthropic;
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async generateScript(options: GenerateScriptOptions): Promise<VideoPayload> {
    const excludedTopics = options.excludedTopics ?? [];
    const systemPrompt = buildSystemPrompt(
      this.config,
      excludedTopics,
      options.selectedTopic,
    );

    return withRetry(
      async () => {
        const response = await this.client.messages.create({
          model: this.config.anthropic.model,
          max_tokens: 8192,
          temperature: 0.65,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Write a complete retention-optimized VideoPayload JSON for the topic: ${options.selectedTopic}`,
            },
          ],
        });

        const textBlock = response.content.find(
          (block) => block.type === "text",
        );
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("LLM response did not include text content");
        }

        const jsonString = extractJsonObject(textBlock.text);
        const parsed = JSON.parse(jsonString) as unknown;
        const payload = assertVideoPayload(parsed);
        payload.topic = options.selectedTopic.trim();

        return payload;
      },
      {
        ...this.config.retry,
        label: "anthropic-script-generation",
      },
    );
  }
}
