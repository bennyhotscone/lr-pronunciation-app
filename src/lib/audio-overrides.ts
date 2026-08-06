import { audioUrl } from "@/data/mandarin-vocab";

export type AudioOverrideEntry = {
  url: string;
  filename: string;
  updatedAt: string;
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

/** Prefer the newest `updatedAt` per rank when combining maps. */
export function mergeAudioOverrideMaps(
  ...maps: Array<AudioOverrideMap | null | undefined>
): AudioOverrideMap {
  const out: AudioOverrideMap = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [key, entry] of Object.entries(map)) {
      if (!entry?.url) continue;
      const prev = out[key];
      if (!prev) {
        out[key] = entry;
        continue;
      }
      const prevTs = Date.parse(prev.updatedAt);
      const nextTs = Date.parse(entry.updatedAt);
      if (
        !Number.isFinite(prevTs) ||
        (Number.isFinite(nextTs) && nextTs >= prevTs)
      ) {
        out[key] = entry;
      }
    }
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
  if (entry?.url) {
    const ts = Date.parse(entry.updatedAt);
    const v = Number.isFinite(ts) ? ts : Date.now();
    const sep = entry.url.includes("?") ? "&" : "?";
    return `${entry.url}${sep}v=${v}`;
  }
  if (!audioFile) return "";
  return audioUrl(audioFile);
}
