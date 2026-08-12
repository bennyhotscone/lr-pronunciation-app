"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  emptyPdfWriteData,
  type OverlayBox,
  type PdfWriteData,
} from "@/lib/pdf-write-data";

type Mode = "read" | "write";

type PopupState = {
  word: string;
  x: number;
  y: number;
  loading?: boolean;
  translation?: string;
  definition?: string | null;
  error?: string;
  lookupCount?: number;
};

type PdfjsModule = typeof import("pdfjs-dist");

function splitIntoTappableTokens(text: string): { text: string; tappable: boolean }[] {
  const parts: { text: string; tappable: boolean }[] = [];
  const re = /[A-Za-z][A-Za-z']*[A-Za-z]|[A-Za-z]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), tappable: false });
    parts.push({ text: m[0], tappable: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), tappable: false });
  return parts.length ? parts : [{ text, tappable: false }];
}

function newOverlayId() {
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function PdfWorkspaceViewer({
  resourceId,
  title,
  targetLang,
  initialMode = "read",
  materialKind,
}: {
  resourceId: string;
  title: string;
  targetLang: string;
  initialMode?: Mode;
  materialKind?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writeDataRef = useRef<PdfWriteData>(emptyPdfWriteData());
  const pageMetaRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("Loading PDF…");
  const [pageCount, setPageCount] = useState(0);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [writeData, setWriteData] = useState<PdfWriteData>(emptyPdfWriteData());
  const [placeBox, setPlaceBox] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lang = targetLang;

  writeDataRef.current = writeData;

  const scheduleSave = useCallback(
    (next: PdfWriteData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/portal/resources/${resourceId}/write-draft`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: next }),
          });
          if (!res.ok) throw new Error("save failed");
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      }, 600);
    },
    [resourceId],
  );

  const updateWriteData = useCallback(
    (updater: (prev: PdfWriteData) => PdfWriteData) => {
      setWriteData((prev) => {
        const next = updater(prev);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const lookup = useCallback(
    async (word: string, clientX: number, clientY: number) => {
      setPopup({ word, x: clientX, y: clientY, loading: true });
      try {
        const res = await fetch("/api/portal/vocab/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word,
            targetLang: lang,
            sourceResourceId: resourceId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPopup({ word, x: clientX, y: clientY, error: data.error || "Lookup failed" });
          return;
        }
        setPopup({
          word,
          x: clientX,
          y: clientY,
          translation: data.translation,
          definition: data.definition,
          lookupCount: data.entry?.lookupCount,
        });
      } catch {
        setPopup({ word, x: clientX, y: clientY, error: "Network error — try again." });
      }
    },
    [lang, resourceId],
  );

  // Load draft once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/resources/${resourceId}/write-draft`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) {
          setWriteData(json.data as PdfWriteData);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  // Render PDF pages
  useEffect(() => {
    let cancelled = false;
    let pdfDoc: { destroy: () => Promise<void> } | null = null;

    async function run() {
      setStatus("loading");
      setMessage("Loading PDF…");
      try {
        const pdfjs: PdfjsModule = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({
          url: `/api/portal/resources/${resourceId}/download`,
          withCredentials: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        pdfDoc = pdf;
        setPageCount(pdf.numPages);

        const host = containerRef.current;
        if (!host) return;
        host.innerHTML = "";
        pageMetaRef.current.clear();

        let totalChars = 0;
        const scale = Math.min(1.35, Math.max(1, (host.clientWidth || 720) / 612));

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          pageMetaRef.current.set(pageNum, {
            width: viewport.width,
            height: viewport.height,
          });

          const pageWrap = document.createElement("div");
          pageWrap.className =
            "pdf-page relative mx-auto mb-4 overflow-hidden rounded-lg border border-wood/25 bg-white shadow-sm";
          pageWrap.dataset.page = String(pageNum);
          pageWrap.style.width = `${viewport.width}px`;

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block h-auto w-full";
          pageWrap.appendChild(canvas);

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          // Text layer (tap → translate)
          const textContent = await page.getTextContent();
          const textLayer = document.createElement("div");
          textLayer.className = "pdf-text-layer absolute inset-0 overflow-hidden";
          textLayer.style.width = `${viewport.width}px`;
          textLayer.style.height = `${viewport.height}px`;

          for (const item of textContent.items) {
            if (!("str" in item) || !item.str) continue;
            const str = String(item.str);
            totalChars += str.replace(/\s/g, "").length;
            const tx = pdfjs.Util.transform(viewport.transform, item.transform);
            const fontHeight = Math.hypot(tx[2], tx[3]);
            const left = tx[4];
            const top = tx[5] - fontHeight;

            const span = document.createElement("span");
            span.style.position = "absolute";
            span.style.left = `${left}px`;
            span.style.top = `${top}px`;
            span.style.fontSize = `${Math.max(8, fontHeight)}px`;
            span.style.lineHeight = "1";
            span.style.whiteSpace = "pre";
            span.style.color = "transparent";
            span.style.transformOrigin = "0% 0%";

            for (const tok of splitIntoTappableTokens(str)) {
              if (!tok.tappable) {
                span.appendChild(document.createTextNode(tok.text));
                continue;
              }
              const btn = document.createElement("button");
              btn.type = "button";
              btn.textContent = tok.text;
              btn.className = "pdf-tap-word";
              btn.style.cssText =
                "padding:0;margin:0;border:0;background:transparent;color:transparent;cursor:pointer;font:inherit;";
              btn.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                void lookup(tok.text, ev.clientX, ev.clientY);
              });
              span.appendChild(btn);
            }
            textLayer.appendChild(span);
          }
          pageWrap.appendChild(textLayer);

          // AcroForm widgets (write mode fills these via React overlay list too —
          // also paint HTML inputs for Widget/Tx annotations)
          const annotations = await page.getAnnotations();
          const formLayer = document.createElement("div");
          formLayer.className = "pdf-form-layer absolute inset-0";
          formLayer.style.width = `${viewport.width}px`;
          formLayer.style.height = `${viewport.height}px`;
          formLayer.dataset.page = String(pageNum);

          for (const ann of annotations) {
            if (ann.subtype !== "Widget") continue;
            const fieldType = String(ann.fieldType || "");
            if (fieldType !== "Tx" && fieldType !== "Ch") continue;
            const fieldName = String(ann.fieldName || ann.id || "");
            if (!fieldName) continue;
            const rect = ann.rect as number[] | undefined;
            if (!rect || rect.length < 4) continue;
            let viewRect: number[];
            try {
              viewRect = viewport.convertToViewportRectangle(rect);
            } catch {
              continue;
            }
            const left = Math.min(viewRect[0], viewRect[2]);
            const top = Math.min(viewRect[1], viewRect[3]);
            const width = Math.abs(viewRect[2] - viewRect[0]);
            const height = Math.abs(viewRect[3] - viewRect[1]);

            const input = document.createElement("textarea");
            input.className = "pdf-acro-field";
            input.dataset.field = fieldName;
            input.rows = height > 40 ? 3 : 1;
            input.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${Math.max(24, width)}px;height:${Math.max(18, height)}px;font-size:12px;padding:2px 4px;border:1px solid #0d5c4d;border-radius:3px;background:rgba(255,255,255,0.92);resize:none;display:none;z-index:5;`;
            input.value = writeDataRef.current.fields[fieldName] || String(ann.fieldValue || "");
            input.addEventListener("click", (e) => e.stopPropagation());
            input.addEventListener("pointerdown", (e) => e.stopPropagation());
            input.addEventListener("input", () => {
              const name = fieldName;
              const val = input.value;
              updateWriteData((prev) => ({
                ...prev,
                fields: { ...prev.fields, [name]: val },
              }));
            });
            formLayer.appendChild(input);
          }
          pageWrap.appendChild(formLayer);

          // Overlay host for answer boxes (React-synced via effect below)
          const overlayHost = document.createElement("div");
          overlayHost.className = "pdf-overlay-host absolute inset-0";
          overlayHost.dataset.page = String(pageNum);
          overlayHost.style.zIndex = "4";
          pageWrap.appendChild(overlayHost);

          // Click empty space to place box when placeBox mode on
          pageWrap.addEventListener("click", (ev) => {
            if (!placeBoxRef.current || modeRef.current !== "write") return;
            const t = ev.target as HTMLElement;
            if (t.closest(".pdf-tap-word, .pdf-acro-field, .pdf-overlay-box, textarea, button, a")) {
              return;
            }
            const rect = pageWrap.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width;
            const y = (ev.clientY - rect.top) / rect.height;
            const box: OverlayBox = {
              id: newOverlayId(),
              page: pageNum,
              x: Math.min(0.7, Math.max(0, x)),
              y: Math.min(0.9, Math.max(0, y)),
              w: 0.28,
              h: 0.06,
              text: "",
            };
            updateWriteData((prev) => ({
              ...prev,
              overlays: [...prev.overlays, box],
            }));
            setPlaceBox(false);
          });

          host.appendChild(pageWrap);
        }

        if (cancelled) return;
        if (totalChars < 24) {
          setStatus("empty");
          setMessage(
            "This looks like a scan-only PDF (little or no selectable text). Tap-translate needs a text PDF. You can still use Write mode answer boxes on the page.",
          );
        } else {
          setStatus("ready");
          setMessage(
            mode === "write"
              ? "Tap words to translate · focus a box to type · use “Add answer box” then click the page."
              : "Tap a word for a free translation — it also goes on your Target vocabulary list.",
          );
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setStatus("error");
          setMessage("Could not open this PDF.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
      void pdfDoc?.destroy();
    };
    // Re-render PDF only when resource changes — mode/write overlays synced separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, lookup, updateWriteData]);

  const placeBoxRef = useRef(placeBox);
  const modeRef = useRef(mode);
  placeBoxRef.current = placeBox;
  modeRef.current = mode;

  // Sync write-mode visibility + overlay DOM
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    host.querySelectorAll<HTMLTextAreaElement>(".pdf-acro-field").forEach((el) => {
      el.style.display = mode === "write" ? "block" : "none";
      const name = el.dataset.field;
      if (name && writeData.fields[name] != null && el.value !== writeData.fields[name]) {
        el.value = writeData.fields[name];
      }
    });

    host.querySelectorAll<HTMLElement>(".pdf-overlay-host").forEach((layer) => {
      const page = Number(layer.dataset.page || "1");
      const meta = pageMetaRef.current.get(page);
      layer.innerHTML = "";
      if (mode !== "write" || !meta) return;

      for (const box of writeData.overlays.filter((o) => o.page === page)) {
        const wrap = document.createElement("div");
        wrap.className = "pdf-overlay-box absolute";
        wrap.style.left = `${box.x * meta.width}px`;
        wrap.style.top = `${box.y * meta.height}px`;
        wrap.style.width = `${box.w * meta.width}px`;
        wrap.style.minHeight = `${box.h * meta.height}px`;
        wrap.style.zIndex = "6";

        const ta = document.createElement("textarea");
        ta.value = box.text;
        ta.placeholder = "Type answer…";
        ta.className =
          "h-full w-full rounded border border-desk-accent bg-white/95 p-1 text-xs text-ink shadow-sm";
        ta.style.minHeight = `${Math.max(28, box.h * meta.height)}px`;
        ta.addEventListener("click", (e) => e.stopPropagation());
        ta.addEventListener("pointerdown", (e) => e.stopPropagation());
        ta.addEventListener("input", () => {
          const id = box.id;
          const text = ta.value;
          updateWriteData((prev) => ({
            ...prev,
            overlays: prev.overlays.map((o) => (o.id === id ? { ...o, text } : o)),
          }));
        });

        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "×";
        del.title = "Remove box";
        del.className =
          "absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs text-white";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          updateWriteData((prev) => ({
            ...prev,
            overlays: prev.overlays.filter((o) => o.id !== box.id),
          }));
        });

        wrap.appendChild(ta);
        wrap.appendChild(del);
        layer.appendChild(wrap);
      }
    });
  }, [mode, writeData, updateWriteData]);

  useEffect(() => {
    if (status !== "ready" && status !== "empty") return;
    setMessage(
      mode === "write"
        ? "Rule: tap a PDF word = translate (Target vocab). Focus an answer box / form field = type. “Add answer box” then click empty space to place."
        : "Tap a word for a free translation — it also goes on your Target vocabulary list.",
    );
  }, [mode, status]);

  const submitHomework = () => {
    setSubmitMsg(null);
    startTransition(async () => {
      // flush pending save
      try {
        await fetch(`/api/portal/resources/${resourceId}/write-draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: writeDataRef.current }),
        });
      } catch {
        /* continue */
      }
      const res = await fetch(`/api/portal/resources/${resourceId}/write-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Worksheet: ${title}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error || "Submit failed");
        return;
      }
      setSubmitMsg("Submitted — your teacher can see this on the class / student page.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
            PDF workspace
            {materialKind ? ` · ${materialKind === "EXERCISE" ? "Exercise" : "Information"}` : ""}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            {title}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink/60">{message}</p>
        </div>
        <div className="text-right text-xs text-ink/50">
          <p>
            Target language: <strong className="text-ink">{lang}</strong>
          </p>
          {pageCount ? (
            <p className="mt-0.5">
              {pageCount} page{pageCount === 1 ? "" : "s"}
            </p>
          ) : null}
          <Link
            href="/portal/profile"
            className="mt-1 inline-block font-semibold text-desk-accent hover:underline"
          >
            Change language →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-wood/30 bg-paper p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode("read");
              setPlaceBox(false);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-bold ${
              mode === "read" ? "bg-desk-accent text-white" : "text-ink hover:bg-white"
            }`}
          >
            Read
          </button>
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`rounded-md px-3 py-1.5 text-xs font-bold ${
              mode === "write" ? "bg-desk-accent text-white" : "text-ink hover:bg-white"
            }`}
          >
            Write
          </button>
        </div>

        {mode === "write" ? (
          <>
            <button
              type="button"
              onClick={() => setPlaceBox((v) => !v)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ring-1 ${
                placeBox
                  ? "bg-[#1f4e46] text-white ring-[#1f4e46]"
                  : "bg-white text-ink ring-border"
              }`}
            >
              {placeBox ? "Click page to place…" : "Add answer box"}
            </button>
            <span className="text-xs text-ink/45">
              Draft{" "}
              {saveState === "saving"
                ? "saving…"
                : saveState === "saved"
                  ? "saved"
                  : saveState === "error"
                    ? "save failed"
                    : "ready"}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={submitHomework}
              className="btn-primary rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Submit as homework"}
            </button>
          </>
        ) : null}

        <a
          href={`/api/portal/resources/${resourceId}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-bold text-desk-accent hover:underline"
        >
          Download PDF
        </a>
      </div>

      {submitMsg ? (
        <p className="rounded-lg border border-desk-accent/30 bg-desk-accent/5 px-3 py-2 text-sm text-ink">
          {submitMsg}
        </p>
      ) : null}

      {status === "loading" ? (
        <p className="rounded-xl border border-dashed border-wood/30 bg-paper/70 px-4 py-8 text-center text-sm text-ink/55">
          Preparing pages…
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-4 text-sm text-ink">
          {message}
        </p>
      ) : null}

      {status === "empty" ? (
        <p className="rounded-xl border border-amber-700/30 bg-amber-50 px-4 py-4 text-sm text-ink">
          {message}
        </p>
      ) : null}

      <div
        ref={containerRef}
        className={`pdf-read-host overflow-x-auto ${placeBox ? "cursor-crosshair" : ""}`}
        onClick={() => setPopup(null)}
      />

      {popup ? (
        <div
          role="dialog"
          aria-label={`Translation for ${popup.word}`}
          className="fixed z-50 max-w-xs rounded-xl border border-wood/30 bg-white p-3 shadow-lg"
          style={{
            left: Math.min(
              typeof window !== "undefined" ? window.innerWidth - 280 : popup.x,
              Math.max(8, popup.x - 40),
            ),
            top: Math.min(
              typeof window !== "undefined" ? window.innerHeight - 160 : popup.y,
              popup.y + 12,
            ),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink">{popup.word}</p>
            <button
              type="button"
              className="text-xs font-bold text-muted hover:text-ink"
              onClick={() => setPopup(null)}
            >
              Close
            </button>
          </div>
          {popup.loading ? (
            <p className="mt-2 text-sm text-ink/55">Translating…</p>
          ) : popup.error ? (
            <p className="mt-2 text-sm text-danger">{popup.error}</p>
          ) : (
            <>
              <p className="mt-2 text-base text-ink">{popup.translation}</p>
              {popup.definition && popup.definition !== popup.translation ? (
                <p className="mt-1 text-xs text-ink/50">{popup.definition}</p>
              ) : null}
              <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wide text-desk-accent">
                Added to Target vocabulary
                {popup.lookupCount && popup.lookupCount > 1
                  ? ` · looked up ${popup.lookupCount}×`
                  : ""}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated alias — prefer PdfWorkspaceViewer */
export { PdfWorkspaceViewer as PdfReadViewer };
