import type { ServiceConfig } from "../config/channel-config";
import type { TopPerformingTopic, TopicCandidate } from "../types/video";
import { withRetry } from "../utils/tmp";

const SUGGEST_URL =
  "https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=";

function extractJsonArray(raw: string): string[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return [];
    }

    const suggestions = parsed[1];
    if (!Array.isArray(suggestions)) {
      return [];
    }

    return suggestions
      .map((item) => (Array.isArray(item) ? item[0] : item))
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function nicheKeywords(nichePrompt: string): string[] {
  const words = nichePrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const unique = [...new Set(words)].slice(0, 6);
  if (unique.length === 0) {
    return ["documentary", "explained"];
  }

  return unique;
}

async function fetchYouTubeSuggestions(query: string): Promise<string[]> {
  const url = `${SUGGEST_URL}${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return [];
  }

  const raw = await response.text();
  return extractJsonArray(raw);
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }

  throw new Error("Topic research response did not contain a JSON array");
}

function assertTopicCandidates(value: unknown): TopicCandidate[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Topic research returned an empty array");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Topic candidate ${index} is not an object`);
    }

    const record = item as Record<string, unknown>;
    if (typeof record.topic !== "string" || record.topic.trim() === "") {
      throw new Error(`Topic candidate ${index} missing topic`);
    }

    return {
      topic: record.topic.trim(),
      score: Number(record.score ?? 0),
      rationale: String(record.rationale ?? ""),
      searchIntent: String(record.search_intent ?? record.searchIntent ?? ""),
    };
  });
}

export interface TopicResearchOptions {
  excludedTopics: string[];
  topPerformers: TopPerformingTopic[];
  forcedTopic?: string;
}

export class TopicResearchService {
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  async selectTopic(options: TopicResearchOptions): Promise<string> {
    if (options.forcedTopic?.trim()) {
      return options.forcedTopic.trim();
    }

    const suggestions = await this.gatherSuggestions();
    const candidates = await this.scoreTopics({
      suggestions,
      excludedTopics: options.excludedTopics,
      topPerformers: options.topPerformers,
    });

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    console.log(
      `[topic-research] selected topic="${chosen.topic}" score=${chosen.score} intent=${chosen.searchIntent}`,
    );

    return chosen.topic;
  }

  private async gatherSuggestions(): Promise<string[]> {
    const keywords = nicheKeywords(this.config.nichePrompt);
    const queries = [
      this.config.nichePrompt.slice(0, 80),
      ...keywords.map((keyword) => `${keyword} explained`),
      ...keywords.map((keyword) => `why ${keyword}`),
      ...keywords.map((keyword) => `${keyword} mystery`),
    ];

    const suggestionSets = await Promise.all(
      queries.slice(0, 8).map((query) => fetchYouTubeSuggestions(query)),
    );

    const merged = new Set<string>();
    for (const set of suggestionSets) {
      for (const suggestion of set) {
        merged.add(suggestion);
      }
    }

    return [...merged].slice(0, 40);
  }

  private async scoreTopics(input: {
    suggestions: string[];
    excludedTopics: string[];
    topPerformers: TopPerformingTopic[];
  }): Promise<TopicCandidate[]> {
    const performerBlock =
      input.topPerformers.length > 0
        ? `\nTop performing topics on this channel (double down on similar angles):\n${input.topPerformers
            .map(
              (row) =>
                `- "${row.topic}" (${row.view_count} views, ${(row.ctr * 100).toFixed(1)}% CTR)`,
            )
            .join("\n")}`
        : "";

    const exclusionBlock =
      input.excludedTopics.length > 0
        ? `\nDo NOT suggest these already-covered topics:\n${input.excludedTopics
            .map((topic) => `- ${topic}`)
            .join("\n")}`
        : "";

    const suggestionsBlock =
      input.suggestions.length > 0
        ? `\nYouTube search autocomplete suggestions (use as demand signals):\n${input.suggestions
            .map((topic) => `- ${topic}`)
            .join("\n")}`
        : "";

    const systemPrompt = `You are a YouTube growth strategist. Score topic ideas for maximum views and watch time within a specific niche.

Channel niche and style:
${this.config.nichePrompt}

Audience level: ${this.config.content.audienceLevel}
Preferred title style: ${this.config.content.titleStyle}
Target video length: ${this.config.content.targetDurationMinutes} minutes

Return ONLY a JSON array of 5 objects with this shape:
[
  {
    "topic": "specific episode topic (one concise sentence)",
    "score": 0-100,
    "rationale": "why this will get clicks and retention",
    "search_intent": "informational|curiosity|story|news"
  }
]

Score higher when the topic has:
- Strong curiosity gap / open loop potential
- Clear search demand
- Broad appeal within the niche
- Visual storytelling potential for faceless video
- Room for 8-12 minute deep-dive structure${exclusionBlock}${performerBlock}${suggestionsBlock}`;

    return withRetry(
      async () => {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: this.config.anthropic.apiKey });

        const response = await client.messages.create({
          model: this.config.anthropic.model,
          max_tokens: 2048,
          temperature: 0.5,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content:
                "Propose and score 5 fresh high-potential video topics for the next upload. Return JSON array only.",
            },
          ],
        });

        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("Topic research response had no text");
        }

        const jsonString = extractJsonObject(textBlock.text);
        const parsed = JSON.parse(jsonString) as unknown;
        return assertTopicCandidates(parsed);
      },
      {
        ...this.config.retry,
        label: "topic-research",
      },
    );
  }
}
