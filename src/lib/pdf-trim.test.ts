import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  extractPdfPages,
  parseSelectedPdfPages,
  maybeTrimPdfUpload,
} from "@/lib/pdf-trim";

async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`Page ${i + 1}`, { x: 40, y: 100, size: 18, font });
  }
  return doc.save();
}

describe("parseSelectedPdfPages", () => {
  it("treats empty/all as no trim", () => {
    expect(parseSelectedPdfPages(null)).toBeNull();
    expect(parseSelectedPdfPages("")).toBeNull();
    expect(parseSelectedPdfPages("all")).toBeNull();
  });

  it("parses unique sorted page numbers", () => {
    expect(parseSelectedPdfPages("[3,1,1,2]")).toEqual([1, 2, 3]);
  });

  it("keeps explicit empty selection as empty array", () => {
    expect(parseSelectedPdfPages("[]")).toEqual([]);
  });
});

describe("extractPdfPages", () => {
  it("keeps only selected pages in order", async () => {
    const bytes = await makePdf(5);
    const trimmed = await extractPdfPages(bytes, [1, 3, 5]);
    const doc = await PDFDocument.load(trimmed);
    expect(doc.getPageCount()).toBe(3);
  });

  it("rejects empty selection", async () => {
    const bytes = await makePdf(2);
    await expect(extractPdfPages(bytes, [99])).rejects.toThrow(
      /at least one/i,
    );
  });
});

describe("maybeTrimPdfUpload", () => {
  it("trims PDF when subset selected", async () => {
    const bytes = await makePdf(4);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const file = new File([ab], "worksheet.pdf", {
      type: "application/pdf",
    });
    const result = await maybeTrimPdfUpload(file, "[1,2]");
    expect(result.trimmed).toBe(true);
    expect(result.pageCount).toBe(2);
    const doc = await PDFDocument.load(await result.file.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
  });

  it("leaves non-PDF unchanged", async () => {
    const file = new File(["hi"], "note.txt", { type: "text/plain" });
    const result = await maybeTrimPdfUpload(file, "[1]");
    expect(result.trimmed).toBe(false);
    expect(result.file).toBe(file);
  });
});
