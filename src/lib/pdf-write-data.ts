export type OverlayBox = {
  id: string;
  page: number;
  /** 0–1 relative to page width/height (viewport-independent). */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
};

export type PdfWriteData = {
  fields: Record<string, string>;
  overlays: OverlayBox[];
};

export function emptyPdfWriteData(): PdfWriteData {
  return { fields: {}, overlays: [] };
}

export function parsePdfWriteData(raw: unknown): PdfWriteData {
  if (!raw || typeof raw !== "object") return emptyPdfWriteData();
  const obj = raw as { fields?: unknown; overlays?: unknown };
  const fields: Record<string, string> = {};
  if (obj.fields && typeof obj.fields === "object") {
    for (const [k, v] of Object.entries(obj.fields as Record<string, unknown>)) {
      if (typeof v === "string") fields[k] = v;
    }
  }
  const overlays: OverlayBox[] = [];
  if (Array.isArray(obj.overlays)) {
    for (const item of obj.overlays) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string") continue;
      overlays.push({
        id: o.id,
        page: Number(o.page) || 1,
        x: clamp01(Number(o.x) || 0),
        y: clamp01(Number(o.y) || 0),
        w: Math.min(1, Math.max(0.05, Number(o.w) || 0.28)),
        h: Math.min(1, Math.max(0.03, Number(o.h) || 0.05)),
        text: typeof o.text === "string" ? o.text : "",
      });
    }
  }
  return { fields, overlays };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
