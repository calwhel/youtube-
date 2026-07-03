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
  chapters: Array<{ timestamp: string; title: string }>;
  scenes: Array<{
    voiceover_text: string;
    visual_prompt: string;
    overlay_text: string;
  }>;
}

Retention and packaging rules:
- topic: must match the selected episode topic above (one concise sentence)
- title: 40-65 characters, high CTR, matches title style "${config.content.titleStyle}" — use curiosity gap, specificity, or a bold claim (no clickbait lies)
- description: 2-4 SEO paragraphs PLUS a subscribe CTA; write for humans first
- tags: 10-15 high-intent tags mixing broad and long-tail
- thumbnail_prompt: bold, high-contrast, single focal subject, readable at mobile size, no clutter
- thumbnail_text: max 4 words, ALL CAPS friendly, complements (does not duplicate) the title
- thumbnail_b_prompt: alternate thumbnail image prompt — different angle/composition from variant A, same topic
- thumbnail_b_text: alternate thumbnail overlay text — different hook angle from thumbnail_text (max 4 words)
- short_title: punchy Shorts title under 70 chars ending with #Shorts — optimized for the hook clip
- pinned_comment: engaging question to pin on the video (1-2 sentences, drives comments)
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
  ] as const;

  for (const key of requiredStrings) {
    if (typeof payload[key] !== "string" || payload[key].trim() === "") {
      throw new Error(`LLM payload missing or invalid field: ${key}`);
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
