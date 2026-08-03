"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AUDIO_BASE, audioUrl } from "@/data/mandarin-vocab";

type ManifestClip = {
  rank: number;
  word: string;
  audio: string;
};

type ManifestPayload = {
  clips: ManifestClip[];
};

type ClipStatus = {
  rank: number;
  word: string;
  audioFile: string;
  duration: number | null;
  exists: boolean | null;
  flag: "ok" | "short" | "long" | "missing" | "unknown";
};

const SHORT_SEC = 0.25;
const LONG_SEC = 1.8;

const RANGE_PRESETS = [
  { label: "All", start: 1, end: 9999 },
  { label: "1–20", start: 1, end: 20 },
  { label: "21–40", start: 21, end: 40 },
  { label: "41–60", start: 41, end: 60 },
  { label: "61–100", start: 61, end: 100 },
  { label: "101–200", start: 101, end: 200 },
] as const;

async function probeClip(clip: ManifestClip): Promise<ClipStatus> {
  const url = audioUrl(clip.audio);
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) {
      return {
        rank: clip.rank,
        word: clip.word,
        audioFile: clip.audio,
        duration: null,
        exists: false,
        flag: "missing",
      };
    }
  } catch {
    return {
      rank: clip.rank,
      word: clip.word,
      audioFile: clip.audio,
      duration: null,
      exists: false,
      flag: "missing",
    };
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (duration: number | null, flag: ClipStatus["flag"]) => {
      resolve({
        rank: clip.rank,
        word: clip.word,
        audioFile: clip.audio,
        duration,
        exists: true,
        flag,
      });
    };
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      if (!Number.isFinite(d)) {
        done(null, "unknown");
        return;
      }
      if (d < SHORT_SEC) done(d, "short");
      else if (d > LONG_SEC) done(d, "long");
      else done(d, "ok");
    };
    audio.onerror = () => done(null, "missing");
    audio.src = url;
  });
}

export default function MandarinAudioReviewPage() {
  const [rows, setRows] = useState<ClipStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(9999);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AUDIO_BASE}/manifest.json`);
        if (!res.ok) {
          throw new Error(`Could not load manifest (${res.status})`);
        }
        const data = (await res.json()) as ManifestPayload;
        const clips = [...(data.clips ?? [])].sort((a, b) => a.rank - b.rank);
        if (cancelled) return;

        const results: ClipStatus[] = [];
        for (const clip of clips) {
          // sequential to avoid hammering
          // eslint-disable-next-line no-await-in-loop
          const status = await probeClip(clip);
          if (cancelled) return;
          results.push(status);
          setRows([...results]);
        }
        if (!cancelled) setLoading(false);
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
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => r.rank >= rangeStart && r.rank <= rangeEnd),
    [rows, rangeStart, rangeEnd],
  );
  const flagged = visible.filter((r) => r.flag !== "ok");
  const maxRank = rows.length ? rows[rows.length - 1]!.rank : 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="chip bg-amber/25 text-foreground">Local QA</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Audio review — all clips with files
          {maxRank > 0 ? ` (1–${maxRank})` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Use the <strong>Ref</strong> number (same as the audio filename rank,
          e.g. <code>#0021</code>) when reporting a bad clip to your teacher.
          Folder: <code>{AUDIO_BASE}</code>
        </p>
        <p className="mt-1 text-sm text-muted">
          Flags: shorter than {SHORT_SEC}s or longer than {LONG_SEC}s. Filter by
          rank to ear-check a batch (e.g. 21–40).
        </p>
      </div>

      <Link
        href="/english-for-mandarin-speakers"
        className="btn-secondary inline-flex rounded-2xl px-4 py-2 text-sm font-bold"
      >
        ← Back to quiz
      </Link>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white/80 p-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => {
            const active =
              rangeStart === preset.start && rangeEnd === preset.end;
            return (
              <button
                key={preset.label}
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm font-bold ${
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
        <label className="flex items-center gap-2 text-sm">
          From
          <input
            type="number"
            min={1}
            value={rangeStart}
            onChange={(e) => setRangeStart(Number(e.target.value) || 1)}
            className="w-20 rounded-lg border border-border px-2 py-1 font-mono"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          To
          <input
            type="number"
            min={1}
            value={rangeEnd === 9999 ? maxRank || 200 : rangeEnd}
            onChange={(e) => setRangeEnd(Number(e.target.value) || 1)}
            className="w-20 rounded-lg border border-border px-2 py-1 font-mono"
          />
        </label>
      </div>

      {loadError ? (
        <p className="text-sm text-danger">{loadError}</p>
      ) : loading ? (
        <p className="text-sm text-muted">
          Probing clips… {rows.length}
          {maxRank ? ` loaded` : ""}
        </p>
      ) : (
        <p className="text-sm">
          Showing {visible.length} of {rows.length} clips · {flagged.length}{" "}
          need review in this range
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-white/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-accent-soft/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Word</th>
              <th className="px-3 py-2">Play</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Filename</th>
              <th className="px-3 py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.rank}
                id={`ref-${String(row.rank).padStart(4, "0")}`}
                className={`border-b border-border/70 ${
                  row.flag !== "ok" ? "bg-danger/5" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono font-bold">
                  #{String(row.rank).padStart(4, "0")}
                </td>
                <td className="px-3 py-2 font-bold">{row.word}</td>
                <td className="px-3 py-2">
                  {row.exists ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio
                      controls
                      preload="none"
                      src={audioUrl(row.audioFile)}
                      className="h-8 max-w-[180px]"
                    />
                  ) : (
                    <span className="text-danger">missing</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">
                  {row.duration != null ? `${row.duration.toFixed(2)}s` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.audioFile}</td>
                <td className="px-3 py-2 font-bold uppercase">
                  {row.flag === "ok" ? (
                    <span className="text-success">ok</span>
                  ) : (
                    <span className="text-danger">{row.flag}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
