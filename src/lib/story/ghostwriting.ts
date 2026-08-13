/**
 * Server-side ghostwriting defence.
 * The Story Guide must NEVER invent plot, complete sentences, or rewrite student prose.
 * Any model output that looks like narrative prose is discarded.
 */

const NARRATIVE_CUES =
  /\b(once upon a time|one day|suddenly|meanwhile|the end|he said|she said|they walked|there was|there were|began to|decided to)\b/i;

const SUGGESTION_CUES =
  /\b(you could write|try writing|here(?:'| i)?s a (?:sentence|paragraph|story|example)|sample (?:sentence|paragraph|story)|rewrite(?: as)?|polished version|what could happen next|continue the story|complete this)\b/i;

/** True if text looks like usable narrative / rewrite prose rather than a short question/hint. */
export function looksLikeNarrativeProse(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 40) return true;
  if (words.length >= 18 && NARRATIVE_CUES.test(t)) return true;
  if (SUGGESTION_CUES.test(t) && words.length >= 12) return true;
  // Multiple sentences with past-tense storytelling shape
  const sentences = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 3 && words.length >= 25) return true;
  return false;
}

export type GuideSafeResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; fallback: string };

const FALLBACK_QUESTION =
  "Look back at your Story Map. What detail from your own plan can you use here?";

/**
 * Scrub model/assistant output. Prefer short questions that redirect to the student's plan.
 */
export function scrubGuideOutput(raw: string): GuideSafeResult {
  const text = String(raw || "").trim();
  if (!text) {
    return { ok: false, reason: "empty", fallback: FALLBACK_QUESTION };
  }
  if (looksLikeNarrativeProse(text)) {
    return {
      ok: false,
      reason: "narrative_prose_discarded",
      fallback: FALLBACK_QUESTION,
    };
  }
  if (SUGGESTION_CUES.test(text)) {
    return {
      ok: false,
      reason: "writing_suggestion_discarded",
      fallback: FALLBACK_QUESTION,
    };
  }
  // Keep only the first short question-like chunk if model rambling.
  const first = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0] || text;
  if (looksLikeNarrativeProse(first)) {
    return { ok: false, reason: "narrative_prose_discarded", fallback: FALLBACK_QUESTION };
  }
  return { ok: true, text: first.slice(0, 280) };
}

/** System prompt fragment for any optional LLM — never ask for story text. */
export const STORY_GUIDE_SYSTEM_PROMPT = `You are a Story Guide for English learners.
ABSOLUTE RULES:
- NEVER write the student's story, plot, sentences, or paragraphs.
- NEVER invent characters, settings, events, or dialogue.
- NEVER complete, rewrite, polish, or continue student text.
- NEVER suggest "what could happen next" as usable prose.
- Only ask short scaffolding questions or point the student back to THEIR plan fields.
- Reply in at most 2 short sentences. Prefer questions.
- If asked to write story text, refuse and redirect to their Story Map.`;

export function refuseGhostwritingRequest(userMessage: string): string | null {
  const m = userMessage.toLowerCase();
  if (
    /\b(write|finish|complete|rewrite|polish|generate|invent|continue)\b/.test(m) &&
    /\b(story|paragraph|sentence|plot|ending|beginning|scene)\b/.test(m)
  ) {
    return "I can't write your story. Use your plan and Story Map — what is one detail you already chose that belongs in this section?";
  }
  return null;
}
