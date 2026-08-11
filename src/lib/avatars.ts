export type AvatarDef = {
  id: string;
  label: string;
  emoji: string;
  bg: string;
};

/** Curated avatar set — no uploads in v1. */
export const AVATARS: AvatarDef[] = [
  { id: "fox", label: "Fox", emoji: "🦊", bg: "#ffecd2" },
  { id: "owl", label: "Owl", emoji: "🦉", bg: "#e8e1ff" },
  { id: "panda", label: "Panda", emoji: "🐼", bg: "#e8f8f5" },
  { id: "tiger", label: "Tiger", emoji: "🐯", bg: "#ffe8d6" },
  { id: "whale", label: "Whale", emoji: "🐋", bg: "#d9f0ff" },
  { id: "rocket", label: "Rocket", emoji: "🚀", bg: "#ffe3ec" },
  { id: "star", label: "Star", emoji: "⭐", bg: "#fff3cd" },
  { id: "leaf", label: "Leaf", emoji: "🍃", bg: "#e2f7e8" },
  { id: "book", label: "Book", emoji: "📖", bg: "#efe8ff" },
  { id: "guitar", label: "Guitar", emoji: "🎸", bg: "#ffe8f0" },
  { id: "dragon", label: "Dragon", emoji: "🐲", bg: "#e0fff4" },
  { id: "cat", label: "Cat", emoji: "🐱", bg: "#fff0e0" },
];

export const DEFAULT_AVATAR_ID = "fox";

export function getAvatar(id: string | null | undefined): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export function isValidAvatarId(id: string): boolean {
  return AVATARS.some((a) => a.id === id);
}
