"use client";

import { useCallback, useEffect, useState } from "react";
import {
  resolveAudioPlaybackUrl,
  type AudioOverrideMap,
} from "@/lib/audio-overrides";

let cache: AudioOverrideMap | null = null;
let inflight: Promise<AudioOverrideMap> | null = null;

type Listener = (map: AudioOverrideMap) => void;
const listeners = new Set<Listener>();

function notify(map: AudioOverrideMap): void {
  for (const listener of listeners) listener(map);
}

export function invalidateAudioOverridesCache(): void {
  cache = null;
  inflight = null;
}

/** Immediately seed the module cache + notify all mounted hooks (e.g. POST body). */
export function applyAudioOverrides(map: AudioOverrideMap): void {
  cache = map && typeof map === "object" ? map : {};
  inflight = null;
  notify(cache);
}

export async function fetchAudioOverrides(
  force = false,
): Promise<AudioOverrideMap> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  const previous = cache;
  const request = fetch("/api/studio/overrides", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) {
        // Never clobber a known map with {} after a failed refetch
        return previous ?? cache ?? {};
      }
      const data = (await res.json()) as { overrides?: AudioOverrideMap };
      const next =
        data.overrides && typeof data.overrides === "object"
          ? data.overrides
          : {};
      cache = next;
      notify(next);
      return next;
    })
    .catch(() => previous ?? cache ?? {})
    .finally(() => {
      if (inflight === request) inflight = null;
    });

  inflight = request;
  return request;
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

  const apply = useCallback((map: AudioOverrideMap) => {
    applyAudioOverrides(map);
    setOverrides(map && typeof map === "object" ? map : {});
    setLoaded(true);
  }, []);

  useEffect(() => {
    const onChange = (map: AudioOverrideMap) => {
      setOverrides(map);
      setLoaded(true);
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Force on mount so list/quiz/mahjong/review never keep a stale module cache
    // from an earlier page in the same SPA session after another tab saved.
    void fetchAudioOverrides(true).then((next) => {
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

  return { overrides, loaded, refresh, apply, resolveUrl };
}
