"use client";

import { useCallback, useEffect, useState } from "react";
import {
  resolveAudioPlaybackUrl,
  type AudioOverrideMap,
} from "@/lib/audio-overrides";

let cache: AudioOverrideMap | null = null;
let inflight: Promise<AudioOverrideMap> | null = null;

export function invalidateAudioOverridesCache(): void {
  cache = null;
  inflight = null;
}

export async function fetchAudioOverrides(
  force = false,
): Promise<AudioOverrideMap> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/studio/overrides", { cache: "no-store" });
      if (!res.ok) return cache ?? {};
      const data = (await res.json()) as { overrides?: AudioOverrideMap };
      cache = data.overrides && typeof data.overrides === "object" ? data.overrides : {};
      return cache;
    } catch {
      return cache ?? {};
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useAudioOverrides() {
  const [overrides, setOverrides] = useState<AudioOverrideMap>(cache ?? {});
  const [loaded, setLoaded] = useState(Boolean(cache));

  const refresh = useCallback(async () => {
    const next = await fetchAudioOverrides(true);
    setOverrides(next);
    setLoaded(true);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAudioOverrides().then((next) => {
      if (!cancelled) {
        setOverrides(next);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveUrl = useCallback(
    (rank: number, audioFile: string) =>
      resolveAudioPlaybackUrl(rank, audioFile, overrides),
    [overrides],
  );

  return { overrides, loaded, refresh, resolveUrl };
}
