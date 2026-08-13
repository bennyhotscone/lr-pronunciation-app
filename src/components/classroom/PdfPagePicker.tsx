"use client";

import { useEffect, useId, useState } from "react";

type PdfjsModule = typeof import("pdfjs-dist");

export type PdfPageSelection = {
  /** 1-indexed page numbers to include */
  pages: number[];
  pageCount: number;
};

type Props = {
  file: File | null;
  /** Form field name for JSON page array (or "all"). */
  name?: string;
  onChange?: (selection: PdfPageSelection | null) => void;
  className?: string;
};

/**
 * Teacher PDF page picker: select all, toggle pages, deselect last N (answer keys).
 * Renders optional page thumbnails via pdf.js when practical.
 */
export function PdfPagePicker({
  file,
  name = "selectedPages",
  onChange,
  className = "",
}: Props) {
  const uid = useId();
  const [pageCount, setPageCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [deselectLastN, setDeselectLastN] = useState(1);

  useEffect(() => {
    if (!file) {
      setPageCount(0);
      setSelected(new Set());
      setThumbs({});
      setError(null);
      onChange?.(null);
      return;
    }

    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);

    async function load() {
      setLoading(true);
      setError(null);
      setThumbs({});
      try {
        const pdfjs: PdfjsModule = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({ url: objectUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const count = pdf.numPages;
        const all = new Set(Array.from({ length: count }, (_, i) => i + 1));
        setPageCount(count);
        setSelected(all);
        onChange?.({ pages: [...all], pageCount: count });

        if (count <= 40) {
          const next: Record<number, string> = {};
          for (let p = 1; p <= count; p++) {
            if (cancelled) return;
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 0.25 });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvasContext: ctx, viewport }).promise;
            next[p] = canvas.toDataURL("image/jpeg", 0.7);
          }
          if (!cancelled) setThumbs(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not read PDF pages.",
          );
          setPageCount(0);
          setSelected(new Set());
          onChange?.(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function emit(next: Set<number>, count: number) {
    onChange?.({ pages: [...next].sort((a, b) => a - b), pageCount: count });
  }

  function selectAll() {
    const all = new Set(Array.from({ length: pageCount }, (_, i) => i + 1));
    setSelected(all);
    emit(all, pageCount);
  }

  function clearAll() {
    const empty = new Set<number>();
    setSelected(empty);
    emit(empty, pageCount);
  }

  function toggle(page: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      emit(next, pageCount);
      return next;
    });
  }

  function deselectLastPages() {
    const n = Math.max(1, Math.min(pageCount, Math.floor(deselectLastN) || 1));
    setSelected((prev) => {
      const next = new Set(prev);
      for (let p = pageCount - n + 1; p <= pageCount; p++) {
        if (p >= 1) next.delete(p);
      }
      emit(next, pageCount);
      return next;
    });
  }

  if (!file) return null;

  const selectedCount = selected.size;
  const fieldValue =
    pageCount > 0 && selectedCount === pageCount
      ? "all"
      : JSON.stringify([...selected].sort((a, b) => a - b));

  return (
    <div
      className={`rounded-xl border border-border bg-background/60 p-3 ${className}`}
      role="group"
      aria-label="PDF pages to upload"
    >
      <input type="hidden" name={name} value={fieldValue} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Pages for students
        </p>
        {pageCount > 0 ? (
          <p className="text-xs text-muted">
            {selectedCount} of {pageCount} selected
            {selectedCount < pageCount ? " · answer-key pages excluded" : ""}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">
        Uncheck answer-key pages. Only selected pages are published — students
        never get the full original if you trim.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Reading PDF pages…</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {pageCount > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={selectAll}
              className="underline-offset-2 hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="underline-offset-2 hover:underline"
            >
              Clear
            </button>
            <span className="text-muted">·</span>
            <label className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              Deselect last
              <input
                type="number"
                min={1}
                max={pageCount}
                value={deselectLastN}
                onChange={(e) => setDeselectLastN(Number(e.target.value) || 1)}
                className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                aria-label="Number of last pages to deselect"
              />
              pages
            </label>
            <button
              type="button"
              onClick={deselectLastPages}
              className="rounded bg-[#1f4e46]/10 px-2 py-1 text-[#1f4e46] ring-1 ring-[#1f4e46]/30 hover:bg-[#1f4e46]/15"
            >
              Apply
            </button>
          </div>

          <ul className="mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => {
              const id = `${uid}-page-${page}`;
              const checked = selected.has(page);
              const thumb = thumbs[page];
              return (
                <li key={page}>
                  <label
                    htmlFor={id}
                    className={`flex cursor-pointer flex-col overflow-hidden rounded-lg border text-center transition ${
                      checked
                        ? "border-desk-accent bg-desk-accent/10 ring-1 ring-desk-accent/40"
                        : "border-border bg-background opacity-60 hover:opacity-100"
                    }`}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="aspect-[3/4] w-full object-cover object-top"
                      />
                    ) : (
                      <span className="flex aspect-[3/4] items-center justify-center bg-[#f3f2ee] text-lg font-bold text-muted">
                        {page}
                      </span>
                    )}
                    <span className="flex items-center justify-center gap-1.5 px-1 py-1.5 text-xs font-bold">
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(page)}
                        className="h-3.5 w-3.5"
                      />
                      p.{page}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
