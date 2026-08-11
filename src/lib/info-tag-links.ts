/** Free study links from a tag — static URL patterns only (no API cost). */

export type InfoTagLink = {
  label: string;
  href: string;
  blurb: string;
};

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Build always-free explanation / practice destinations for a topic tag. */
export function freeInfoTagLinks(tag: string): InfoTagLink[] {
  const t = normalizeTag(tag);
  if (!t) return [];
  const q = encodeURIComponent(t);
  const wiki = encodeURIComponent(t.replace(/\s+/g, "_"));

  return [
    {
      label: "Wikipedia",
      href: `https://en.wikipedia.org/wiki/Special:Search?search=${q}`,
      blurb: "Background reading and definitions",
    },
    {
      label: "Wiktionary",
      href: `https://en.wiktionary.org/wiki/Special:Search?search=${q}`,
      blurb: "Word meanings and examples",
    },
    {
      label: "Simple Wikipedia",
      href: `https://simple.wikipedia.org/w/index.php?search=${q}`,
      blurb: "Easier English explanation",
    },
    {
      label: "British Council LearnEnglish",
      href: `https://learnenglish.britishcouncil.org/search/site?query=${q}`,
      blurb: "Free lessons and practice",
    },
    {
      label: "YouGlish",
      href: `https://youglish.com/pronounce/${encodeURIComponent(t)}/english`,
      blurb: "Hear the words in real videos",
    },
  ];
}

export function tagClassroomHref(classId: string, tag: string): string {
  return `/portal/classrooms/${classId}?tag=${encodeURIComponent(normalizeTag(tag))}`;
}
