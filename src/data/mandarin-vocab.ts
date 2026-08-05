/**
 * Mandarin-speaker English vocabulary curriculum.
 * Designed for 50 groups × 100 words = 5,000 total — frequency batches for
 * mahjong are 50 words each (ranks 1–50, 51–100, …).
 *
 * Word order follows the approved COCA-style frequency lemma list in
 * scripts/words-1-200.json / A Frequency Dictionary INDEX.pdf ranks.
 * The INDEX has headword + POS + rank only (no Chinese). Chinese glosses
 * below are curated learner glosses aligned to those ranks — not OCR’d
 * from the book. Gaps / uncertain senses should be flagged in Audio Studio.
 *
 * Audio: ranks with audioFile are draft bulk cuts unless marked OK in Studio.
 * Do not claim unreviewed clips are good.
 */

export const TOTAL_WORDS = 5000;
export const GROUP_SIZE = 100;
export const MAHJONG_BATCH_SIZE = 50;
export const TOTAL_GROUPS = TOTAL_WORDS / GROUP_SIZE; // 50
export const AUDIO_BASE = "/audio/mandarin-vocab";

export type DifficultyMode = "mandarin" | "english" | "easy";

export type MandarinVocabWord = {
  rank: number;
  word: string;
  /** Filename only, e.g. 0001-the.mp3. Empty when audio is not ready. */
  audioFile: string;
  zh: string;
  en: string;
  group: number;
};

function entry(
  rank: number,
  word: string,
  zh: string,
  en: string,
  audioFile = "",
): MandarinVocabWord {
  return {
    rank,
    word,
    audioFile,
    zh,
    en,
    group: Math.ceil(rank / GROUP_SIZE),
  };
}

/**
 * Ranks 1–100 with curated Mandarin glosses for mahjong + quiz.
 * Audio filenames only where a clip file is expected in public/.
 */
export const MANDARIN_VOCAB_WORDS: MandarinVocabWord[] = [
  entry(1, "the", "这个／那个（定冠词）", "used before a specific person or thing", "0001-the.mp3"),
  entry(2, "be", "是；成为", "to exist or have a particular state", "0002-be.mp3"),
  entry(3, "and", "和；而且", "used to connect words or ideas", "0003-and.mp3"),
  entry(4, "of", "……的；属于", "used to show connection or belonging", "0004-of.mp3"),
  entry(5, "a", "一个（不定冠词）", "used before one non-specific thing", "0005-a.mp3"),
  entry(6, "in", "在……里面", "inside a place, area, or period of time", "0006-in.mp3"),
  entry(7, "to", "去；向；到", "in the direction of a place or person", "0007-to.mp3"),
  entry(8, "have", "有；拥有", "to own, hold, or possess something", "0008-have.mp3"),
  entry(9, "it", "它；这件事", "a pronoun for a thing or situation", "0009-it.mp3"),
  entry(10, "I", "我", "the speaker referring to himself or herself", "0010-i.mp3"),
  entry(11, "that", "那个；引导从句", "used to point to something or introduce a clause", "0011-that.mp3"),
  entry(12, "for", "为了；给；对于", "intended to help, benefit, or be used by", "0012-for.mp3"),
  entry(13, "you", "你；你们", "the person or people being spoken to", "0013-you.mp3"),
  entry(14, "he", "他", "a male person already mentioned", "0014-he.mp3"),
  entry(15, "with", "和；带着；用", "together with or using something", "0015-with.mp3"),
  entry(16, "on", "在……上面", "touching or supported by a surface", "0016-on.mp3"),
  entry(17, "do", "做；进行", "to perform an action or activity", "0017-do.mp3"),
  entry(18, "say", "说；讲", "to speak words or express something", "0018-say.mp3"),
  entry(19, "this", "这个；这", "used to point to something near or just mentioned", "0019-this.mp3"),
  entry(20, "they", "他们；她们；它们", "people, animals, or things already mentioned", "0020-they.mp3"),
  entry(21, "at", "在（某地／某时）", "in a particular place or time"),
  entry(22, "but", "但是；可是", "used to show contrast"),
  entry(23, "we", "我们", "the speaker and one or more other people"),
  entry(24, "his", "他的", "belonging to a male person already mentioned"),
  entry(25, "from", "从；来自", "starting at a place, time, or source"),
  entry(26, "not", "不；没有", "used to make a negative"),
  entry(27, "by", "被；由；靠近", "near, through, or done by someone"),
  entry(28, "she", "她", "a female person already mentioned"),
  entry(29, "or", "或者；还是", "used to connect alternatives"),
  entry(30, "as", "作为；像；当……时", "in the role of; like; when"),
  entry(31, "what", "什么", "asking for information about something"),
  entry(32, "go", "去；走", "to move or travel to a place"),
  entry(33, "their", "他们的；她们的；它们的", "belonging to people or things already mentioned"),
  entry(34, "can", "能；可以", "to be able to; permitted to"),
  entry(35, "who", "谁；……的人", "asking which person; the person that"),
  entry(36, "get", "得到；变得", "to receive, obtain, or become"),
  entry(37, "if", "如果；是否", "on the condition that; whether"),
  entry(38, "would", "会；将；愿意（过去语气）", "used for polite or conditional actions"),
  entry(39, "her", "她的；她（宾格）", "belonging to a female; or that female as object"),
  entry(40, "all", "全部；所有", "the whole amount or every one"),
  entry(41, "my", "我的", "belonging to the speaker"),
  entry(42, "make", "做；使成为", "to create, cause, or force something"),
  entry(43, "about", "关于；大约", "on the subject of; approximately"),
  entry(44, "know", "知道；认识", "to have information or be familiar with"),
  entry(45, "will", "将；会", "used to talk about the future or willingness"),
  entry(46, "up", "向上；起来", "to a higher place or upright position"),
  entry(47, "one", "一；一个", "the number 1; a single person or thing"),
  entry(48, "time", "时间；次数", "measurable duration; an occasion"),
  entry(49, "there", "那里；有（there is）", "in that place; used with “be” to show existence"),
  entry(50, "year", "年；岁", "a period of 12 months"),
  entry(51, "so", "所以；如此", "therefore; to such a degree"),
  entry(52, "think", "想；认为", "to use the mind; to believe"),
  entry(53, "when", "什么时候；当……时", "at what time; at the time that"),
  entry(54, "which", "哪一个；……的", "asking for a choice; used to add information"),
  entry(55, "them", "他们；她们；它们（宾格）", "people or things already mentioned (object)"),
  entry(56, "some", "一些；某个", "an unspecified amount or number"),
  entry(57, "me", "我（宾格）", "the speaker as the object"),
  entry(58, "people", "人；人们", "human beings in general"),
  entry(59, "take", "拿；带；花费", "to get hold of, carry, or require"),
  entry(60, "out", "出去；向外", "away from inside; outdoors"),
  entry(61, "into", "进入；成为", "to the inside of; to a new state"),
  entry(62, "just", "刚刚；只是", "a short time ago; only"),
  entry(63, "see", "看见；明白", "to notice with the eyes; to understand"),
  entry(64, "him", "他（宾格）", "a male person as the object"),
  entry(65, "your", "你的；你们的", "belonging to the person spoken to"),
  entry(66, "come", "来；到来", "to move toward the speaker or a place"),
  entry(67, "could", "能够；可能（过去／委婉）", "past ability; polite possibility"),
  entry(68, "now", "现在", "at the present time"),
  entry(69, "than", "比", "used in comparisons"),
  entry(70, "like", "喜欢；像", "to enjoy; similar to"),
  entry(71, "other", "其他的；另一个", "different or additional"),
  entry(72, "how", "怎样；多么", "in what way; to what degree"),
  entry(73, "then", "然后；那时", "next; at that time"),
  entry(74, "its", "它的", "belonging to a thing already mentioned"),
  entry(75, "our", "我们的", "belonging to us"),
  entry(76, "two", "二；两个", "the number 2"),
  entry(77, "more", "更多", "a greater amount or degree"),
  entry(78, "these", "这些", "the ones near or just mentioned (plural)"),
  entry(79, "want", "想要", "to wish for or desire"),
  entry(80, "way", "方式；路", "a method or a path"),
  entry(81, "look", "看；看起来", "to direct the eyes; to appear"),
  entry(82, "first", "第一；首先", "before all others"),
  entry(83, "also", "也；同样", "in addition; too"),
  entry(84, "new", "新的", "recently made or not previously known"),
  entry(85, "because", "因为", "for the reason that"),
  entry(86, "day", "天；日", "a 24-hour period; daytime"),
  entry(87, "use", "使用；利用", "to do something with a tool or thing"),
  entry(88, "no", "不；没有；否", "not any; used to refuse or deny"),
  entry(89, "man", "男人；人", "an adult male; a human"),
  entry(90, "find", "找到；发现", "to discover or locate"),
  entry(91, "here", "这里", "in this place"),
  entry(92, "thing", "东西；事情", "an object or matter"),
  entry(93, "give", "给；给予", "to hand over or provide"),
  entry(94, "many", "许多", "a large number of"),
  entry(95, "well", "好地；嗯；健康的", "in a good way; used to pause; healthy"),
  entry(96, "only", "只；仅仅", "and no one or nothing more"),
  entry(97, "those", "那些", "the ones farther away or already mentioned"),
  entry(98, "tell", "告诉；讲述", "to say information to someone"),
  entry(99, "very", "非常；很", "to a high degree"),
  entry(100, "even", "甚至；即使", "used to emphasize surprise or inclusion"),
];

/** MP3s exist under public/audio/mandarin-vocab for ranks 1–200. */
function hydrateAudioFiles(words: MandarinVocabWord[]): void {
  for (const w of words) {
    if (!w.audioFile) {
      const n = String(w.rank).padStart(4, "0");
      const slug = w.word
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      w.audioFile = `${n}-${slug}.mp3`;
    }
  }
}
hydrateAudioFiles(MANDARIN_VOCAB_WORDS);

/** Words with definitions + audio available for the live listening quiz. */
export const ACTIVE_VOCAB_WORDS = MANDARIN_VOCAB_WORDS.filter(
  (w) => w.zh.length > 0 && w.en.length > 0 && w.audioFile.length > 0,
);

/** Words with English + Mandarin glosses for mahjong matching. */
export const MAHJONG_VOCAB_WORDS = MANDARIN_VOCAB_WORDS.filter(
  (w) => w.zh.length > 0 && w.word.length > 0,
);

export function mahjongBatchForRank(rank: number): number {
  return Math.ceil(rank / MAHJONG_BATCH_SIZE);
}

export function wordsInMahjongBatch(batch: number): MandarinVocabWord[] {
  const start = (batch - 1) * MAHJONG_BATCH_SIZE + 1;
  const end = batch * MAHJONG_BATCH_SIZE;
  return MAHJONG_VOCAB_WORDS.filter((w) => w.rank >= start && w.rank <= end);
}

/** Batch words that have both a Mandarin gloss and an audio clip filename. */
export function wordsWithAudioInMahjongBatch(
  batch: number,
): MandarinVocabWord[] {
  return wordsInMahjongBatch(batch).filter(
    (w) => w.zh.length > 0 && w.audioFile.length > 0,
  );
}

export function audioUrl(audioFile: string): string {
  return `${AUDIO_BASE}/${audioFile}`;
}

export function groupForRank(rank: number): number {
  return Math.ceil(rank / GROUP_SIZE);
}

export function ranksInGroup(group: number): { start: number; end: number } {
  const start = (group - 1) * GROUP_SIZE + 1;
  const end = group * GROUP_SIZE;
  return { start, end };
}

export function slugifyWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function expectedAudioFile(rank: number, word: string): string {
  const n = String(rank).padStart(4, "0");
  return `${n}-${slugifyWord(word)}.mp3`;
}

export const MODE_LABELS: Record<DifficultyMode, string> = {
  mandarin: "听音选中文 · 7 pts",
  english: "English definition · 10 pts",
  easy: "看单词选中文 · 3 pts",
};

export const MODE_BASE_POINTS: Record<DifficultyMode, number> = {
  mandarin: 7,
  english: 10,
  easy: 3,
};
