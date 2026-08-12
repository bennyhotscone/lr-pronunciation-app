"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { allowsPdfWriteMode, materialKindLabel } from "@/lib/material-kind";
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

type OverlayDom = {
  wrap: HTMLDivElement;
  ta: HTMLTextAreaElement;
  del: HTMLButtonElement;
  handle: HTMLDivElement;
};

const DEFAULT_FONT = 14;
const MIN_FONT = 10;
const MAX_FONT = 36;

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
  const writeAllowed = allowsPdfWriteMode(materialKind);
  const containerRef = useRef<HTMLDivElement>(null);
  const writeDataRef = useRef<PdfWriteData>(emptyPdfWriteData());
  const pageMetaRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const overlayDomRef = useRef<Map<string, OverlayDom>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    id: string;
    kind: "move" | "resize";
    startX: number;
    startY: number;
    orig: OverlayBox;
  } | null>(null);

  const [mode, setMode] = useState<Mode>(
    writeAllowed && initialMode === "write" ? "write" : "read",
  );
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("Loading PDF…");
  const [pageCount, setPageCount] = useState(0);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [writeData, setWriteData] = useState<PdfWriteData>(emptyPdfWriteData());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lang = targetLang;
  const hasSelectableTextRef = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  writeDataRef.current = writeData;

  const modeRef = useRef(mode);
  const selectedIdRef = useRef(selectedId);
  modeRef.current = mode;
  selectedIdRef.current = selectedId;

  const scheduleSave = useCallback(
    (next: PdfWriteData) => {
      if (!writeAllowed) return;
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
    [resourceId, writeAllowed],
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

  // Load draft once (Exercises/Activities only)
  useEffect(() => {
    if (!writeAllowed) return;
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
  }, [resourceId, writeAllowed]);

  // Render PDF pages
  useEffect(() => {
    let cancelled = false;
    let pdfDoc: { destroy: () => Promise<void> } | null = null;

    async function run() {
      setStatus("loading");
      setMessage("Loading PDF…");
      overlayDomRef.current.clear();
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

          // Text layer (tap → translate). Must sit above the canvas and receive
          // pointer events; write overlay host is pointer-events:none so it does
          // not swallow taps in read or write mode.
          const textContent = await page.getTextContent();
          const textLayer = document.createElement("div");
          textLayer.className = "pdf-text-layer absolute inset-0 overflow-hidden";
          textLayer.style.width = `${viewport.width}px`;
          textLayer.style.height = `${viewport.height}px`;
          textLayer.style.zIndex = "2";
          textLayer.style.pointerEvents = "auto";

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
            span.style.pointerEvents = "auto";

            for (const tok of splitIntoTappableTokens(str)) {
              if (!tok.tappable) {
                span.appendChild(document.createTextNode(tok.text));
                continue;
              }
              const btn = document.createElement("button");
              btn.type = "button";
              btn.textContent = tok.text;
              btn.className = "pdf-tap-word";
              btn.setAttribute("aria-label", `Translate ${tok.text}`);
              btn.style.cssText =
                "padding:0;margin:0;border:0;background:transparent;color:transparent;cursor:pointer;font:inherit;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;";

              // Dedupe click vs touchend (mobile often fires both).
              let lastActivate = 0;
              const activateWord = (clientX: number, clientY: number) => {
                const now = Date.now();
                if (now - lastActivate < 450) return;
                lastActivate = now;
                setSelectedId(null);
                void lookup(tok.text, clientX, clientY);
              };

              btn.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                activateWord(ev.clientX, ev.clientY);
              });
              btn.addEventListener(
                "touchend",
                (ev) => {
                  // Prevent delayed ghost click; still activate from the touch.
                  ev.preventDefault();
                  ev.stopPropagation();
                  const t = ev.changedTouches[0];
                  if (t) activateWord(t.clientX, t.clientY);
                },
                { passive: false },
              );
              span.appendChild(btn);
            }
            textLayer.appendChild(span);
          }
          pageWrap.appendChild(textLayer);

          // Overlay host for text boxes (synced via effect below).
          // pointer-events:none so empty host never blocks text-layer word taps;
          // each .pdf-overlay-box re-enables pointer-events for writing.
          const overlayHost = document.createElement("div");
          overlayHost.className = "pdf-overlay-host absolute inset-0";
          overlayHost.dataset.page = String(pageNum);
          overlayHost.style.zIndex = "4";
          overlayHost.style.pointerEvents = "none";
          pageWrap.appendChild(overlayHost);

          // Write mode: tap empty space → new transparent text box
          // Read/empty: if no selectable text, toast on tap
          pageWrap.addEventListener("click", (ev) => {
            const t = ev.target as HTMLElement;
            if (t.closest(".pdf-tap-word")) return;

            if (!hasSelectableTextRef.current) {
              showToast("This PDF has no selectable text");
              return;
            }

            if (modeRef.current !== "write") return;
            if (t.closest(".pdf-overlay-box, textarea, a")) {
              ev.stopPropagation();
              return;
            }
            // Ignore other chrome buttons; word buttons already returned above.
            if (t.closest("button") && !t.closest(".pdf-overlay-box")) {
              return;
            }
            ev.stopPropagation();
            setPopup(null);
            const rect = pageWrap.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width;
            const y = (ev.clientY - rect.top) / rect.height;
            const id = newOverlayId();
            const box: OverlayBox = {
              id,
              page: pageNum,
              x: Math.min(0.72, Math.max(0, x)),
              y: Math.min(0.92, Math.max(0, y)),
              w: 0.26,
              h: 0.055,
              text: "",
              fontSize: DEFAULT_FONT,
            };
            updateWriteData((prev) => ({
              ...prev,
              overlays: [...prev.overlays, box],
            }));
            setSelectedId(id);
            requestAnimationFrame(() => {
              const dom = overlayDomRef.current.get(id);
              dom?.ta.focus();
            });
          });

          host.appendChild(pageWrap);
        }

        if (cancelled) return;
        hasSelectableTextRef.current = totalChars >= 24;
        if (totalChars < 24) {
          setStatus("empty");
          setMessage(
            "This PDF has no selectable text. Tap-translate needs a text PDF (not a scan). In Write mode you can still tap empty space to type.",
          );
          showToast("This PDF has no selectable text");
        } else {
          setStatus("ready");
          setMessage(
            modeRef.current === "write"
              ? "Tap empty space to type · tap a word to translate · tap a box to move, resize, edit, or delete."
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
      overlayDomRef.current.clear();
      void pdfDoc?.destroy();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // Re-render PDF only when resource changes — mode/write overlays synced separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, lookup, updateWriteData, showToast]);

  // Pointer move/up for drag + resize (document-level)
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const meta = pageMetaRef.current.get(drag.orig.page);
      if (!meta) return;
      const dx = (ev.clientX - drag.startX) / meta.width;
      const dy = (ev.clientY - drag.startY) / meta.height;
      if (drag.kind === "move") {
        const x = Math.min(1 - drag.orig.w, Math.max(0, drag.orig.x + dx));
        const y = Math.min(1 - drag.orig.h, Math.max(0, drag.orig.y + dy));
        updateWriteData((prev) => ({
          ...prev,
          overlays: prev.overlays.map((o) =>
            o.id === drag.id ? { ...o, x, y } : o,
          ),
        }));
      } else {
        const w = Math.min(1 - drag.orig.x, Math.max(0.08, drag.orig.w + dx));
        const h = Math.min(1 - drag.orig.y, Math.max(0.035, drag.orig.h + dy));
        updateWriteData((prev) => ({
          ...prev,
          overlays: prev.overlays.map((o) =>
            o.id === drag.id ? { ...o, w, h } : o,
          ),
        }));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [updateWriteData]);

  // Sync write-mode overlay DOM (create/update/remove without wiping focused text)
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const live = overlayDomRef.current;
    const wanted = new Set(
      mode === "write" ? writeData.overlays.map((o) => o.id) : [],
    );

    // Remove deleted / leave write mode
    for (const [id, dom] of live) {
      if (!wanted.has(id)) {
        dom.wrap.remove();
        live.delete(id);
      }
    }

    if (mode !== "write") return;

    host.querySelectorAll<HTMLElement>(".pdf-overlay-host").forEach((layer) => {
      const page = Number(layer.dataset.page || "1");
      const meta = pageMetaRef.current.get(page);
      if (!meta) return;
      // Keep host click-through so PDF word taps work under write boxes.
      layer.style.pointerEvents = "none";

      for (const box of writeData.overlays.filter((o) => o.page === page)) {
        let dom = live.get(box.id);
        if (!dom) {
          const wrap = document.createElement("div");
          wrap.className = "pdf-overlay-box absolute";
          wrap.dataset.overlayId = box.id;
          wrap.style.zIndex = "6";
          wrap.style.boxSizing = "border-box";
          wrap.style.pointerEvents = "auto";

          const ta = document.createElement("textarea");
          ta.value = box.text;
          ta.placeholder = "Type…";
          ta.spellcheck = true;
          ta.style.cssText =
            "display:block;width:100%;height:100%;margin:0;padding:2px 4px;border:0;outline:none;resize:none;background:transparent;color:#1a1a1a;font-family:inherit;line-height:1.25;overflow:auto;";

          const del = document.createElement("button");
          del.type = "button";
          del.textContent = "×";
          del.title = "Delete text box";
          del.style.cssText =
            "position:absolute;right:-8px;top:-8px;width:20px;height:20px;border:0;border-radius:999px;background:#1a1a1a;color:#fff;font-size:12px;line-height:1;cursor:pointer;display:none;z-index:2;";

          const handle = document.createElement("div");
          handle.title = "Drag to move · corner to resize";
          handle.style.cssText =
            "position:absolute;right:0;bottom:0;width:12px;height:12px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#0d5c4d 50%);display:none;z-index:2;";

          wrap.appendChild(ta);
          wrap.appendChild(del);
          wrap.appendChild(handle);
          layer.appendChild(wrap);

          wrap.addEventListener("click", (e) => {
            e.stopPropagation();
            setPopup(null);
            setSelectedId(box.id);
          });

          ta.addEventListener("click", (e) => {
            e.stopPropagation();
            setPopup(null);
            setSelectedId(box.id);
          });
          ta.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            setSelectedId(box.id);
          });
          ta.addEventListener("focus", () => setSelectedId(box.id));
          ta.addEventListener("input", () => {
            const id = box.id;
            const text = ta.value;
            updateWriteData((prev) => ({
              ...prev,
              overlays: prev.overlays.map((o) => (o.id === id ? { ...o, text } : o)),
            }));
          });

          wrap.addEventListener("pointerdown", (e) => {
            if (e.target === ta || e.target === del || e.target === handle) return;
            e.preventDefault();
            e.stopPropagation();
            setPopup(null);
            setSelectedId(box.id);
            const current =
              writeDataRef.current.overlays.find((o) => o.id === box.id) || box;
            dragRef.current = {
              id: box.id,
              kind: "move",
              startX: e.clientX,
              startY: e.clientY,
              orig: { ...current },
            };
          });

          handle.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedId(box.id);
            const current =
              writeDataRef.current.overlays.find((o) => o.id === box.id) || box;
            dragRef.current = {
              id: box.id,
              kind: "resize",
              startX: e.clientX,
              startY: e.clientY,
              orig: { ...current },
            };
          });

          del.addEventListener("click", (e) => {
            e.stopPropagation();
            updateWriteData((prev) => ({
              ...prev,
              overlays: prev.overlays.filter((o) => o.id !== box.id),
            }));
            setSelectedId((cur) => (cur === box.id ? null : cur));
          });

          dom = { wrap, ta, del, handle };
          live.set(box.id, dom);
        }

        const selected = selectedId === box.id;
        dom.wrap.style.left = `${box.x * meta.width}px`;
        dom.wrap.style.top = `${box.y * meta.height}px`;
        dom.wrap.style.width = `${box.w * meta.width}px`;
        dom.wrap.style.height = `${box.h * meta.height}px`;
        dom.wrap.style.border = selected
          ? "1.5px solid #0d5c4d"
          : box.text.trim()
            ? "1px solid transparent"
            : "1px dashed rgba(13,92,77,0.35)";
        dom.wrap.style.background = selected
          ? "rgba(255,255,255,0.12)"
          : "transparent";
        dom.wrap.style.cursor = selected ? "move" : "text";
        dom.ta.style.fontSize = `${box.fontSize || DEFAULT_FONT}px`;
        dom.ta.style.pointerEvents = "auto";
        dom.del.style.display = selected ? "flex" : "none";
        dom.del.style.alignItems = "center";
        dom.del.style.justifyContent = "center";
        dom.handle.style.display = selected ? "block" : "none";

        if (document.activeElement !== dom.ta && dom.ta.value !== box.text) {
          dom.ta.value = box.text;
        }
      }
    });

    // Focus newly created empty selection
    if (selectedId) {
      const dom = live.get(selectedId);
      if (dom && !dom.ta.value && document.activeElement !== dom.ta) {
        // only auto-focus if nothing else focused in a box
        const activeIsBox =
          document.activeElement instanceof HTMLTextAreaElement &&
          document.activeElement.closest(".pdf-overlay-box");
        if (!activeIsBox) dom.ta.focus();
      }
    }
  }, [mode, writeData, selectedId, updateWriteData]);

  useEffect(() => {
    if (status !== "ready" && status !== "empty") return;
    if (!writeAllowed) {
      setMessage(
        "Tap a word for a free translation — it also goes on your Target vocabulary list.",
      );
      return;
    }
    setMessage(
      mode === "write"
        ? "Tap empty space to type · tap a PDF word to translate · select a box to drag, resize, change size, edit, or delete."
        : "Tap a word for a free translation — it also goes on your Target vocabulary list.",
    );
  }, [mode, status, writeAllowed]);

  const selectedBox = selectedId
    ? writeData.overlays.find((o) => o.id === selectedId)
    : null;

  const bumpFont = (delta: number) => {
    if (!selectedId) return;
    updateWriteData((prev) => ({
      ...prev,
      overlays: prev.overlays.map((o) =>
        o.id === selectedId
          ? {
              ...o,
              fontSize: Math.min(
                MAX_FONT,
                Math.max(MIN_FONT, (o.fontSize || DEFAULT_FONT) + delta),
              ),
            }
          : o,
      ),
    }));
  };

  const submitHomework = () => {
    setSubmitMsg(null);
    startTransition(async () => {
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
            {materialKind ? ` · ${materialKindLabel(materialKind)}` : ""}
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
        {writeAllowed ? (
          <div className="inline-flex rounded-lg border border-wood/30 bg-paper p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode("read");
                setSelectedId(null);
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
        ) : (
          <p className="rounded-md bg-paper px-3 py-1.5 text-xs font-semibold text-ink/55 ring-1 ring-wood/25">
            Read only · tap words to translate
          </p>
        )}

        {mode === "write" && writeAllowed ? (
          <>
            {selectedBox ? (
              <div className="inline-flex items-center gap-1 rounded-lg border border-wood/30 bg-white px-1.5 py-0.5">
                <button
                  type="button"
                  title="Smaller text"
                  onClick={() => bumpFont(-2)}
                  className="rounded px-2 py-1 text-xs font-bold text-ink hover:bg-paper"
                >
                  A−
                </button>
                <span className="min-w-[2rem] text-center text-[0.7rem] text-ink/50">
                  {selectedBox.fontSize || DEFAULT_FONT}
                </span>
                <button
                  type="button"
                  title="Larger text"
                  onClick={() => bumpFont(2)}
                  className="rounded px-2 py-1 text-xs font-bold text-ink hover:bg-paper"
                >
                  A+
                </button>
                <button
                  type="button"
                  title="Delete text box"
                  onClick={() => {
                    const id = selectedBox.id;
                    updateWriteData((prev) => ({
                      ...prev,
                      overlays: prev.overlays.filter((o) => o.id !== id),
                    }));
                    setSelectedId(null);
                  }}
                  className="ml-1 rounded px-2 py-1 text-xs font-bold text-danger hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            ) : (
              <span className="text-xs text-ink/45">Tap the page to start writing</span>
            )}
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
        className="pdf-read-host overflow-x-auto"
        onClick={() => {
          setPopup(null);
          if (mode === "write") setSelectedId(null);
        }}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-xl border border-wood/30 bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}

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
