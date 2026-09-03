import type { JapaneseCatalogEntry } from "./blocks/catalog";
import { getJapaneseCatalog } from "./blocks/catalog";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export type WordFamilyKind = "stem" | "contrast" | "ending";

export type WordFamilyNode = {
  romaji: string;
  english: string;
  jp: string;
  blockNumber: number;
  wordIndex: number;
  /** 0 = root / peer; deeper = indented child under the stem. */
  depth: number;
};

export type WordFamily = {
  id: string;
  /** Plain-English section title for learners. */
  label: string;
  kind: WordFamilyKind;
  /** Short hint under the title. */
  blurb: string;
  nodes: WordFamilyNode[];
};

type FamilySeed = {
  id: string;
  label: string;
  kind: WordFamilyKind;
  blurb: string;
  /** Prefer these romaji in display order when present. */
  preferredOrder?: readonly string[];
  /** Exact romaji keys to include. */
  members?: readonly string[];
  /** Match key === stem or key.startsWith(stem). Longer stems win. */
  stems?: readonly string[];
  /** Drop false friends (e.g. douzo under dou). */
  exclude?: readonly string[];
  /** Custom matcher when stem rules are too blunt. */
  match?: (romajiKey: string) => boolean;
};

/** Curated families first — clear WH / contrast patterns, no fuzzy merges. */
const CURATED_SEEDS: readonly FamilySeed[] = [
  {
    id: "dare",
    label: "Who words (dare…)",
    kind: "stem",
    blurb: "Same dare stem: who → someone → nobody → anyone.",
    preferredOrder: ["dare", "dareka", "daremo", "daredemo"],
    stems: ["dare"],
  },
  {
    id: "nani",
    label: "What words (nani… / nan…)",
    kind: "stem",
    blurb: "nani plus -ka / -mo / -demo endings that keep the same sound family.",
    preferredOrder: ["nani", "nanika", "nanimo", "nandemo"],
    match: (key) => /^(nani|nanika|nanimo|nandemo|nanni)/.test(key),
  },
  {
    id: "doko",
    label: "Where words (doko…)",
    kind: "stem",
    blurb: "doko and compounds that keep the where-sound.",
    preferredOrder: ["doko", "dokoka", "dokodemo", "dokomo"],
    stems: ["doko"],
  },
  {
    id: "itsu",
    label: "When words (itsu…)",
    kind: "stem",
    blurb: "itsu and time compounds that share the stem.",
    preferredOrder: ["itsu", "itsuka", "itsumo", "itsudemo"],
    stems: ["itsu"],
  },
  {
    id: "dore",
    label: "Which words (dore…)",
    kind: "stem",
    blurb: "dore and any-which compounds.",
    preferredOrder: ["dore", "doredemo"],
    stems: ["dore"],
  },
  {
    id: "ikura",
    label: "How much (ikura…)",
    kind: "stem",
    blurb: "ikura and related how-much forms.",
    preferredOrder: ["ikura"],
    stems: ["ikura"],
  },
  {
    id: "dochira",
    label: "Which way (dochira…)",
    kind: "stem",
    blurb: "dochira and either/any-side compounds.",
    preferredOrder: ["dochira", "dochiraka", "dochirademo"],
    stems: ["dochira"],
  },
  {
    id: "dou",
    label: "How / why (dou…)",
    kind: "stem",
    blurb: "dou and doushite — not douzo (please), which is a different word.",
    preferredOrder: ["dou", "doushite"],
    members: ["dou", "doushite"],
  },
  {
    id: "mou-mada",
    label: "Already vs still (mou / mada)",
    kind: "contrast",
    blurb: "Common contrast pair: mou (already / not anymore) vs mada (still / not yet).",
    preferredOrder: ["mou", "mada"],
    members: ["mou", "mada"],
  },
  {
    id: "mou-compounds",
    label: "Mou compounds",
    kind: "stem",
    blurb: "mou plus everyday compounds that keep the same sound.",
    preferredOrder: ["mou", "mouhitotsu"],
    stems: ["mou"],
    exclude: ["mada"],
  },
  {
    id: "tai-want",
    label: "Want-to forms (-tai)",
    kind: "ending",
    blurb: "Verb desire endings: -tai / -takunai / -takatta when they appear as vocab.",
    preferredOrder: [],
    match: (key) =>
      /(tai|takunai|takatta|takuatta)$/.test(key) && !key.startsWith("taku"),
  },
];

/** Extra clear prefixes scanned automatically if not already claimed. */
const AUTO_STEMS: readonly { stem: string; label: string; blurb: string }[] = [
  { stem: "donna", label: "What kind (donna…)", blurb: "donna and related what-kind forms." },
  { stem: "naze", label: "Why (naze…)", blurb: "naze and related why forms." },
];

function matchesStem(key: string, stem: string): boolean {
  return key === stem || key.startsWith(stem);
}

function seedMatches(seed: FamilySeed, key: string): boolean {
  if (seed.exclude?.includes(key)) return false;
  if (seed.match) return seed.match(key);
  if (seed.members?.includes(key)) return true;
  if (seed.stems?.some((stem) => matchesStem(key, stem))) return true;
  return false;
}

function preferredIndex(order: readonly string[] | undefined, key: string): number {
  if (!order?.length) return Number.POSITIVE_INFINITY;
  const idx = order.indexOf(key);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

function pickCanonicalEntry(entries: JapaneseCatalogEntry[]): JapaneseCatalogEntry {
  return [...entries].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.wordIndex - b.wordIndex,
  )[0]!;
}

function groupByRomaji(entries: JapaneseCatalogEntry[]): Map<string, JapaneseCatalogEntry[]> {
  const map = new Map<string, JapaneseCatalogEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.romajiKey) ?? [];
    list.push(entry);
    map.set(entry.romajiKey, list);
  }
  return map;
}

function buildNodesForKeys(
  keys: string[],
  byRomaji: Map<string, JapaneseCatalogEntry[]>,
  kind: WordFamilyKind,
  preferredOrder?: readonly string[],
): WordFamilyNode[] {
  const uniqueKeys = [...new Set(keys)].filter((key) => byRomaji.has(key));
  if (uniqueKeys.length === 0) return [];

  const sortedKeys = [...uniqueKeys].sort((a, b) => {
    const pa = preferredIndex(preferredOrder, a);
    const pb = preferredIndex(preferredOrder, b);
    if (pa !== pb) return pa - pb;
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  const rootKey =
    kind === "contrast"
      ? null
      : sortedKeys.find((key) => preferredOrder?.[0] === key) ??
        sortedKeys.reduce((best, key) => (key.length < best.length ? key : best), sortedKeys[0]!);

  const nodes: WordFamilyNode[] = [];
  for (const key of sortedKeys) {
    const group = byRomaji.get(key);
    if (!group?.length) continue;
    // One node per romaji (earliest block); list other blocks in UI via catalog if needed.
    const entry = pickCanonicalEntry(group);
    const depth =
      kind === "contrast" || !rootKey || key === rootKey
        ? 0
        : matchesStem(key, rootKey)
          ? 1
          : 1;
    nodes.push({
      romaji: entry.word.r,
      english: entry.word.en,
      jp: entry.word.jp,
      blockNumber: entry.blockNumber,
      wordIndex: entry.wordIndex,
      depth,
    });

    // Extra slots for the same romaji in later blocks (indented peers).
    const extras = [...group]
      .sort((a, b) => a.blockNumber - b.blockNumber || a.wordIndex - b.wordIndex)
      .slice(1);
    for (const extra of extras) {
      nodes.push({
        romaji: extra.word.r,
        english: extra.word.en,
        jp: extra.word.jp,
        blockNumber: extra.blockNumber,
        wordIndex: extra.wordIndex,
        depth: Math.max(depth, 1),
      });
    }
  }
  return nodes;
}

function uniqueRomajiCount(nodes: WordFamilyNode[]): number {
  return new Set(nodes.map((n) => normalizeKey(n.romaji))).size;
}

function buildFamilyFromSeed(
  seed: FamilySeed,
  byRomaji: Map<string, JapaneseCatalogEntry[]>,
  claimed: Set<string>,
): WordFamily | null {
  const keys: string[] = [];
  for (const key of byRomaji.keys()) {
    if (claimed.has(key)) continue;
    if (!seedMatches(seed, key)) continue;
    keys.push(key);
  }
  const nodes = buildNodesForKeys(keys, byRomaji, seed.kind, seed.preferredOrder);
  if (uniqueRomajiCount(nodes) < 2) return null;

  for (const key of keys) claimed.add(key);

  return {
    id: seed.id,
    label: seed.label,
    kind: seed.kind,
    blurb: seed.blurb,
    nodes,
  };
}

function buildAutoStemFamily(
  stem: string,
  label: string,
  blurb: string,
  byRomaji: Map<string, JapaneseCatalogEntry[]>,
  claimed: Set<string>,
): WordFamily | null {
  const keys = [...byRomaji.keys()].filter(
    (key) => !claimed.has(key) && matchesStem(key, stem),
  );
  // Avoid swallowing short false friends: require stem length >= 3 and 2+ hits.
  if (stem.length < 3 || keys.length < 2) return null;
  // Skip if every hit was already claimed.
  const nodes = buildNodesForKeys(keys, byRomaji, "stem", [stem]);
  if (uniqueRomajiCount(nodes) < 2) return null;
  for (const key of keys) claimed.add(key);
  return {
    id: `auto-${stem}`,
    label,
    kind: "stem",
    blurb,
    nodes,
  };
}

/**
 * Build related-sound / word-family maps from the Japanese catalog.
 * Curated seeds run first; clear unused prefixes fill gaps. Singletons are dropped.
 */
export function buildWordFamilies(
  entries: JapaneseCatalogEntry[] = getJapaneseCatalog(),
): WordFamily[] {
  const byRomaji = groupByRomaji(entries);
  const claimed = new Set<string>();
  const families: WordFamily[] = [];

  for (const seed of CURATED_SEEDS) {
    const family = buildFamilyFromSeed(seed, byRomaji, claimed);
    if (family) families.push(family);
  }

  for (const auto of AUTO_STEMS) {
    const family = buildAutoStemFamily(auto.stem, auto.label, auto.blurb, byRomaji, claimed);
    if (family) families.push(family);
  }

  return families;
}

export function findFamiliesForRomaji(
  romaji: string,
  families: WordFamily[] = buildWordFamilies(),
): WordFamily[] {
  const key = normalizeKey(romaji);
  return families.filter((family) =>
    family.nodes.some((node) => normalizeKey(node.romaji) === key),
  );
}
