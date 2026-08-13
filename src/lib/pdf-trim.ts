import { PDFDocument } from "pdf-lib";
import { isPdfFile } from "@/lib/pdf-file";

export { isPdfFile } from "@/lib/pdf-file";

/**
 * Parse teacher-selected page numbers (1-indexed).
 * Returns `null` when all pages should be kept (no trim).
 * Returns `[]` when the teacher explicitly selected zero pages (invalid).
 */
export function parseSelectedPdfPages(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t === "all") return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed)) return null;
    if (parsed.length === 0) return [];
    const pages = parsed
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1);
    return [...new Set(pages)].sort((a, b) => a - b);
  } catch {
    return null;
  }
}

/**
 * Build a new PDF containing only the selected pages (1-indexed).
 * Throws if no valid pages remain.
 */
export async function extractPdfPages(
  pdfBytes: ArrayBuffer | Uint8Array,
  selectedPages1Indexed: number[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const indices = [...new Set(selectedPages1Indexed)]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
    .map((p) => p - 1);

  if (!indices.length) {
    throw new Error("Select at least one PDF page to upload.");
  }

  if (indices.length === total) {
    return pdfBytes instanceof Uint8Array
      ? pdfBytes
      : new Uint8Array(pdfBytes);
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  for (const page of copied) out.addPage(page);
  return out.save();
}

function isFullPageSet(selected: number[], total: number): boolean {
  if (selected.length !== total) return false;
  return selected.every((p, i) => p === i + 1);
}

/**
 * If the upload is a PDF and the teacher selected a subset of pages,
 * return a new File with only those pages. Otherwise return the original file.
 * The full original is never stored when pages were trimmed.
 */
export async function maybeTrimPdfUpload(
  file: File,
  selectedPagesRaw: unknown,
): Promise<{ file: File; trimmed: boolean; pageCount: number }> {
  if (!isPdfFile(file)) {
    return { file, trimmed: false, pageCount: 0 };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const selected = parseSelectedPdfPages(selectedPagesRaw);

  if (selected !== null && selected.length === 0) {
    throw new Error("Select at least one PDF page to upload.");
  }

  if (selected === null || isFullPageSet(selected, total)) {
    return { file, trimmed: false, pageCount: total };
  }

  const valid = selected.filter((p) => p >= 1 && p <= total);
  if (!valid.length) {
    throw new Error("Select at least one PDF page to upload.");
  }
  if (isFullPageSet(valid, total)) {
    return { file, trimmed: false, pageCount: total };
  }

  const trimmedBytes = await extractPdfPages(bytes, valid);
  const ab = new ArrayBuffer(trimmedBytes.byteLength);
  new Uint8Array(ab).set(trimmedBytes);
  const trimmedFile = new File([ab], file.name || "document.pdf", {
    type: "application/pdf",
    lastModified: Date.now(),
  });
  return { file: trimmedFile, trimmed: true, pageCount: valid.length };
}
