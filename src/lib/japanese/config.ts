/** Words introduced before each mini-review in Round 1. */
export const JAPANESE_BATCH_SIZE = 5;

/** Number of words in each mini-review during Round 1. */
export const JAPANESE_MINI_REVIEW_SIZE = 5;

/** Round score (%) required to count as block mastery. */
export const JAPANESE_MASTERY_THRESHOLD = 90;

/** Multiple-choice options shown per question. */
export const JAPANESE_CHOICE_COUNT = 6;

/** Set to a number to limit block words for QA; null = full block. */
export const JAPANESE_TEST_WORD_LIMIT: number | null = null;

/** QA subset indices when testing audio (includes shiru=19 + suki=34). */
export const JAPANESE_TEST_WORD_INDICES: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 19, 34];