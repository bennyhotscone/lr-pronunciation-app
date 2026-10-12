"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { compressImageFile } from "@/lib/photo-treasure-hunt/compress";
import {
  MISSIONS,
  buildShareText,
  countCompleted,
  emptyDrafts,
  missionComplete,
  type MissionDraft,
} from "@/lib/photo-treasure-hunt/missions";
import { photoReportFilename, type ReportPhotoType } from "@/lib/photo-treasure-hunt/pdf";
import {
  openPhotoHuntDb,
  persistEntry,
  persistStudent,
  photoKey,
  restoreProgress,
  type KvStore,
} from "@/lib/photo-treasure-hunt/storage";

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    return String((error as { name: unknown }).name);
  }
  return "";
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function PhotoTreasureHunt() {
  const [drafts, setDrafts] = useState<MissionDraft[]>(() => emptyDrafts());
  const [photoUrls, setPhotoUrls] = useState<Array<string | null>>(() => MISSIONS.map(() => null));
  const [student, setStudent] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [storageStatus, setStorageStatus] = useState("Checking local storage…");
  const [toast, setToast] = useState<string | null>(null);
  const [busyPhoto, setBusyPhoto] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const dbRef = useRef<KvStore | null>(null);
  const draftsRef = useRef(drafts);
  const studentRef = useRef(student);
  const readyRef = useRef(false);
  const timersRef = useRef<Record<string, number>>({});
  const toastTimerRef = useRef<number | null>(null);
  const urlsRef = useRef<Array<string | null>>(MISSIONS.map(() => null));
  const cameraRefs = useRef<Array<HTMLInputElement | null>>([]);
  const galleryRefs = useRef<Array<HTMLInputElement | null>>([]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4400);
  }, []);

  const rememberDrafts = useCallback((next: MissionDraft[]) => {
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const scheduleSave = useCallback(
    (key: number | "student") => {
      const id = String(key);
      window.clearTimeout(timersRef.current[id]);
      timersRef.current[id] = window.setTimeout(() => {
        const db = dbRef.current;
        if (!db || !readyRef.current) return;
        const write =
          key === "student"
            ? persistStudent(db, studentRef.current)
            : persistEntry(db, key, draftsRef.current[key]);
        write.catch(() => {
          showToast(
            key === "student"
              ? "Could not save name"
              : "Could not save notes. Check storage permissions.",
          );
        });
      }, 300);
    },
    [showToast],
  );

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    openPhotoHuntDb()
      .then(async (db) => {
        if (cancelled) return;
        dbRef.current = db;
        const restored = await restoreProgress(db, MISSIONS.length);
        if (cancelled) return;
        rememberDrafts(restored.drafts);
        studentRef.current = restored.student;
        setStudent(restored.student);
        const urls = restored.photos.map((blob) => {
          if (!(blob instanceof Blob)) return null;
          const url = URL.createObjectURL(blob);
          created.push(url);
          return url;
        });
        urlsRef.current = urls;
        setPhotoUrls(urls);
        readyRef.current = true;
        setStorageStatus("✓ Photos and words saved locally on this phone");
      })
      .catch((error) => {
        console.error(error);
        if (cancelled) return;
        setStorageStatus("⚠ Storage unavailable: try opening in Chrome");
        showToast("Local saving unavailable. Open the app in Chrome, not an in-app preview.");
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      for (const url of created) URL.revokeObjectURL(url);
      for (const url of urlsRef.current) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [rememberDrafts, showToast]);

  useEffect(() => {
    const flush = () => {
      const db = dbRef.current;
      if (!db || !readyRef.current) return;
      for (const id of Object.values(timersRef.current)) window.clearTimeout(id);
      timersRef.current = {};
      void persistStudent(db, studentRef.current);
      draftsRef.current.forEach((draft, index) => {
        void persistEntry(db, index, draft);
      });
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  useEffect(() => {
    if (location.protocol !== "https:" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/photo-treasure-hunt/sw.js", { scope: "/photo-treasure-hunt" })
        .catch(() =>
          navigator.serviceWorker.register("/photo-treasure-hunt/sw.js").catch((error) => {
            console.warn(error);
          }),
        );
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  function askPersistentStorage() {
    void navigator.storage?.persist?.().catch(() => undefined);
  }

  function replacePhoto(index: number, blob: Blob | null) {
    const previous = urlsRef.current[index];
    if (previous) URL.revokeObjectURL(previous);
    const nextUrls = urlsRef.current.slice();
    nextUrls[index] = blob ? URL.createObjectURL(blob) : null;
    urlsRef.current = nextUrls;
    setPhotoUrls(nextUrls);
    const nextDrafts = draftsRef.current.slice();
    nextDrafts[index] = { ...nextDrafts[index], hasPhoto: Boolean(blob) };
    rememberDrafts(nextDrafts);
  }

  async function onPhotoPicked(index: number, file: File | undefined, input: HTMLInputElement) {
    if (!file) return;
    const db = dbRef.current;
    if (!db) {
      showToast("Photo not saved. Try taking a lower-resolution photo or freeing phone storage.");
      input.value = "";
      return;
    }
    setBusyPhoto(index);
    showToast("Preparing a smaller photo…");
    try {
      const blob = await compressImageFile(file);
      await db.put("photos", photoKey(index), blob);
      replacePhoto(index, blob);
      await persistEntry(db, index, draftsRef.current[index]);
      showToast(`Photo saved on this phone (${Math.round(blob.size / 1024)} KB)`);
    } catch (error) {
      console.error(error);
      showToast("Photo not saved. Try taking a lower-resolution photo or freeing phone storage.");
    } finally {
      setBusyPhoto(null);
      input.value = "";
    }
  }

  async function removePhoto(index: number) {
    const db = dbRef.current;
    if (!db) {
      showToast("Could not remove photo: storage unavailable");
      return;
    }
    try {
      await db.delete("photos", photoKey(index));
      replacePhoto(index, null);
      await persistEntry(db, index, draftsRef.current[index]);
      showToast("Photo removed");
    } catch {
      showToast("Could not remove photo: storage unavailable");
    }
  }

  async function flushPending() {
    const db = dbRef.current;
    if (!db || !readyRef.current) return;
    for (const id of Object.values(timersRef.current)) window.clearTimeout(id);
    timersRef.current = {};
    await persistStudent(db, studentRef.current);
    await Promise.all(draftsRef.current.map((draft, index) => persistEntry(db, index, draft)));
  }

  async function shareNotes() {
    await flushPending().catch(() => undefined);
    const content = buildShareText(studentRef.current, draftsRef.current);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Rita's Photo Hunt", text: content });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        showToast("Report text copied");
      } else {
        showToast("Sharing unavailable");
      }
    } catch (error) {
      if (errorName(error) !== "AbortError") showToast("Could not share this time");
    }
  }

  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      await flushPending();
      const db = dbRef.current;
      const sections = [];
      for (let index = 0; index < MISSIONS.length; index++) {
        const entry = draftsRef.current[index];
        if (!entry.hasPhoto && !entry.word.trim() && !entry.sentence.trim()) continue;
        let photo: Uint8Array | null = null;
        let photoType: ReportPhotoType | null = null;
        if (entry.hasPhoto && db) {
          const stored = await db.get("photos", photoKey(index));
          if (stored instanceof Blob) {
            photo = new Uint8Array(await stored.arrayBuffer());
            photoType = stored.type.includes("png") ? "png" : "jpeg";
          }
        }
        sections.push({
          index: index + 1,
          title: MISSIONS[index].title,
          word: entry.word.trim(),
          sentence: entry.sentence.trim(),
          photo,
          photoType,
        });
      }
      const { buildPhotoReportPdf } = await import("@/lib/photo-treasure-hunt/pdf");
      const bytes = await buildPhotoReportPdf({
        studentName: studentRef.current,
        completed: countCompleted(draftsRef.current),
        total: MISSIONS.length,
        sections,
      });
      downloadPdf(bytes, photoReportFilename(studentRef.current));
      showToast("PDF diary downloaded on this phone");
    } catch (error) {
      console.error(error);
      showToast("Could not make the report. Check that local storage is available.");
    } finally {
      setExporting(false);
    }
  }

  const completed = countCompleted(drafts);

  return (
    <div className="rita-hunt" lang="en-AU">
      <main>
        <p className="back-row">
          <Link href="/" className="back-link">
            ← LR Mastery
          </Link>
        </p>
        <div className="header">
          <div className="sticker" aria-hidden="true">
            📸 🌷 ✨
          </div>
          <div className="eyebrow">A little English adventure • Melbourne</div>
          <h1>
            Rita’s Photo
            <br />
            Treasure Hunt!
          </h1>
          <p className="muted">Little discoveries, lovely photos &amp; new English words.</p>
          <div className="mini-tag">♡ 15 mini missions just for you</div>
        </div>

        <div className="summary">
          <div className="summary-top">
            <div>
              <div className="eyebrow">Your progress</div>
              <div className="count">
                {completed} / {MISSIONS.length} missions
              </div>
            </div>
            <div className="storage-note">{storageStatus}</div>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(100 * completed) / MISSIONS.length}%` }} />
          </div>
        </div>

        <div className="field student-wrap">
          <label htmlFor="student">🌼 Your name (for your photo diary)</label>
          <input
            type="text"
            id="student"
            placeholder="Rita"
            value={student}
            onChange={(event) => {
              studentRef.current = event.target.value;
              setStudent(event.target.value);
              scheduleSave("student");
            }}
          />
        </div>

        <div className="info">
          Tap a mission to discover its challenge. Use <strong>Take photo</strong> to open your
          Android camera, or choose an existing picture. Add a new word and one sentence. A mission
          is complete when it has a photo, a word and a sentence. You can do them in any order.
          Photos are compressed to save phone memory. Open this app at the same website address each
          time, and do not clear Chrome site data. Add it to your home screen for easy access. Tap{" "}
          <strong>Make my PDF diary</strong> to download a PDF onto this phone. Nothing is uploaded.
        </div>

        <div className="section-heading">
          Your little missions <span>Explore at your own pace ♡</span>
        </div>

        <div className="tasks">
          {MISSIONS.map((mission, index) => {
            const draft = drafts[index];
            const done = missionComplete(draft);
            const started = done || draft.hasPhoto || draft.word || draft.sentence;
            const isOpen = Boolean(open[index]);
            return (
              <section
                key={mission.title}
                className={`task${isOpen ? " open" : ""}${done ? " completed" : ""}`}
                id={`task${index}`}
              >
                <button
                  type="button"
                  className="task-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((current) => ({ ...current, [index]: !current[index] }))}
                >
                  <div className="num" aria-hidden="true">
                    {mission.symbol}
                  </div>
                  <div>
                    <div className="task-title">{mission.title}</div>
                    <div className="task-desc">{mission.prompt}</div>
                    {started ? (
                      <div className="pill">{done ? "Complete" : "In progress"}</div>
                    ) : null}
                  </div>
                  <div className={isOpen ? "expander" : "expander"} aria-hidden="true">
                    ⌄
                  </div>
                </button>
                <div className="task-body">
                  <div className="location">📍 Try looking here: {mission.where}</div>
                  <div className="camera-row">
                    <button
                      type="button"
                      className="btn"
                      disabled={busyPhoto === index}
                      onClick={() => {
                        askPersistentStorage();
                        cameraRefs.current[index]?.click();
                      }}
                    >
                      📸 Take photo
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busyPhoto === index}
                      onClick={() => {
                        askPersistentStorage();
                        galleryRefs.current[index]?.click();
                      }}
                    >
                      ♡ Choose photo
                    </button>
                    <input
                      ref={(node) => {
                        cameraRefs.current[index] = node;
                      }}
                      className="file"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      aria-label={`Take photo for ${mission.title}`}
                      onChange={(event) => {
                        void onPhotoPicked(index, event.target.files?.[0], event.target);
                      }}
                    />
                    <input
                      ref={(node) => {
                        galleryRefs.current[index] = node;
                      }}
                      className="file"
                      type="file"
                      accept="image/*"
                      aria-label={`Choose photo for ${mission.title}`}
                      onChange={(event) => {
                        void onPhotoPicked(index, event.target.files?.[0], event.target);
                      }}
                    />
                  </div>
                  {/* Blob preview from this device. Next's image optimizer cannot fetch it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={photoUrls[index] ? "preview has" : "preview"}
                    alt={`Photo for ${mission.title}`}
                    src={photoUrls[index] ?? undefined}
                  />
                  {draft.hasPhoto ? (
                    <button
                      type="button"
                      className="btn danger"
                      style={{ marginTop: 9 }}
                      onClick={() => void removePhoto(index)}
                    >
                      Remove photo
                    </button>
                  ) : null}
                  <div className="field">
                    <label htmlFor={`word${index}`}>✨ My new English word(s)</label>
                    <input
                      id={`word${index}`}
                      type="text"
                      placeholder="e.g. iridescent"
                      value={draft.word}
                      onChange={(event) => {
                        const next = draftsRef.current.slice();
                        next[index] = { ...next[index], word: event.target.value };
                        rememberDrafts(next);
                        scheduleSave(index);
                      }}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`sentence${index}`}>✍️ My English sentence</label>
                    <textarea
                      id={`sentence${index}`}
                      rows={3}
                      placeholder="Describe what you photographed and use a new word."
                      value={draft.sentence}
                      onChange={(event) => {
                        const next = draftsRef.current.slice();
                        next[index] = { ...next[index], sentence: event.target.value };
                        rememberDrafts(next);
                        scheduleSave(index);
                      }}
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="info">
          <strong>🌟 Your final challenge:</strong> Choose your favourite five pictures and explain
          them to your teacher. Which was most surprising? Which new word will you remember?
        </div>
      </main>

      <div className="footer-actions">
        <button type="button" className="btn secondary" onClick={() => void shareNotes()}>
          Share notes
        </button>
        <button type="button" className="btn" onClick={() => void exportPdf()} disabled={exporting}>
          {exporting ? "Preparing photo report…" : "Make my PDF diary"}
        </button>
      </div>

      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
