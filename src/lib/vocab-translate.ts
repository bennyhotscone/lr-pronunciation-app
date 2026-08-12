/**
 * Free translation for PDF read-mode.
 * Primary: MyMemory Translation API (no API key for modest use).
 * Enrichment: Free Dictionary API for English sense gloss when useful.
 */

export type TranslateResult = {
  translation: string;
  provider: "mymemory" | "freedictionary";
  definition?: string | null;
};

const MYMEMORY = "https://api.mymemory.translated.net/get";
const FREE_DICT = "https://api.dictionaryapi.dev/api/v2/entries/en";

/** Map profile/UI codes to MyMemory langpair targets. */
export function toMyMemoryLang(code: string): string {
  const c = (code || "zh-CN").trim();
  const map: Record<string, string> = {
    zh: "zh-CN",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
    cn: "zh-CN",
    chinese: "zh-CN",
    ja: "ja",
    jp: "ja",
    japanese: "ja",
    th: "th",
    thai: "th",
    ko: "ko",
    korean: "ko",
    vi: "vi",
    vietnamese: "vi",
    es: "es",
    spanish: "es",
    fr: "fr",
    french: "fr",
    de: "de",
    german: "de",
    pt: "pt-BR",
    "pt-br": "pt-BR",
    id: "id",
    indonesian: "id",
    en: "en",
    english: "en",
  };
  const lower = c.toLowerCase();
  return map[lower] || c;
}

export const TARGET_LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "ja", label: "Japanese" },
  { value: "th", label: "Thai" },
  { value: "ko", label: "Korean" },
  { value: "vi", label: "Vietnamese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "id", label: "Indonesian" },
];

async function freeDictionaryGloss(word: string): Promise<string | null> {
  try {
    const res = await fetch(`${FREE_DICT}/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      meanings?: Array<{ definitions?: Array<{ definition?: string }> }>;
    }>;
    const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    return def?.trim() || null;
  } catch {
    return null;
  }
}

export async function translateWord(
  word: string,
  targetLang: string,
): Promise<TranslateResult | { error: string }> {
  const cleaned = word.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > 80) {
    return { error: "Pick a single word or short phrase." };
  }

  const target = toMyMemoryLang(targetLang);
  const definitionPromise = freeDictionaryGloss(cleaned);

  // Same language: surface Free Dictionary definition as the "translation".
  if (target === "en" || target.toLowerCase().startsWith("en-")) {
    const definition = await definitionPromise;
    if (!definition) return { error: "No English definition found." };
    return {
      translation: definition,
      provider: "freedictionary",
      definition,
    };
  }

  try {
    const url = new URL(MYMEMORY);
    url.searchParams.set("q", cleaned);
    url.searchParams.set("langpair", `en|${target}`);
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { error: `Translation service returned ${res.status}.` };
    }
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
      quotaFinished?: boolean;
    };
    const text = data.responseData?.translatedText?.trim();
    if (!text || data.responseStatus === 403 || data.quotaFinished) {
      // Soft fallback: English definition so the student still gets something.
      const definition = await definitionPromise;
      if (definition) {
        return {
          translation: definition,
          provider: "freedictionary",
          definition,
        };
      }
      return { error: "Translation unavailable right now. Try again shortly." };
    }
    // MyMemory sometimes echoes the source when it can't translate.
    if (text.toLowerCase() === cleaned.toLowerCase()) {
      const definition = await definitionPromise;
      if (definition) {
        return {
          translation: definition,
          provider: "freedictionary",
          definition,
        };
      }
    }
    const definition = await definitionPromise;
    return {
      translation: text,
      provider: "mymemory",
      definition,
    };
  } catch {
    const definition = await definitionPromise;
    if (definition) {
      return {
        translation: definition,
        provider: "freedictionary",
        definition,
      };
    }
    return { error: "Could not reach the free translation service." };
  }
}
