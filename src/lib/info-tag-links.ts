/** Free study links from a tag — static URL patterns only (no API cost). */

export type InfoTagLink = {
  label: string;
  href: string;
  blurb: string;
  kind: "video" | "explain" | "exercise" | "listen";
};

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Build always-free explanation / practice destinations for a topic tag. */
export function freeInfoTagLinks(tag: string): InfoTagLink[] {
  const t = normalizeTag(tag);
  if (!t) return [];
  const q = encodeURIComponent(t);
  const qPlus = encodeURIComponent(`${t} English grammar`);

  return [
    {
      label: "YouTube search",
      href: `https://www.youtube.com/results?search_query=${qPlus}`,
      blurb: "Free explanation videos (search results — pick a clear teacher video)",
      kind: "video",
    },
    {
      label: "BBC Learning English",
      href: `https://www.bbc.co.uk/learningenglish/search?q=${q}`,
      blurb: "Free explanations and practice from the BBC",
      kind: "explain",
    },
    {
      label: "British Council LearnEnglish",
      href: `https://learnenglish.britishcouncil.org/search/site?query=${q}`,
      blurb: "Free lessons and practice",
      kind: "exercise",
    },
    {
      label: "Perfect English Grammar",
      href: `https://www.perfect-english-grammar.com/?s=${q}`,
      blurb: "Clear grammar notes and exercises (free pages)",
      kind: "exercise",
    },
    {
      label: "Simple Wikipedia",
      href: `https://simple.wikipedia.org/w/index.php?search=${q}`,
      blurb: "Easier English background reading",
      kind: "explain",
    },
    {
      label: "Wikipedia",
      href: `https://en.wikipedia.org/wiki/Special:Search?search=${q}`,
      blurb: "Background reading and definitions",
      kind: "explain",
    },
    {
      label: "Wiktionary",
      href: `https://en.wiktionary.org/wiki/Special:Search?search=${q}`,
      blurb: "Word meanings and examples",
      kind: "explain",
    },
    {
      label: "YouGlish",
      href: `https://youglish.com/pronounce/${encodeURIComponent(t)}/english`,
      blurb: "Hear the words in real videos",
      kind: "listen",
    },
  ];
}

/** Home skill-building steps — a few study actions + understanding checks (no LLM). */
export function freeHelpPracticeSteps(tag: string): string[] {
  const t = normalizeTag(tag);
  if (!t) return [];

  return [
    `I understand what “${t}” is used for in English`,
    `I have checked a clear explanation of “${t}” (video or reading)`,
    `I can write my own examples using “${t}”`,
  ];
}

export function tagClassroomHref(_classId: string, tag: string): string {
  /** Student desk is the single class surface — tag filters live on /portal. */
  return `/portal?tag=${encodeURIComponent(normalizeTag(tag))}`;
}
