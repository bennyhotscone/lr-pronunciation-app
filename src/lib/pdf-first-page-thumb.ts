type PdfjsModule = typeof import("pdfjs-dist");
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
let active = 0;
const waiters: Array<() => void> = [];
const MAX_CONCURRENT = 2;
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r));
  active += 1;
  try { return await fn(); } finally { active -= 1; waiters.shift()?.(); }
}
async function loadPdfjs(): Promise<PdfjsModule> {
  const pdfjs: PdfjsModule = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}
async function renderFirstPage(sourceUrl: string): Promise<string | null> {
  const pdfjs = await loadPdfjs();
  const res = await fetch(sourceUrl, { credentials: "include" });
  if (!res.ok) return null;
  const data = new Uint8Array(await res.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.28 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally { void pdf.destroy(); }
}
export function getPdfFirstPageThumb(sourceUrl: string): Promise<string | null> {
  if (!sourceUrl) return Promise.resolve(null);
  const hit = cache.get(sourceUrl); if (hit) return Promise.resolve(hit);
  const pending = inflight.get(sourceUrl); if (pending) return pending;
  const job = withSlot(async () => {
    try {
      const thumb = await renderFirstPage(sourceUrl);
      if (thumb) cache.set(sourceUrl, thumb);
      return thumb;
    } catch { return null; }
    finally { inflight.delete(sourceUrl); }
  });
  inflight.set(sourceUrl, job);
  return job;
}