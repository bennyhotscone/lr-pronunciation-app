export type OverlayBox = {
  id: string;
  page: number;
  /** 0–1 relative to page width/height (viewport-independent). */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** CSS px at the rendered page scale (Edge-like). Default 14. */
  fontSize: number;
  /** CSS color for typed text. Default #1a1a1a. */
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** When true, auto-grow is disabled (user dragged the resize handle). */
  userSized?: boolean;
};

export type PdfWriteData = {
  /** Legacy AcroForm field values — kept for old drafts; new write UX ignores these. */
  fields: Record<string, string>;
  overlays: OverlayBox[];
};

export const OVERLAY_TEXT_COLORS = [
  "#1a1a1a",
  "#0d5c4d",
  "#1d4ed8",
  "#b45309",
  "#be123c",
  "#6b21a8",
] as const;

const DEFAULT_FONT = 14;
const DEFAULT_COLOR = "#1a1a1a";

export function emptyPdfWriteData(): PdfWriteData {
  return { fields: {}, overlays: [] };
}

export function normalizeOverlayColor(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_COLOR;
  const s = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    const [r, g, b] = s.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const known = OVERLAY_TEXT_COLORS.find((c) => c.toLowerCase() === s);
  return known || DEFAULT_COLOR;
}

/** Drop empty-text overlays (defense in depth for saves / older clients). */
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
      const text = typeof o.text === "string" ? o.text : "";
      // Drop empty leftovers from older drafts / abandoned taps.
      if (!text.trim()) continue;
      const fontRaw = Number(o.fontSize);
      overlays.push({
        id: o.id,
        page: Number(o.page) || 1,
        x: clamp01(Number(o.x) || 0),
        y: clamp01(Number(o.y) || 0),
        w: Math.min(1, Math.max(0.04, Number(o.w) || 0.18)),
        h: Math.min(1, Math.max(0.01, Number(o.h) || 0.022)),
        text,
        fontSize: Number.isFinite(fontRaw)
          ? Math.min(48, Math.max(8, fontRaw))
          : DEFAULT_FONT,
        color: normalizeOverlayColor(o.color),
        bold: Boolean(o.bold),
        italic: Boolean(o.italic),
        underline: Boolean(o.underline),
        userSized: o.userSized === true,
      });
    }
  }
  return { fields, overlays };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
