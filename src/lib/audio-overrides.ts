import { audioUrl } from "@/data/mandarin-vocab";

export type AudioOverrideEntry = {
  url: string;
  filename: string;
  updatedAt: string;
  /** When true (or url empty), rank has no live override — used as a tombstone vs stale CDN maps. */
  deleted?: boolean;
};

/** Keys are zero-padded ranks, e.g. "0012". */
export type AudioOverrideMap = Record<string, AudioOverrideEntry>;

export const OVERRIDES_BLOB_PATH = "studio-audio-overrides.json";
/** Append-only snapshots — avoids CDN serving a stale overwrite of the fixed path. */
export const OVERRIDES_VERSION_PREFIX = "studio-audio-overrides/v-";
export const OVERRIDES_PUBLIC_REL =
  "audio/mandarin-vocab/studio-audio-overrides.json";

export function rankKey(rank: number): string {
  return String(rank).padStart(4, "0");
}

export function isActiveAudioOverride(
  entry: AudioOverrideEntry | null | undefined,
): entry is AudioOverrideEntry {
  return Boolean(entry?.url) && entry?.deleted !== true;
}

export function audioOverrideTombstone(
  updatedAt = new Date().toISOString(),
): AudioOverrideEntry {
  return { url: "", filename: "", updatedAt, deleted: true };
}

/** Prefer the newest `updatedAt` per rank when combining maps (includes clear tombstones). */
export function mergeAudioOverrideMaps(
  ...maps: Array<AudioOverrideMap | null | undefined>
): AudioOverrideMap {
  const out: AudioOverrideMap = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [key, entry] of Object.entries(map)) {
      if (!entry || typeof entry !== "object") continue;
      const isTombstone = entry.deleted === true || !entry.url;
      if (!isTombstone && !entry.url) continue;
      const prev = out[key];
      if (!prev) {
        out[key] = isTombstone
          ? audioOverrideTombstone(entry.updatedAt || new Date().toISOString())
          : entry;
        continue;
      }
      const prevTs = Date.parse(prev.updatedAt);
      const nextTs = Date.parse(entry.updatedAt);
      if (
        !Number.isFinite(prevTs) ||
        (Number.isFinite(nextTs) && nextTs >= prevTs)
      ) {
        out[key] = isTombstone
          ? audioOverrideTombstone(entry.updatedAt || new Date().toISOString())
          : entry;
      }
    }
  }
  return out;
}

/** Drop tombstones for APIs / UI that only care about live overrides. */
export function activeAudioOverrideMap(map: AudioOverrideMap): AudioOverrideMap {
  const out: AudioOverrideMap = {};
  for (const [key, entry] of Object.entries(map)) {
    if (isActiveAudioOverride(entry)) out[key] = entry;
  }
  return out;
}

export function resolveAudioPlaybackUrl(
  rank: number,
  audioFile: string,
  overrides: AudioOverrideMap | null | undefined,
): string {
  if (!audioFile && !overrides) return "";
  const entry = overrides?.[rankKey(rank)];
  if (isActiveAudioOverride(entry)) {
    const ts = Date.parse(entry.updatedAt);
    const v = Number.isFinite(ts) ? ts : Date.now();
    const sep = entry.url.includes("?") ? "&" : "?";
    return `${entry.url}${sep}v=${v}`;
  }
  if (!audioFile) return "";
  return audioUrl(audioFile);
}
