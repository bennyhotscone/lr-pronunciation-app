import { audioUrl } from "@/data/mandarin-vocab";

export type AudioOverrideEntry = {
  url: string;
  filename: string;
  updatedAt: string;
};

/** Keys are zero-padded ranks, e.g. "0012". */
export type AudioOverrideMap = Record<string, AudioOverrideEntry>;

export const OVERRIDES_BLOB_PATH = "studio-audio-overrides.json";
export const OVERRIDES_PUBLIC_REL =
  "audio/mandarin-vocab/studio-audio-overrides.json";

export function rankKey(rank: number): string {
  return String(rank).padStart(4, "0");
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
