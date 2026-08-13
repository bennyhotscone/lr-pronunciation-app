import { callLlm, extractJsonObject, llmConfigured } from "@/lib/llm";

export const VOCAB_PRACTICE_DAILY_CAP = 2;

export type VocabComprehensionQ = {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
};

export type VocabActivity = {
  id: string;
  kind: "fill" | "match" | "use";
  prompt: string;
  word: string;
  /** For fill: expected answer; for match: pair target; for use: sample acceptable phrase */
  expected: string;
};

export type VocabPracticeActivities = {
  comprehension: VocabComprehensionQ[];
  vocabActivities: VocabActivity[];
};

export type GeneratedVocabPack = {
  title: string;
  story: string;
  vocabUsed: string[];
  activities: VocabPracticeActivities;
  provider: string | null;
};

function fallbackPack(words: string[]): GeneratedVocabPack {
  const used = words.slice(0, 8);
  const list = used.join(", ");
  const story = [
    `On Tuesday morning, Sam checked the schedule before the meeting.`,
    `The team needed to discuss a few ideas carefully, using words like ${list || "focus, plan, and review"}.`,
    `After a short break, everyone agreed on the next steps and wrote a clear summary.`,
  ].join(" ");

  const comprehension: VocabComprehensionQ[] = [
    {
      id: "c1",
      prompt: "When does the story take place?",
      choices: ["Tuesday morning", "Friday night", "Sunday afternoon", "Not said"],
      answerIndex: 0,
    },
    {
      id: "c2",
      prompt: "What did the team do after the break?",
      choices: [
        "They agreed on next steps and wrote a summary",
        "They cancelled the meeting",
        "They left without talking",
        "They argued about lunch",
      ],
      answerIndex: 0,
    },
  ];

  const vocabActivities: VocabActivity[] = used.slice(0, 4).map((word, i) => ({
    id: `v${i + 1}`,
    kind: i % 2 === 0 ? "fill" : "use",
    prompt:
      i % 2 === 0
        ? `Type the target word that fits: “We need a clear _____ before we start.” (${word})`
        : `Write one short work/study sentence using “${word}”.`,
    word,
    expected: word,
  }));

  return {
    title: "Practice story (offline pack)",
    story,
    vocabUsed: used,
    activities: { comprehension, vocabActivities },
    provider: null,
  };
}

function normalizeActivities(raw: unknown, words: string[]): VocabPracticeActivities {
  const empty: VocabPracticeActivities = { comprehension: [], vocabActivities: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const comprehension: VocabComprehensionQ[] = [];
  if (Array.isArray(o.comprehension)) {
    o.comprehension.forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const q = item as Record<string, unknown>;
      const prompt = String(q.prompt || "").trim();
      const choices = Array.isArray(q.choices)
        ? q.choices.map((c) => String(c)).filter(Boolean).slice(0, 4)
        : [];
      const answerIndex = Number(q.answerIndex);
      if (!prompt || choices.length < 2 || !Number.isFinite(answerIndex)) return;
      comprehension.push({
        id: String(q.id || `c${i + 1}`),
        prompt,
        choices,
        answerIndex: Math.max(0, Math.min(choices.length - 1, Math.floor(answerIndex))),
      });
    });
  }
  const vocabActivities: VocabActivity[] = [];
  if (Array.isArray(o.vocabActivities)) {
    o.vocabActivities.forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const a = item as Record<string, unknown>;
      const kindRaw = String(a.kind || "use");
      const kind = kindRaw === "fill" || kindRaw === "match" ? kindRaw : "use";
      const prompt = String(a.prompt || "").trim();
      const word = String(a.word || words[i] || "").trim();
      const expected = String(a.expected || word).trim();
      if (!prompt || !word) return;
      vocabActivities.push({
        id: String(a.id || `v${i + 1}`),
        kind,
        prompt,
        word,
        expected,
      });
    });
  }
  return { comprehension, vocabActivities };
}

export async function generateVocabPracticePack(words: string[]): Promise<GeneratedVocabPack> {
  const used = words.map((w) => w.trim()).filter(Boolean).slice(0, 10);
  if (!used.length) {
    return fallbackPack(["focus", "schedule", "summary", "discuss"]);
  }
  if (!llmConfigured()) return fallbackPack(used);

  const system = `You write short adult ESL reading practice for working professionals.
Return ONLY valid JSON with keys: title, story, vocabUsed (string[]), activities.
activities must be { comprehension: [{id,prompt,choices[4],answerIndex}], vocabActivities: [{id,kind:"fill"|"match"|"use",prompt,word,expected}] }.
Rules:
- Story: 120–180 words, realistic adult workplace/study life, natural English.
- Must include each vocab word from the list naturally (no childish mascots or cartoons).
- 3 multiple-choice comprehension questions.
- 4 vocab activities mixing fill / use.
- Tone: respectful adult learner.`;

  const user = `Target vocabulary: ${used.join(", ")}
Generate one practice pack now.`;

  const result = await callLlm({ system, user, temperature: 0.55, maxTokens: 2000 });
  if (!result) return fallbackPack(used);

  const parsed = extractJsonObject(result.text);
  if (!parsed || typeof parsed !== "object") return fallbackPack(used);
  const o = parsed as Record<string, unknown>;
  const title = String(o.title || "Vocabulary practice story").trim().slice(0, 120);
  const story = String(o.story || "").trim();
  const vocabUsed = Array.isArray(o.vocabUsed)
    ? o.vocabUsed.map((w) => String(w)).filter(Boolean)
    : used;
  const activities = normalizeActivities(o.activities, used);
  if (!story || activities.comprehension.length < 2) {
    return { ...fallbackPack(used), provider: result.provider };
  }
  return {
    title: title || "Vocabulary practice story",
    story,
    vocabUsed: vocabUsed.length ? vocabUsed : used,
    activities,
    provider: result.provider,
  };
}

export function utcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
