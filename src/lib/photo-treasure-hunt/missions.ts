export type Mission = {
  title: string;
  prompt: string;
  where: string;
  symbol: string;
};

/** The 15 Melbourne photo missions from Rita's supplied hunt, in order. */
export const MISSIONS: readonly Mission[] = [
  {
    title: "Something iridescent",
    prompt: "Find an object whose colours change when light hits it.",
    where: "Opal shop",
    symbol: "💎",
  },
  {
    title: "Something translucent",
    prompt: "Photograph something that lets some light through.",
    where: "Opal shop / anywhere",
    symbol: "🫧",
  },
  {
    title: "A naturally occurring pattern",
    prompt: "Find stripes, spots, veins, crystals or another pattern from nature.",
    where: "Opal shop",
    symbol: "🌿",
  },
  {
    title: "An object older than 100 years",
    prompt: "Photograph or find evidence of something historical.",
    where: "Royal Arcade / city",
    symbol: "🕰️",
  },
  {
    title: "An ornate architectural detail",
    prompt: "Look for decorative ceilings, arches, tiles or columns.",
    where: "Royal Arcade",
    symbol: "🏛️",
  },
  {
    title: "An unusual item in a shop window",
    prompt: "Find something you have never seen before.",
    where: "Arcades / shops",
    symbol: "🎁",
  },
  {
    title: "Something beautifully handcrafted",
    prompt: "Find an item that looks carefully made by hand.",
    where: "Arcades / shops",
    symbol: "🧵",
  },
  {
    title: "A colourful mural",
    prompt: "Find a large piece of street art and describe its colours.",
    where: "Hosier Lane",
    symbol: "🎨",
  },
  {
    title: "Art that expresses an emotion",
    prompt: "Choose something that looks joyful, angry, sad or mysterious.",
    where: "Hosier Lane",
    symbol: "💗",
  },
  {
    title: "An interesting contrast",
    prompt:
      "Find two things that look very different together: old/new, bright/dark or rough/smooth.",
    where: "Anywhere",
    symbol: "🌓",
  },
  {
    title: "A word you have never seen before",
    prompt: "Photograph a sign or display with an unfamiliar English word.",
    where: "Anywhere",
    symbol: "🔤",
  },
  {
    title: "An example of persuasive advertising",
    prompt: "Find a poster, price sign or slogan designed to make you buy something.",
    where: "Shops / streets",
    symbol: "🛍️",
  },
  {
    title: "An object with an interesting history",
    prompt: "Find an object and discover what it was used for.",
    where: "ACMI / city",
    symbol: "📜",
  },
  {
    title: "Technology that has changed over time",
    prompt: "Find an old or new device and explain how it is different today.",
    where: "ACMI",
    symbol: "📷",
  },
  {
    title: "Something that represents Melbourne",
    prompt: "Find an image, object, building or scene that symbolises the city.",
    where: "Anywhere",
    symbol: "🌸",
  },
];

export type MissionDraft = {
  word: string;
  sentence: string;
  hasPhoto: boolean;
};

export function emptyDrafts(count = MISSIONS.length): MissionDraft[] {
  return Array.from({ length: count }, () => ({
    word: "",
    sentence: "",
    hasPhoto: false,
  }));
}

/** A mission is complete only when it has a photo, a word, and a sentence. */
export function missionComplete(draft: MissionDraft): boolean {
  return Boolean(draft.hasPhoto && draft.word.trim() && draft.sentence.trim());
}

export function countCompleted(drafts: readonly MissionDraft[]): number {
  return drafts.filter(missionComplete).length;
}

export function buildShareText(
  studentName: string,
  drafts: readonly MissionDraft[],
  missions: readonly Mission[] = MISSIONS,
): string {
  const name = studentName.trim() || "Rita";
  const body = missions
    .map((mission, index) => {
      const draft = drafts[index];
      if (!draft || (!draft.word && !draft.sentence)) return "";
      return `${index + 1}. ${mission.title}\nWords: ${draft.word}\nSentence: ${draft.sentence}`;
    })
    .filter(Boolean)
    .join("\n\n");
  return `${name}'s Melbourne Photo Hunt\n\n${body}`;
}
