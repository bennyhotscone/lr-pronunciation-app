export type OverlayBox = {
  id: string;
  page: number;
  /** 0-1 relative to page width/height (viewport-independent). */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** CSS px at the rendered page scale (Edge-like). Default 14. */
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** When true, auto-grow is disabled (user dragged the resize handle). */
  userSized?: boolean;
};

export type PdfWriteData = {
  /** Legacy AcroForm field values - kept for old drafts; new write UX ignores these. */
  fields: Record<string, string>;
  overlays: OverlayBox[];
};

export function emptyPdfWriteData(): PdfWriteData {
  return { fields: {}, overlays: [] };
}

const DEFAULT_FONT = 14;

/** Drop abandoned / legacy empty text boxes. */
export function stripEmptyOverlays(data: PdfWriteData): PdfWriteData {
  const overlays = data.overlays.filter((o) => o.text.trim());
  if (overlays.length === data.overlays.length) return data;
  return { ...data, overlays };
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
      const fontRaw = Number(o.fontSize);
      const text = typeof o.text === "string" ? o.text : "";
      if (!text.trim()) continue;
      const userSized = o.userSized === true;
      const rawW = Number(o.w);
      const rawH = Number(o.h);
      let w = Math.min(1, Math.max(0.03, Number.isFinite(rawW) ? rawW : 0.12));
      let h = Math.min(1, Math.max(0.008, Number.isFinite(rawH) ? rawH : 0.022));
      if (!userSized && h > 0.08) h = Math.min(h, 0.035);
      overlays.push({
        id: o.id,
        page: Number(o.page) || 1,
        x: clamp01(Number(o.x) || 0),
        y: clamp01(Number(o.y) || 0),
        w,
        h,
        text,
        fontSize: Number.isFinite(fontRaw)
          ? Math.min(48, Math.max(8, fontRaw))
          : DEFAULT_FONT,
        bold: o.bold === true,
        italic: o.italic === true,
        underline: o.underline === true,
        userSized,
      });
    }
  }
  return { fields, overlays };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
