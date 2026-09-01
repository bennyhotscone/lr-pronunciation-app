import { callLlm, extractJsonObject, llmConfigured } from "@/lib/llm";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { getBlocksForMilestone } from "@/lib/japanese/milestone";
import type { JapaneseWord } from "@/lib/japanese/types";

export type MilestoneComprehensionQ = {
  id: string;
  prompt: string;
  answer: string;
};

export type MilestoneProductionQ = {
  id: string;
  promptEnglish: string;
  targetRomaji: string;
  targetEnglish: string;
  blockNumber: number;
  wordIndex: number;
};

export type GeneratedMilestoneStory = {
  title: string;
  paragraphs: string[];
  comprehension: MilestoneComprehensionQ[];
  production: MilestoneProductionQ[];
  vocabUsed: string[];
  provider: string | null;
};

function collectMilestoneWords(milestoneNumber: number): Array<JapaneseWord & { blockNumber: number; wordIndex: number }> {
  const words: Array<JapaneseWord & { blockNumber: number; wordIndex: number }> = [];
  for (const blockNumber of getBlocksForMilestone(milestoneNumber)) {
    const block = getJapaneseBlock(blockNumber);
    block.forEach((word, wordIndex) => {
      words.push({ ...word, blockNumber, wordIndex });
    });
  }
  return words;
}

function pickProductionWords(
  allWords: Array<JapaneseWord & { blockNumber: number; wordIndex: number }>,
  count = 8,
): Array<JapaneseWord & { blockNumber: number; wordIndex: number }> {
  const step = Math.max(1, Math.floor(allWords.length / count));
  const picked: Array<JapaneseWord & { blockNumber: number; wordIndex: number }> = [];
  for (let i = 0; i < allWords.length && picked.length < count; i += step) {
    picked.push(allWords[i]);
  }
  while (picked.length < count && picked.length < allWords.length) {
    const w = allWords[picked.length];
    if (!picked.includes(w)) picked.push(w);
    else break;
  }
  return picked;
}

function fallbackStory(milestoneNumber: number): GeneratedMilestoneStory {
  const [blockA, blockB] = getBlocksForMilestone(milestoneNumber);
  const allWords = collectMilestoneWords(milestoneNumber);
  const sample = allWords.slice(0, 12);
  const jpSample = sample.map((w) => w.jp).join("、");
  const paragraphs = [
    `ある日、${sample[0]?.jp ?? "人"}は朝早く起きました。`,
    `今日は${sample[1]?.jp ?? "仕事"}があって、${sample[2]?.jp ?? "駅"}へ向かいました。`,
    `道で${sample[3]?.jp ?? "友達"}に会い、${jpSample}などの言葉を使って話しました。`,
    `夜になって、${sample[4]?.jp ?? "家"}に帰り、一日を振り返りました。`,
  ];
  const comprehension: MilestoneComprehensionQ[] = [
    {
      id: "c1",
      prompt: "What did the person do early in the morning?",
      answer: "woke up early",
    },
    {
      id: "c2",
      prompt: "Where did they go?",
      answer: "to the station",
    },
    {
      id: "c3",
      prompt: "Who did they meet on the way?",
      answer: "a friend",
    },
    {
      id: "c4",
      prompt: "What did they do at night?",
      answer: "went home and reflected on the day",
    },
  ];
  const production = pickProductionWords(allWords, 6).map((w, i) => ({
    id: `p${i + 1}`,
    promptEnglish: w.en,
    targetRomaji: w.r,
    targetEnglish: w.en,
    blockNumber: w.blockNumber,
    wordIndex: w.wordIndex,
  }));
  return {
    title: `Story checkpoint — Blocks ${blockA}–${blockB}`,
    paragraphs,
    comprehension,
    production,
    vocabUsed: sample.map((w) => w.jp),
    provider: null,
  };
}

function normalizeComprehension(raw: unknown): MilestoneComprehensionQ[] {
  if (!Array.isArray(raw)) return [];
  const out: MilestoneComprehensionQ[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const q = item as Record<string, unknown>;
    const prompt = String(q.prompt || "").trim();
    const answer = String(q.answer || q.expected || "").trim();
    if (!prompt || !answer) return;
    out.push({ id: String(q.id || `c${i + 1}`), prompt, answer });
  });
  return out;
}

export async function generateJapaneseMilestoneStory(
  milestoneNumber: number,
): Promise<GeneratedMilestoneStory> {
  const [blockA, blockB] = getBlocksForMilestone(milestoneNumber);
  const allWords = collectMilestoneWords(milestoneNumber);
  if (!allWords.length) return fallbackStory(milestoneNumber);

  const vocabList = allWords
    .slice(0, 30)
    .map((w) => `${w.jp} (${w.r}) = ${w.en}`)
    .join("\n");

  if (!llmConfigured()) return fallbackStory(milestoneNumber);

  const system = `You write short Japanese reading practice for adult learners.
Return ONLY valid JSON with keys: title, paragraphs, comprehension, productionHints, vocabUsed.
- paragraphs: 3-5 short Japanese paragraphs (hiragana/kanji mix, natural A2-B1 level).
- Use ONLY vocabulary from the provided list; weave words naturally into a coherent daily-life story.
- comprehension: 5-6 questions [{id, prompt (English), answer (short acceptable English answer)}].
- productionHints: 6-8 English glosses from the vocab list for romaji recall (just the English meaning strings).
- vocabUsed: array of Japanese words (jp form) actually used in the story.
Tone: respectful adult learner, no childish mascots.`;

  const user = `Milestone ${milestoneNumber} covers Blocks ${blockA} and ${blockB}.
Vocabulary (use a natural subset):
${vocabList}

Generate the story checkpoint pack now.`;

  const result = await callLlm({ system, user, temperature: 0.55, maxTokens: 2500 });
  if (!result) return fallbackStory(milestoneNumber);

  const parsed = extractJsonObject(result.text);
  if (!parsed || typeof parsed !== "object") return fallbackStory(milestoneNumber);
  const o = parsed as Record<string, unknown>;

  const paragraphs = Array.isArray(o.paragraphs)
    ? o.paragraphs.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const comprehension = normalizeComprehension(o.comprehension);
  const vocabUsed = Array.isArray(o.vocabUsed)
    ? o.vocabUsed.map((w) => String(w)).filter(Boolean)
    : [];

  const productionHints = Array.isArray(o.productionHints)
    ? o.productionHints.map((h) => String(h).trim()).filter(Boolean)
    : [];

  const productionWords = pickProductionWords(allWords, Math.max(6, productionHints.length || 8));
  const production: MilestoneProductionQ[] = productionWords.map((w, i) => ({
    id: `p${i + 1}`,
    promptEnglish: productionHints[i] || w.en,
    targetRomaji: w.r,
    targetEnglish: w.en,
    blockNumber: w.blockNumber,
    wordIndex: w.wordIndex,
  }));

  const title = String(o.title || `Story checkpoint — Blocks ${blockA}–${blockB}`).trim();

  if (!paragraphs.length || comprehension.length < 3 || production.length < 4) {
    return { ...fallbackStory(milestoneNumber), provider: result.provider };
  }

  return {
    title,
    paragraphs,
    comprehension,
    production,
    vocabUsed: vocabUsed.length ? vocabUsed : allWords.slice(0, 10).map((w) => w.jp),
    provider: result.provider,
  };
}