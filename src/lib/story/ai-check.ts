/**
 * Optional LLM story checks behind a clean interface.
 * Disable with STORY_AI_CHECKS=0 (or unset keys) — deterministic checks still run.
 */

import type { StoryCheckIssue } from "./types";
import {
  STORY_GUIDE_SYSTEM_PROMPT,
  scrubGuideOutput,
  refuseGhostwritingRequest,
} from "./ghostwriting";

export function storyAiChecksEnabled(): boolean {
  if (process.env.STORY_AI_CHECKS === "0" || process.env.STORY_AI_CHECKS === "false") {
    return false;
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
}

export type AiCheckInput = {
  /** Student plan summary only — never ask model to invent. */
  planSummary: string;
  draftExcerpt: string;
  passKind: string;
};

async function callLlm(system: string, user: string): Promise<string | null> {
  try {
    if (process.env.OPENAI_API_KEY?.trim()) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4o-mini",
          temperature: 0.1,
          max_tokens: 400,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content || null;
    }
    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_STORY_MODEL?.trim() || "claude-3-5-haiku-latest",
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return data.content?.find((c) => c.type === "text")?.text || null;
    }
  } catch {
    return null;
  }
  return null;
}

function parseIssuesJson(raw: string): StoryCheckIssue[] {
  const scrubbed = scrubGuideOutput(raw);
  // Even if scrub fails for prose, try JSON extract first.
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    if (!scrubbed.ok) return [];
    return [
      {
        code: "AI_HINT",
        severity: "info",
        message: scrubbed.text,
      },
    ];
  }
  try {
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: StoryCheckIssue[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const message = String(o.message || "").trim();
      const hint = o.hint != null ? String(o.hint).trim() : undefined;
      if (!message) continue;
      // Discard issues that smuggle narrative prose.
      if (!scrubGuideOutput(message).ok) continue;
      if (hint && !scrubGuideOutput(hint).ok) {
        out.push({
          code: String(o.code || "AI_ISSUE"),
          severity: (["info", "warn", "error"].includes(String(o.severity))
            ? String(o.severity)
            : "info") as StoryCheckIssue["severity"],
          message,
          target: o.target != null ? String(o.target) : undefined,
        });
        continue;
      }
      out.push({
        code: String(o.code || "AI_ISSUE"),
        severity: (["info", "warn", "error"].includes(String(o.severity))
          ? String(o.severity)
          : "info") as StoryCheckIssue["severity"],
        message,
        hint,
        target: o.target != null ? String(o.target) : undefined,
      });
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

/** Optional AI check — returns [] on disable/failure (graceful degradation). */
export async function optionalAiStoryIssues(input: AiCheckInput): Promise<StoryCheckIssue[]> {
  if (!storyAiChecksEnabled()) return [];

  const system = `${STORY_GUIDE_SYSTEM_PROMPT}

Return ONLY a JSON array of issue objects:
[{"code":"STRING","severity":"info|warn|error","message":"short question or observation","hint":"optional short redirect to their plan","target":"optional"}]
Never include story sentences, rewrites, or plot ideas in message/hint.`;

  const user = `Pass: ${input.passKind}
Student plan (authoritative — do not invent beyond this):
${input.planSummary.slice(0, 1500)}

Student draft excerpt (do not rewrite):
${input.draftExcerpt.slice(0, 2000)}

List gaps as QUESTIONS about alignment with THEIR plan only.`;

  const raw = await callLlm(system, user);
  if (!raw) return [];
  return parseIssuesJson(raw);
}

/** Optional guide chat — always scrubbed; refuses ghostwriting. */
export async function optionalStoryGuideReply(params: {
  step: string;
  planSummary: string;
  userMessage: string;
}): Promise<{ text: string; blocked: boolean }> {
  const refused = refuseGhostwritingRequest(params.userMessage);
  if (refused) return { text: refused, blocked: true };

  if (!storyAiChecksEnabled()) {
    return {
      text: "Look at your Story Map for this step. What is one detail you already wrote that belongs here?",
      blocked: false,
    };
  }

  const raw = await callLlm(
    STORY_GUIDE_SYSTEM_PROMPT,
    `Wizard step: ${params.step}
Student plan:
${params.planSummary.slice(0, 1200)}
Student question: ${params.userMessage.slice(0, 400)}
Reply with at most two short scaffolding questions. No story prose.`,
  );
  if (!raw) {
    return {
      text: "I can't write for you. Which part of your plan are you stuck turning into your own sentence?",
      blocked: false,
    };
  }
  const scrubbed = scrubGuideOutput(raw);
  if (!scrubbed.ok) return { text: scrubbed.fallback, blocked: true };
  return { text: scrubbed.text, blocked: false };
}
