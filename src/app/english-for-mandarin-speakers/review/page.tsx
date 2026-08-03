"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ACTIVE_VOCAB_WORDS,
  AUDIO_BASE,
  audioUrl,
  type MandarinVocabWord,
} from "@/data/mandarin-vocab";

type ClipStatus = {
  word: MandarinVocabWord;
  duration: number | null;
  exists: boolean | null;
  flag: "ok" | "short" | "long" | "missing" | "unknown";
};

const SHORT_SEC = 0.25;
const LONG_SEC = 1.8;

async function probeClip(word: MandarinVocabWord): Promise<ClipStatus> {
  const url = audioUrl(word.audioFile);
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) {
      return { word, duration: null, exists: false, flag: "missing" };
    }
  } catch {
    return { word, duration: null, exists: false, flag: "missing" };
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (duration: number | null, flag: ClipStatus["flag"]) => {
      resolve({ word, duration, exists: true, flag });
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: ClipStatus[] = [];
      for (const word of ACTIVE_VOCAB_WORDS) {
        // sequential to avoid hammering
        // eslint-disable-next-line no-await-in-loop
        const status = await probeClip(word);
        if (cancelled) return;
        results.push(status);
        setRows([...results]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flagged = rows.filter((r) => r.flag !== "ok");

  return (
    <div className="space-y-4">
      <div>
        <p className="chip bg-amber/25 text-foreground">Local QA</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Audio review — ranks 1–{ACTIVE_VOCAB_WORDS.length}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Use the <strong>Ref</strong> number (same as the audio filename rank,
          e.g. <code>#0019</code>) when reporting a bad clip to your teacher.
          Folder: <code>{AUDIO_BASE}</code>
        </p>
        <p className="mt-1 text-sm text-muted">
          Flags: shorter than {SHORT_SEC}s or longer than {LONG_SEC}s.
        </p>
      </div>

      <Link href="/english-for-mandarin-speakers" className="btn-secondary inline-flex rounded-2xl px-4 py-2 text-sm font-bold">
        ← Back to quiz
      </Link>

      {loading ? (
        <p className="text-sm text-muted">
          Probing clips… {rows.length}/{ACTIVE_VOCAB_WORDS.length}
        </p>
      ) : (
        <p className="text-sm">
          {rows.length} clips checked · {flagged.length} need review
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
            {rows.map((row) => (
              <tr
                key={row.word.rank}
                className={`border-b border-border/70 ${
                  row.flag !== "ok" ? "bg-danger/5" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono font-bold">
                  #{String(row.word.rank).padStart(4, "0")}
                </td>
                <td className="px-3 py-2 font-bold">{row.word.word}</td>
                <td className="px-3 py-2">
                  {row.exists ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio
                      controls
                      preload="none"
                      src={audioUrl(row.word.audioFile)}
                      className="h-8 max-w-[180px]"
                    />
                  ) : (
                    <span className="text-danger">missing</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">
                  {row.duration != null ? `${row.duration.toFixed(2)}s` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {row.word.audioFile}
                </td>
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
