/** Flat top-down desk themes (adult learners). */

export const DESK_THEMES = [
  {
    id: "slate",
    label: "Slate desk",
    blurb: "Neutral wood grain - calm and professional.",
    locked: false,
  },
  {
    id: "warm",
    label: "Warm notebook",
    blurb: "Soft paper warmth without pink-pastel overload.",
    locked: false,
  },
  {
    id: "classic",
    label: "Classic binder",
    blurb: "Flat trapper-style rings and pocket edges.",
    locked: false,
  },
  {
    id: "studio",
    label: "Studio night",
    blurb: "Coming later - keep an eye on class rewards.",
    locked: true,
  },
] as const;

export type DeskThemeId = (typeof DESK_THEMES)[number]["id"];
export type UnlockedDeskThemeId = Exclude<DeskThemeId, "studio">;

const UNLOCKED = new Set(["slate", "warm", "classic"]);

export function isUnlockedDeskTheme(id: string): id is UnlockedDeskThemeId {
  return UNLOCKED.has(id);
}

export function normalizeDeskTheme(id: string | null | undefined): UnlockedDeskThemeId {
  if (id && isUnlockedDeskTheme(id)) return id;
  return "slate";
}