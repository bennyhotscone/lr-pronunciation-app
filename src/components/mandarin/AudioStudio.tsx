"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AUDIO_BASE,
  MANDARIN_VOCAB_WORDS,
  audioUrl,
  expectedAudioFile,
} from "@/data/mandarin-vocab";
import {
  isStudioAuthed,
  loadStudioNotes,
  saveStudioNotes,
  setStudioAuthed,
  type StudioRankNote,
  type StudioVerifyStatus,
} from "@/lib/studio-progress";

type ManifestClip = { rank: number; word: string; audio: string };
type FilterKind = "all" | "ok" | "needs_addressing" | "unchecked" | "missing";

type StudioRow = {
  rank: number;
  word: string;
  audioFile: string;
  hasFileGuess: boolean;
  status: StudioVerifyStatus;
  note: string;
};

function refOf(rank: number): string {
  return `#${String(rank).padStart(4, "0")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AudioStudio() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, StudioRankNote>>({});
  const [manifestByRank, setManifestByRank] = useState<Map<number, ManifestClip>>(
    () => new Map(),
  );
  const [filter, setFilter] = useState<FilterKind>("all");
  const [rangeEnd, setRangeEnd] = useState(50);
  const [playing, setPlaying] = useState<number | null>(null);
  const [recordingRank, setRecordingRank] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRankRef = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setAuthed(isStudioAuthed());
    setNotes(loadStudioNotes());
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AUDIO_BASE}/manifest.json`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { clips?: ManifestClip[] };
        if (cancelled) return;
        const map = new Map<number, ManifestClip>();
        for (const c of data.clips ?? []) map.set(c.rank, c);
        setManifestByRank(map);
      } catch {
        /* keep empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const persistNotes = useCallback((next: Record<string, StudioRankNote>) => {
    setNotes(next);
    saveStudioNotes(next);
  }, []);

  const rows: StudioRow[] = useMemo(() => {
    const fromVocab = new Map(
      MANDARIN_VOCAB_WORDS.map((w) => [w.rank, w] as const),
    );
    const list: StudioRow[] = [];
    for (let rank = 1; rank <= rangeEnd; rank++) {
      const vocab = fromVocab.get(rank);
      const man = manifestByRank.get(rank);
      const word = vocab?.word ?? man?.word ?? `rank-${rank}`;
      const audioFile =
        man?.audio || vocab?.audioFile || expectedAudioFile(rank, word);
      const key = String(rank);
      const n = notes[key];
      list.push({
        rank,
        word,
        audioFile,
        hasFileGuess: Boolean(man?.audio),
        status: n?.status ?? "unchecked",
        note: n?.note ?? "",
      });
    }
    return list;
  }, [manifestByRank, notes, rangeEnd]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "missing") return !r.hasFileGuess;
      return r.status === filter;
    });
  }, [rows, filter]);

  const login = async () => {
    setAuthError(null);
    try {
      const res = await fetch("/api/studio-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setAuthError("Wrong password");
        return;
      }
      setStudioAuthed(true);
      setAuthed(true);
      setPassword("");
    } catch {
      setAuthError("Could not verify password");
    }
  };

  const play = (row: StudioRow) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    a.src = audioUrl(row.audioFile);
    setPlaying(row.rank);
    void a.play().catch(() => {
      setPlaying(null);
      setMsg(`Could not play ${row.audioFile} (missing or blocked).`);
    });
    a.onended = () => setPlaying(null);
  };

  const setStatus = (rank: number, status: StudioVerifyStatus) => {
    const key = String(rank);
    const prev = notes[key];
    persistNotes({
      ...notes,
      [key]: {
        status,
        note: prev?.note ?? "",
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const setNote = (rank: number, note: string) => {
    const key = String(rank);
    const prev = notes[key];
    persistNotes({
      ...notes,
      [key]: {
        status: prev?.status ?? "unchecked",
        note,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            ranks: notes,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    downloadBlob(blob, `mandarin-studio-notes-${Date.now()}.json`);
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        ranks?: Record<string, StudioRankNote>;
      };
      if (!parsed.ranks || typeof parsed.ranks !== "object") {
        setMsg("Import JSON must include a ranks object.");
        return;
      }
      persistNotes({ ...notes, ...parsed.ranks });
      setMsg("Imported notes into this browser.");
    } catch {
      setMsg("Could not parse import JSON.");
    }
  };

  const startUpload = (rank: number) => {
    uploadRankRef.current = rank;
    fileInputRef.current?.click();
  };

  const onUploadFile = async (file: File) => {
    const rank = uploadRankRef.current;
    if (rank == null) return;
    const row = rows.find((r) => r.rank === rank);
    const name = row?.audioFile ?? expectedAudioFile(rank, `rank-${rank}`);
    downloadBlob(file, name);
    setMsg(
      `Downloaded ${name}. On Vercel, files don’t save to the server — commit this file to public/audio/mandarin-vocab/ to publish.`,
    );
  };

  const startRecord = async (rank: number) => {
    if (recordingRank != null) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const row = rows.find((r) => r.rank === rank);
        const base = (row?.audioFile ?? expectedAudioFile(rank, "clip")).replace(
          /\.mp3$/i,
          "",
        );
        const ext = mime.includes("webm") ? "webm" : "m4a";
        downloadBlob(blob, `${base}.${ext}`);
        setMsg(
          `Recording saved as ${base}.${ext}. Convert to MP3 and commit to public/audio/mandarin-vocab/ to publish. Status/notes stay in this browser.`,
        );
        setRecordingRank(null);
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecordingRank(rank);
      setMsg(`Recording Ref ${refOf(rank)}… tap Stop when done.`);
    } catch {
      setMsg("Microphone permission denied or unavailable.");
    }
  };

  const stopRecord = () => {
    mediaRecorderRef.current?.stop();
  };

  if (!mounted) {
    return <p className="text-sm text-muted">Loading studio…</p>;
  }

  if (!authed) {
    return (
      <div className="relative z-20 mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-white p-5 shadow-md">
        <p className="chip bg-amber/25">Teacher / admin</p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Audio Studio
        </h1>
        <p className="text-sm text-muted">
          Password-protected workspace to verify draft bulk cuts. Bulk audio is
          not assumed good until marked OK.
        </p>
        <label className="block text-sm font-bold">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void login();
            }}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
            autoComplete="current-password"
          />
        </label>
        {authError ? <p className="text-sm text-danger">{authError}</p> : null}
        <button
          type="button"
          className="btn-primary touch-target w-full rounded-2xl px-4 py-3 font-bold"
          onClick={() => void login()}
        >
          Unlock
        </button>
        <Link
          href="/english-for-mandarin-speakers/review"
          className="block text-center text-sm font-bold underline"
        >
          ← Public review list
        </Link>
      </div>
    );
  }

  return (
    <div className="relative z-20 space-y-4">
      <div>
        <p className="chip bg-amber/25">Draft verification required</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Audio Studio
        </h1>
        <p className="mt-2 text-sm text-muted">
          Honest workflow: bulk MP3s under <code>{AUDIO_BASE}</code> are{" "}
          <strong>draft</strong>. Mark <strong>OK</strong> or{" "}
          <strong>Needs addressing</strong>, add notes, and download
          replacements. On Vercel, uploads do not write to the server — download
          the file and commit it. Notes/status stay in this browser (export JSON
          backup).
        </p>
      </div>

      <div className="sticky top-2 z-40 flex flex-wrap gap-2 rounded-2xl border border-border bg-white p-3 shadow-md">
        {(
          [
            ["all", "All"],
            ["needs_addressing", "Needs addressing"],
            ["ok", "OK"],
            ["unchecked", "Unchecked"],
            ["missing", "No manifest file"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`touch-target rounded-xl px-3 py-2 text-sm font-bold ${
              filter === id
                ? "bg-accent text-white"
                : "bg-accent-soft/60 hover:bg-accent-soft"
            }`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <select
          className="rounded-xl border border-border px-2 py-2 text-sm font-bold"
          value={rangeEnd}
          onChange={(e) => setRangeEnd(Number(e.target.value))}
        >
          <option value={20}>Ranks 1–20</option>
          <option value={50}>Ranks 1–50</option>
          <option value={100}>Ranks 1–100</option>
          <option value={200}>Ranks 1–200</option>
        </select>
        <button
          type="button"
          className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
          onClick={exportJson}
        >
          Export notes JSON
        </button>
        <button
          type="button"
          className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
          onClick={() => importRef.current?.click()}
        >
          Import notes JSON
        </button>
        <button
          type="button"
          className="touch-target rounded-xl px-3 py-2 text-sm font-bold text-muted underline"
          onClick={() => {
            setStudioAuthed(false);
            setAuthed(false);
          }}
        >
          Lock
        </button>
      </div>

      {msg ? (
        <p className="rounded-xl border border-amber/40 bg-amber/15 px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUploadFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = "";
        }}
      />

      <ul className="space-y-3">
        {visible.map((row) => (
          <li
            key={row.rank}
            className={`rounded-2xl border border-border bg-white p-3 ${
              row.status === "needs_addressing"
                ? "border-danger/40 bg-danger/5"
                : row.status === "ok"
                  ? "border-success/40 bg-success/5"
                  : ""
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-lg font-bold">{refOf(row.rank)}</span>
              <span className="text-lg font-bold">{row.word}</span>
              <span className="font-mono text-xs text-muted">{row.audioFile}</span>
              {!row.hasFileGuess ? (
                <span className="text-xs font-bold uppercase text-danger">
                  missing in manifest
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary touch-target rounded-xl px-3 py-2 text-sm font-bold"
                onClick={() => play(row)}
              >
                {playing === row.rank ? "Playing…" : "Play"}
              </button>
              <button
                type="button"
                className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
                onClick={() => startUpload(row.rank)}
              >
                Upload → download
              </button>
              {recordingRank === row.rank ? (
                <button
                  type="button"
                  className="touch-target rounded-xl bg-danger px-3 py-2 text-sm font-bold text-white"
                  onClick={stopRecord}
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
                  onClick={() => void startRecord(row.rank)}
                  disabled={recordingRank != null}
                >
                  Record mic
                </button>
              )}
              <button
                type="button"
                className={`touch-target rounded-xl px-3 py-2 text-sm font-bold ${
                  row.status === "ok"
                    ? "bg-success text-white"
                    : "bg-success/15 text-success"
                }`}
                onClick={() => setStatus(row.rank, "ok")}
              >
                OK
              </button>
              <button
                type="button"
                className={`touch-target rounded-xl px-3 py-2 text-sm font-bold ${
                  row.status === "needs_addressing"
                    ? "bg-danger text-white"
                    : "bg-danger/10 text-danger"
                }`}
                onClick={() => setStatus(row.rank, "needs_addressing")}
              >
                Needs addressing
              </button>
            </div>
            <label className="mt-2 block text-xs font-bold text-muted">
              Notes
              <textarea
                value={row.note}
                onChange={(e) => setNote(row.rank, e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border px-2 py-2 text-sm font-normal text-foreground"
                placeholder="e.g. wrong word, cut-off, noise…"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3 text-sm font-bold">
        <Link href="/english-for-mandarin-speakers/review" className="underline">
          Public review
        </Link>
        <Link href="/english-for-mandarin-speakers/mahjong" className="underline">
          Mahjong Solitaire
        </Link>
      </div>
    </div>
  );
}
