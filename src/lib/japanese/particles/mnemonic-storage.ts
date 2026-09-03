/** Browser overrides for grammar ending sound hooks. */

import {
  formatEndingMnemonicLine,
  getVerbEndingMnemonic,
  resolveEndingKey,
} from "./mnemonics";

const STORAGE_KEY = "jp-grammar-ending-mnemonics-v1";

type OverrideMap = Record<string, string>;

function readMap(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverrideMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: OverrideMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function getEndingMnemonicOverride(ending?: string, romaji?: string): string | null {
  const key = resolveEndingKey(ending, romaji);
  if (!key) return null;
  const value = readMap()[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function setEndingMnemonicOverride(
  ending: string | undefined,
  value: string | null,
  romaji?: string,
): void {
  const key = resolveEndingKey(ending, romaji);
  if (!key) return;
  const map = readMap();
  const trimmed = value?.trim() ?? "";
  const def = getVerbEndingMnemonic(key)?.sound?.trim() ?? "";
  if (!trimmed || trimmed === def) {
    delete map[key];
  } else {
    map[key] = trimmed;
  }
  writeMap(map);
}

export function clearEndingMnemonicOverride(ending?: string, romaji?: string): void {
  setEndingMnemonicOverride(ending, null, romaji);
}

/** Active sound hook (override or default). */
export function resolveEndingSound(ending?: string, romaji?: string): string | null {
  const m = getVerbEndingMnemonic(ending, romaji);
  if (!m) return null;
  return getEndingMnemonicOverride(ending, romaji) ?? m.sound;
}

export function formatResolvedEndingMnemonicLine(
  ending?: string,
  romaji?: string,
): string | null {
  return formatEndingMnemonicLine(ending, romaji, getEndingMnemonicOverride(ending, romaji));
}