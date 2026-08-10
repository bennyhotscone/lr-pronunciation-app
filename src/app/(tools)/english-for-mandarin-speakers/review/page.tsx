"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AUDIO_BASE } from "@/data/mandarin-vocab";
import { useAudioOverrides } from "@/lib/audio-overrides-client";

type ManifestClip = {
  rank: number;
  word: string;
  audio: string;
  duration?: number;
};

type ManifestPayload = {
  clips: ManifestClip[];
};

type DurationFlag = "ok" | "short" | "long" | "missing" | "unknown" | "pending";

type ClipRow = {
  rank: number;
  word: string;
  audioFile: string;
  duration: number | null;
  flag: DurationFlag;
};

const SHORT_SEC = 0.25;
const LONG_SEC = 1.8;

const RANGE_PRESETS = [
  { label: "1–20", start: 1, end: 20 },
  { label: "21–40", start: 21, end: 40 },
  { label: "41–60", start: 41, end: 60 },
  { label: "61–100", start: 61, end: 100 },
  { label: "101–200", start: 101, end: 200 },
  { label: "All", start: 1, end: 9999 },
] as const;

function refLabel(rank: number): string {
  return `#${String(rank).padStart(4, "0")}`;
}

/**
 * Lightweight duration probe — never called for every visible row at once
 * during first paint. Returns flag without throwing.
 */
function probeDuration(src: string): Promise<{ duration: number | null; flag: DurationFlag }> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    let settled = false;
    const finish = (duration: number | null, flag: DurationFlag) => {
      if (settled) return;
      settled = true;
      audio.removeAttribute("src");
      audio.load();
      resolve({ duration, flag });
    };
    const timer = window.setTimeout(() => finish(null, "unknown"), 4000);
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const d = audio.duration;
      if (!Number.isFinite(d)) {
        finish(null, "unknown");
        return;
      }
      if (d < SHORT_SEC) finish(d, "short");
      else if (d > LONG_SEC) finish(d, "long");
      else finish(d, "ok");
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(null, "missing");
    };
    audio.src = src;
  });
}

export default function MandarinAudioReviewPage() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<ClipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(20);
  const [playingRank, setPlayingRank] = useState<number | null>(null);
  const [probing, setProbing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { resolveUrl } = useAudioOverrides();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AUDIO_BASE}/manifest.json`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Could not load manifest (${res.status})`);
        const data = (await res.json()) as ManifestPayload;
        const clips = [...(data.clips ?? [])].sort((a, b) => a.rank - b.rank);
        if (cancelled) return;
        // Instant interactive list — duration flags fill in later / on demand
        setRows(
          clips.map((c) => ({
            rank: c.rank,
            word: c.word,
            audioFile: c.audio,
            duration: typeof c.duration === "number" ? c.duration : null,
            flag:
              typeof c.duration === "number"
                ? c.duration < SHORT_SEC
                  ? "short"
                  : c.duration > LONG_SEC
                    ? "long"
                    : "ok"
                : "pending",
          })),
        );
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load clips");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const visible = useMemo(
    () => rows.filter((r) => r.rank >= rangeStart && r.rank <= rangeEnd),
    [rows, rangeStart, rangeEnd],
  );

  const flagged = visible.filter(
    (r) => r.flag === "short" || r.flag === "long" || r.flag === "missing",
  );
  const maxRank = rows.length ? rows[rows.length - 1]!.rank : 0;

  const playClip = useCallback(
    (row: ClipRow) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      const a = new Audio(resolveUrl(row.rank, row.audioFile));
      audioRef.current = a;
      setPlayingRank(row.rank);
      void a.play().catch(() => setPlayingRank(null));
      a.onended = () => setPlayingRank(null);
      a.onerror = () => setPlayingRank(null);
    },
    [resolveUrl],
  );

  const probeVisible = useCallback(async () => {
    if (probing || visible.length === 0) return;
    setProbing(true);
    const updates = new Map<number, { duration: number | null; flag: DurationFlag }>();
    for (const row of visible) {
      // eslint-disable-next-line no-await-in-loop
      const result = await probeDuration(resolveUrl(row.rank, row.audioFile));
      updates.set(row.rank, result);
    }
    setRows((prev) =>
      prev.map((r) => {
        const u = updates.get(r.rank);
        return u ? { ...r, duration: u.duration, flag: u.flag } : r;
      }),
    );
    setProbing(false);
  }, [probing, visible, resolveUrl]);

  if (!mounted) {
    return (
      <div className="relative z-20 space-y-4">
        <p className="text-sm text-muted">Loading audio review…</p>
      </div>
    );
  }

  return (
    <div className="relative z-20 isolate space-y-4">
      <div>
        <p className="chip bg-amber/25 text-foreground">Draft audio QA</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Audio review
          {maxRank > 0 ? ` · files 1–${maxRank}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Bulk cuts are <strong>draft</strong> until a human marks them OK in{" "}
          <Link
            href="/english-for-mandarin-speakers/studio"
            className="font-bold underline underline-offset-2"
          >
            Audio Studio
          </Link>
          . Use <strong>Ref</strong> (e.g. <code>#0021</code>) when reporting
          issues. Do not assume all {maxRank || 200} clips are good.
        </p>
      </div>

      <div className="relative z-30 flex flex-wrap items-center gap-2">
        <Link
          href="/english-for-mandarin-speakers"
          className="btn-secondary relative z-30 inline-flex touch-target rounded-2xl px-4 py-2 text-sm font-bold"
        >
          ← Back to quiz
        </Link>
        <Link
          href="/english-for-mandarin-speakers/studio"
          className="btn-primary relative z-30 inline-flex min-h-[48px] touch-target rounded-2xl px-5 py-3 text-sm font-bold"
        >
          Open Audio Studio · 1–50 checklist
        </Link>
      </div>

      {/* Sticky filter bar — always above table rows */}
      <div className="sticky top-2 z-40 space-y-3 rounded-2xl border border-border bg-white p-3 shadow-md">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => {
            const active =
              rangeStart === preset.start && rangeEnd === preset.end;
            return (
              <button
                key={preset.label}
                type="button"
                className={`touch-target relative z-40 rounded-xl px-3 py-2 text-sm font-bold ${
                  active
                    ? "bg-accent text-white"
                    : "bg-accent-soft/60 text-foreground hover:bg-accent-soft"
                }`}
                onClick={() => {
                  setRangeStart(preset.start);
                  setRangeEnd(preset.end);
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            From
            <input
              type="number"
              min={1}
              value={rangeStart}
              onChange={(e) => setRangeStart(Number(e.target.value) || 1)}
              className="w-20 rounded-lg border border-border px-2 py-2 font-mono"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            To
            <input
              type="number"
              min={1}
              value={rangeEnd === 9999 ? maxRank || 200 : rangeEnd}
              onChange={(e) => setRangeEnd(Number(e.target.value) || 1)}
              className="w-20 rounded-lg border border-border px-2 py-2 font-mono"
            />
          </label>
          <button
            type="button"
            className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
            onClick={() => void probeVisible()}
            disabled={probing || loading}
          >
            {probing ? "Checking…" : "Check durations in range"}
          </button>
        </div>
        <p className="text-sm text-muted">
          {loadError
            ? loadError
            : loading
              ? "Loading manifest…"
              : `Showing ${visible.length} of ${rows.length} · ${flagged.length} short/long/missing in this range`}
        </p>
      </div>

      <ul className="relative z-20 space-y-2">
        {visible.map((row) => (
          <li
            key={row.rank}
            id={`ref-${String(row.rank).padStart(4, "0")}`}
            className={`relative z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white px-3 py-3 ${
              row.flag === "short" || row.flag === "long" || row.flag === "missing"
                ? "border-danger/40 bg-danger/5"
                : ""
            }`}
          >
            <div className="min-w-[4.5rem] font-mono text-sm font-bold">
              {refLabel(row.rank)}
            </div>
            <div className="min-w-[5rem] flex-1 font-bold">{row.word}</div>
            <button
              type="button"
              className="btn-primary touch-target relative z-30 rounded-xl px-4 py-2 text-sm font-bold"
              onClick={() => playClip(row)}
            >
              {playingRank === row.rank ? "Playing…" : "Play"}
            </button>
            <div className="w-16 font-mono text-xs text-muted">
              {row.duration != null
                ? `${row.duration.toFixed(2)}s`
                : row.flag === "pending"
                  ? "—"
                  : "—"}
            </div>
            <div className="w-20 text-xs font-bold uppercase">
              {row.flag === "ok" ? (
                <span className="text-success">length ok</span>
              ) : row.flag === "pending" ? (
                <span className="text-muted">unchecked</span>
              ) : (
                <span className="text-danger">{row.flag}</span>
              )}
            </div>
            <div className="w-full font-mono text-[11px] text-muted sm:w-auto">
              {row.audioFile}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
