"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AUDIO_BASE,
  MANDARIN_VOCAB_WORDS,
  expectedAudioFile,
} from "@/data/mandarin-vocab";
import { useAudioOverrides } from "@/lib/audio-overrides-client";
import {
  audioOverrideTombstone,
  isActiveAudioOverride,
  rankKey,
  type AudioOverrideMap,
} from "@/lib/audio-overrides";
import {
  deleteStudioClip,
  getAllStudioClipRanks,
  getStudioClip,
  putStudioClip,
} from "@/lib/studio-audio-db";
import {
  getStudioSessionPassword,
  isStudioAuthed,
  loadStudioNotes,
  saveStudioNotes,
  setStudioAuthed,
  type StudioRankNote,
  type StudioVerifyStatus,
} from "@/lib/studio-progress";

type ManifestClip = { rank: number; word: string; audio: string };

type BatchFilter =
  | "1-10"
  | "11-20"
  | "21-30"
  | "31-40"
  | "41-50"
  | "all"
  | "needs";

type StudioRow = {
  rank: number;
  word: string;
  zh: string;
  audioFile: string;
  hasManifest: boolean;
  status: StudioVerifyStatus;
  note: string;
  hasLocalClip: boolean;
  hasServerOverride: boolean;
};

type PreviewState = {
  rank: number;
  blob: Blob;
  filename: string;
  objectUrl: string;
  source: "record" | "upload";
};

const BATCH_FILTERS: { id: BatchFilter; label: string }[] = [
  { id: "1-10", label: "1–10" },
  { id: "11-20", label: "11–20" },
  { id: "21-30", label: "21–30" },
  { id: "31-40", label: "31–40" },
  { id: "41-50", label: "41–50" },
  { id: "all", label: "All 1–50" },
  { id: "needs", label: "Needs addressing" },
];

const STUDIO_MAX_RANK = 50;

function refOf(rank: number): string {
  return `#${String(rank).padStart(4, "0")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pickRecorderMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") {
    return { mime: "audio/webm", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mime: "audio/webm;codecs=opus", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return { mime: "audio/webm", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mime: "audio/mp4", ext: "m4a" };
  }
  return { mime: "", ext: "webm" };
}

function targetDownloadName(audioFile: string, ext: string): string {
  const base = audioFile.replace(/\.(mp3|wav|webm|m4a|ogg|mp4)$/i, "");
  // Prefer the published .mp3 name when the blob is already mp3; else keep blob ext.
  if (ext === "mp3") return `${base}.mp3`;
  return `${base}.${ext}`;
}

function batchRange(filter: BatchFilter): { start: number; end: number } | null {
  switch (filter) {
    case "1-10":
      return { start: 1, end: 10 };
    case "11-20":
      return { start: 11, end: 20 };
    case "21-30":
      return { start: 21, end: 30 };
    case "31-40":
      return { start: 31, end: 40 };
    case "41-50":
      return { start: 41, end: 50 };
    case "all":
    case "needs":
      return { start: 1, end: STUDIO_MAX_RANK };
    default:
      return { start: 1, end: STUDIO_MAX_RANK };
  }
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
  const [localClipRanks, setLocalClipRanks] = useState<Set<number>>(
    () => new Set(),
  );
  const [filter, setFilter] = useState<BatchFilter>("1-10");
  const [playing, setPlaying] = useState<number | null>(null);
  const [recordingRank, setRecordingRank] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"info" | "ok" | "err">("info");
  const [savingPermanent, setSavingPermanent] = useState(false);
  const [clearingRank, setClearingRank] = useState<number | null>(null);
  const { overrides, refresh: refreshOverrides, apply: applyOverrides, resolveUrl } =
    useAudioOverrides();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRankRef = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const clearPreview = useCallback(() => {
    setPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    setAuthed(isStudioAuthed());
    setNotes(loadStudioNotes());
    return () => {
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AUDIO_BASE}/manifest.json`, {
          cache: "no-store",
        });
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

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const ranks = await getAllStudioClipRanks();
        if (!cancelled) setLocalClipRanks(new Set(ranks));
      } catch {
        /* IndexedDB optional */
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
    for (let rank = 1; rank <= STUDIO_MAX_RANK; rank++) {
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
        zh: vocab?.zh ?? "",
        audioFile,
        hasManifest: Boolean(man?.audio),
        status: n?.status ?? "unchecked",
        note: n?.note ?? "",
        hasLocalClip: localClipRanks.has(rank),
        hasServerOverride: isActiveAudioOverride(overrides[rankKey(rank)]),
      });
    }
    return list;
  }, [manifestByRank, notes, localClipRanks, overrides]);

  const okCount = useMemo(
    () => rows.filter((r) => r.status === "ok").length,
    [rows],
  );
  const needsCount = useMemo(
    () => rows.filter((r) => r.status === "needs_addressing").length,
    [rows],
  );

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "needs") return r.status === "needs_addressing";
      const range = batchRange(filter);
      if (!range) return true;
      return r.rank >= range.start && r.rank <= range.end;
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
      setStudioAuthed(true, password);
      setAuthed(true);
      setPassword("");
    } catch {
      setAuthError("Could not verify password");
    }
  };

  const flash = (text: string, tone: "info" | "ok" | "err" = "info") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    setPlaying(null);
  };

  const playSrc = (rank: number, src: string, label: string) => {
    // Always allocate a fresh Audio element so browsers cannot reuse a cached
    // decode of a previous clip (stable Blob CDN URLs used to do this).
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    const a = new Audio();
    audioRef.current = a;
    a.src = src;
    a.load();
    setPlaying(rank);
    setMsg(null);
    void a.play().catch(() => {
      setPlaying(null);
      flash(`Could not play ${label} (missing, blocked, or empty).`, "err");
    });
    a.onended = () => setPlaying(null);
    a.onerror = () => {
      setPlaying(null);
      flash(`Could not play ${label} (missing or decode error).`, "err");
    };
  };

  const playPublished = (row: StudioRow) => {
    playSrc(row.rank, resolveUrl(row.rank, row.audioFile), row.audioFile);
  };

  const playLocal = async (rank: number) => {
    try {
      const clip = await getStudioClip(rank);
      if (!clip) {
        flash(`No browser-only copy stored for ${refOf(rank)}.`, "err");
        return;
      }
      const url = URL.createObjectURL(clip.blob);
      playSrc(rank, url, clip.filename);
      // Revoke after play starts; keep long enough for load
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      flash("Could not read browser-only copy from IndexedDB.", "err");
    }
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

  const clearStatus = (rank: number) => {
    setStatus(rank, "unchecked");
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
      flash("Imported notes into this browser (localStorage).", "ok");
    } catch {
      flash("Could not parse import JSON.", "err");
    }
  };

  const openPreview = (rank: number, blob: Blob, filename: string, source: "record" | "upload") => {
    clearPreview();
    const objectUrl = URL.createObjectURL(blob);
    setPreview({ rank, blob, filename, objectUrl, source });
    flash(
      `Preview ready for ${refOf(rank)}. Listen, then Save permanently so every browser/device gets this clip.`,
      "info",
    );
  };

  const startUpload = (rank: number) => {
    uploadRankRef.current = rank;
    fileInputRef.current?.click();
  };

  const onUploadFile = async (file: File) => {
    const rank = uploadRankRef.current;
    if (rank == null) return;
    const row = rows.find((r) => r.rank === rank);
    const published = row?.audioFile ?? expectedAudioFile(rank, `rank-${rank}`);
    const ext =
      (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "mp3";
    const filename = targetDownloadName(published, ext === "mpeg" ? "mp3" : ext);
    openPreview(rank, file, filename, "upload");
  };

  const startRecord = async (rank: number) => {
    if (recordingRank != null) return;
    if (typeof MediaRecorder === "undefined") {
      flash("MediaRecorder not supported in this browser.", "err");
      return;
    }
    try {
      stopPlayback();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const { mime, ext } = pickRecorderMime();
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blobType = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const row = rows.find((r) => r.rank === rank);
        const published =
          row?.audioFile ?? expectedAudioFile(rank, row?.word ?? "clip");
        const filename = targetDownloadName(published, ext);
        openPreview(rank, blob, filename, "record");
        setRecordingRank(null);
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = rec;
      rec.start(250);
      setRecordingRank(rank);
      flash(`Recording ${refOf(rank)}… tap Stop when finished.`, "info");
    } catch {
      flash("Microphone permission denied or unavailable on this device.", "err");
    }
  };

  const stopRecord = () => {
    mediaRecorderRef.current?.stop();
  };

  const savePreviewPermanent = async () => {
    if (!preview || savingPermanent) return;
    const pw = getStudioSessionPassword();
    if (!pw) {
      flash("Session expired — lock and unlock Studio again, then retry Save permanently.", "err");
      return;
    }
    setSavingPermanent(true);
    flash(`Uploading ${preview.filename} permanently…`, "info");
    try {
      const form = new FormData();
      form.set("password", pw);
      form.set("rank", String(preview.rank));
      form.set("filename", preview.filename);
      const row = rows.find((r) => r.rank === preview.rank);
      if (row?.word) form.set("word", row.word);
      form.set("audio", preview.blob, preview.filename);
      const res = await fetch("/api/studio/audio", {
        method: "POST",
        headers: { "x-studio-password": pw },
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        entry?: { url: string; filename: string; updatedAt: string };
        overrides?: AudioOverrideMap;
      };
      if (!res.ok || !data.ok) {
        flash(
          data.error ||
            `Permanent save failed (${res.status}). Enable Vercel Blob and set BLOB_READ_WRITE_TOKEN.`,
          "err",
        );
        return;
      }
      // Optimistic: apply POST map immediately so list Play hits the new Blob URL
      // before GET catch-up. Merge-on-refetch prevents a briefly stale GET from
      // wiping this entry.
      if (data.overrides && typeof data.overrides === "object") {
        applyOverrides(data.overrides);
      } else if (data.entry) {
        const key = String(preview.rank).padStart(4, "0");
        applyOverrides({ [key]: data.entry });
      }
      try {
        await refreshOverrides();
      } catch {
        /* keep optimistic map */
      }
      // Second soft confirm after Blob replication (non-blocking)
      window.setTimeout(() => {
        void refreshOverrides();
      }, 1500);
      // Optional local mirror for offline preview on this device
      try {
        await putStudioClip(preview.rank, preview.filename, preview.blob);
        setLocalClipRanks((prev) => new Set(prev).add(preview.rank));
      } catch {
        /* optional */
      }
      flash(
        `Saved permanently: ${data.entry?.filename ?? preview.filename}. Live on the site for everyone.`,
        "ok",
      );
      clearPreview();
    } catch {
      flash(
        "Network error while uploading. Permanent save did not complete — try again.",
        "err",
      );
    } finally {
      setSavingPermanent(false);
    }
  };

  const savePreviewLocal = async () => {
    if (!preview) return;
    try {
      await putStudioClip(preview.rank, preview.filename, preview.blob);
      setLocalClipRanks((prev) => new Set(prev).add(preview.rank));
      flash(
        `Browser-only copy of ${preview.filename} kept here. Use Save permanently to publish for everyone.`,
        "info",
      );
    } catch {
      flash("Could not save browser-only copy — use Save permanently or Download.", "err");
    }
  };

  const downloadPreview = () => {
    if (!preview) return;
    downloadBlob(preview.blob, preview.filename);
    flash(
      `Downloaded ${preview.filename} as backup. Prefer Save permanently to update the live site.`,
      "info",
    );
  };

  const discardPreview = () => {
    clearPreview();
    flash("Preview discarded.", "info");
  };

  const clearLocalClip = async (rank: number) => {
    try {
      await deleteStudioClip(rank);
      setLocalClipRanks((prev) => {
        const next = new Set(prev);
        next.delete(rank);
        return next;
      });
      flash(`Cleared browser-only copy for ${refOf(rank)}.`, "info");
    } catch {
      flash("Could not clear browser-only copy.", "err");
    }
  };

  /** Clear permanent Blob override for this rank (available on every row). */
  const clearPermanentAudio = async (rank: number) => {
    if (clearingRank != null) return;
    const pw = getStudioSessionPassword();
    if (!pw) {
      flash("Session expired — lock and unlock Studio again, then retry Clear audio.", "err");
      return;
    }
    setClearingRank(rank);
    if (playing === rank) stopPlayback();
    if (preview?.rank === rank) clearPreview();
    flash(`Clearing permanent audio for ${refOf(rank)}…`, "info");
    try {
      // Optimistic tombstone so Play falls back immediately
      applyOverrides({ [rankKey(rank)]: audioOverrideTombstone() });
      const res = await fetch(`/api/studio/audio?rank=${rank}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-studio-password": pw,
        },
        body: JSON.stringify({ password: pw }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        overrides?: AudioOverrideMap;
      };
      if (!res.ok || !data.ok) {
        flash(
          data.error ||
            `Clear failed (${res.status}). Check Blob token / studio password.`,
          "err",
        );
        try {
          await refreshOverrides();
        } catch {
          /* keep optimistic tombstone */
        }
        return;
      }
      if (data.overrides && typeof data.overrides === "object") {
        applyOverrides(data.overrides);
      } else {
        applyOverrides({ [rankKey(rank)]: audioOverrideTombstone() });
      }
      try {
        await refreshOverrides();
      } catch {
        /* keep optimistic map */
      }
      window.setTimeout(() => {
        void refreshOverrides();
      }, 1500);
      flash(
        `Cleared permanent override for ${refOf(rank)}. Play uses the static file (or silence) until you upload again.`,
        "ok",
      );
    } catch {
      flash("Network error while clearing audio — try again.", "err");
    } finally {
      setClearingRank(null);
    }
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
          Quality-gate draft bulk audio for the first 50 frequency words before
          trusting Mahjong Audio modes. Password required.
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
            className="mt-1 w-full rounded-xl border border-border px-3 py-3 text-base font-normal"
            autoComplete="current-password"
          />
        </label>
        {authError ? <p className="text-sm text-danger">{authError}</p> : null}
        <button
          type="button"
          className="btn-primary touch-target w-full rounded-2xl px-4 py-3.5 text-base font-bold"
          onClick={() => void login()}
        >
          Unlock Studio
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
    <div className="relative z-20 space-y-4 pb-28">
      <div>
        <p className="chip bg-amber/25">Quality gate · ranks 1–50</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Audio Studio
        </h1>
        <p className="mt-2 text-sm text-muted">
          This is how we decide clips are good enough for Mahjong Audio modes —
          play each word, mark <strong>OK</strong> or{" "}
          <strong>Needs addressing</strong>, leave notes, and re-record or upload
          replacements. Status lives in this browser (export JSON backup). After
          preview, use <strong>Save permanently</strong> so every learner (all
          browsers/devices) hears the new clip via Vercel Blob — no git commit
          required.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Progress
            </p>
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums">
              {okCount}
              <span className="text-lg text-muted">/{STUDIO_MAX_RANK} OK</span>
            </p>
            <p className="text-sm text-muted">
              {needsCount} needs addressing · {STUDIO_MAX_RANK - okCount - needsCount}{" "}
              unmarked
            </p>
          </div>
          <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-accent-soft/50">
            <div
              className="h-full rounded-full bg-success transition-[width]"
              style={{ width: `${(okCount / STUDIO_MAX_RANK) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="sticky top-2 z-40 space-y-2 rounded-2xl border border-border bg-white/95 p-3 shadow-md backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {BATCH_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`touch-target rounded-xl px-3 py-2.5 text-sm font-bold ${
                filter === id
                  ? "bg-accent text-white"
                  : "bg-accent-soft/60 hover:bg-accent-soft"
              }`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
            onClick={exportJson}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="btn-secondary touch-target rounded-xl px-3 py-2 text-sm font-bold"
            onClick={() => importRef.current?.click()}
          >
            Import JSON
          </button>
          <button
            type="button"
            className="touch-target rounded-xl px-3 py-2 text-sm font-bold text-muted underline"
            onClick={() => {
              stopPlayback();
              clearPreview();
              setStudioAuthed(false);
              setAuthed(false);
            }}
          >
            Lock
          </button>
        </div>
      </div>

      {msg ? (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            msgTone === "ok"
              ? "border-success/40 bg-success/15"
              : msgTone === "err"
                ? "border-danger/40 bg-danger/10"
                : "border-amber/40 bg-amber/15"
          }`}
          role="status"
        >
          {msg}
        </p>
      ) : null}

      {preview ? (
        <div className="sticky bottom-2 z-50 space-y-3 rounded-2xl border-2 border-accent bg-white p-4 shadow-lg">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-lg font-bold">
              {refOf(preview.rank)}
            </span>
            <span className="text-sm font-bold">
              Preview ({preview.source})
            </span>
            <span className="font-mono text-xs text-muted">{preview.filename}</span>
          </div>
          <audio
            key={preview.objectUrl}
            controls
            src={preview.objectUrl}
            className="w-full"
            playsInline
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary touch-target rounded-xl px-4 py-3 text-sm font-bold"
              disabled={savingPermanent}
              onClick={() => void savePreviewPermanent()}
            >
              {savingPermanent ? "Saving permanently…" : "Save permanently"}
            </button>
            <button
              type="button"
              className="btn-secondary touch-target rounded-xl px-4 py-3 text-sm font-bold"
              disabled={savingPermanent}
              onClick={downloadPreview}
            >
              Download {preview.filename}
            </button>
            <button
              type="button"
              className="touch-target rounded-xl px-4 py-3 text-sm font-bold text-muted underline"
              disabled={savingPermanent}
              onClick={() => void savePreviewLocal()}
            >
              Browser-only copy
            </button>
            <button
              type="button"
              className="touch-target rounded-xl px-4 py-3 text-sm font-bold text-muted underline"
              disabled={savingPermanent}
              onClick={discardPreview}
            >
              Discard
            </button>
          </div>
          <p className="text-xs text-muted">
            <strong>Save permanently</strong> uploads to Vercel Blob and updates
            the live override map for quiz, mahjong, and review. Download is a
            local backup only. Prefer MP3 when you can; phone recordings are often
            WebM/M4A.
          </p>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg"
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
            className={`rounded-2xl border border-border bg-white p-3 shadow-sm ${
              row.status === "needs_addressing"
                ? "border-danger/40 bg-danger/5"
                : row.status === "ok"
                  ? "border-success/40 bg-success/5"
                  : ""
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-xl font-bold">{refOf(row.rank)}</span>
              <span className="text-xl font-bold">{row.word}</span>
              {row.zh ? (
                <span className="text-base text-muted">{row.zh}</span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">
              {row.audioFile}
              {!row.hasManifest ? (
                <span className="ml-2 font-sans font-bold uppercase text-danger">
                  missing in manifest
                </span>
              ) : null}
              {row.hasServerOverride ? (
                <span className="ml-2 font-sans font-bold text-success">
                  · live override
                </span>
              ) : null}
              {row.hasLocalClip ? (
                <span className="ml-2 font-sans font-bold text-muted">
                  · browser-only copy
                </span>
              ) : null}
            </p>

            <button
              type="button"
              className="btn-primary mt-3 flex min-h-[52px] w-full touch-target items-center justify-center rounded-2xl px-4 py-3 text-base font-bold"
              onClick={() => playPublished(row)}
            >
              {playing === row.rank ? "Playing… tap again OK" : "▶ Play current audio"}
            </button>

            <div className="mt-2 flex flex-wrap gap-2">
              {row.hasLocalClip ? (
                <button
                  type="button"
                  className="btn-secondary touch-target rounded-xl px-3 py-2.5 text-sm font-bold"
                  onClick={() => void playLocal(row.rank)}
                >
                  Play browser-only copy
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary touch-target rounded-xl px-3 py-2.5 text-sm font-bold"
                onClick={() => startUpload(row.rank)}
              >
                Upload replace
              </button>
              {recordingRank === row.rank ? (
                <button
                  type="button"
                  className="touch-target rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white"
                  onClick={stopRecord}
                >
                  ■ Stop recording
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary touch-target rounded-xl px-3 py-2.5 text-sm font-bold"
                  onClick={() => void startRecord(row.rank)}
                  disabled={recordingRank != null}
                >
                  ● Record mic
                </button>
              )}
              {row.hasLocalClip ? (
                <button
                  type="button"
                  className="touch-target rounded-xl px-3 py-2.5 text-sm font-bold text-muted underline"
                  onClick={() => void clearLocalClip(row.rank)}
                >
                  Clear browser copy
                </button>
              ) : null}
              <button
                type="button"
                className="touch-target rounded-xl px-3 py-2.5 text-sm font-bold text-danger underline disabled:opacity-50"
                disabled={clearingRank != null}
                onClick={() => void clearPermanentAudio(row.rank)}
                title={
                  row.hasServerOverride
                    ? "Remove permanent Blob override for this rank"
                    : "Clear permanent override if any (Play falls back to static file)"
                }
              >
                {clearingRank === row.rank ? "Clearing…" : "Clear audio"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={`touch-target min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-bold ${
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
                className={`touch-target min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-bold ${
                  row.status === "needs_addressing"
                    ? "bg-danger text-white"
                    : "bg-danger/10 text-danger"
                }`}
                onClick={() => setStatus(row.rank, "needs_addressing")}
              >
                Needs addressing
              </button>
              {row.status !== "unchecked" ? (
                <button
                  type="button"
                  className="touch-target rounded-xl px-3 py-2.5 text-sm font-bold text-muted underline"
                  onClick={() => clearStatus(row.rank)}
                >
                  Clear mark
                </button>
              ) : (
                <span className="self-center text-xs font-bold uppercase text-muted">
                  Unmarked
                </span>
              )}
            </div>

            <label className="mt-2 block text-xs font-bold text-muted">
              Notes
              <textarea
                value={row.note}
                onChange={(e) => setNote(row.rank, e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-foreground"
                placeholder="e.g. wrong word, cut-off, noise, too quiet…"
              />
            </label>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">No words in this filter.</p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm font-bold">
        <Link href="/english-for-mandarin-speakers" className="underline">
          Course / quiz
        </Link>
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
