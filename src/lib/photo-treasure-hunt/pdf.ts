import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type ReportPhotoType = "jpeg" | "png";

export type ReportSection = {
  index: number;
  title: string;
  word: string;
  sentence: string;
  photo?: Uint8Array | null;
  photoType?: ReportPhotoType | null;
};

export type PhotoReportInput = {
  studentName: string;
  completed: number;
  total: number;
  generatedAt?: Date;
  sections: ReportSection[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function pdfSafe(text: string): string {
  return text
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2022", "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(text).split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export function photoReportFilename(studentName: string, when = new Date()): string {
  const safe =
    pdfSafe(studentName.trim() || "Rita")
      .replace(/[^\w\-]+/g, "-")
      .replace(/^-|-$/g, "") || "Rita";
  const day = when.toISOString().slice(0, 10);
  return `${safe}-photo-treasure-hunt-${day}.pdf`;
}

export async function buildPhotoReportPdf(input: PhotoReportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const name = pdfSafe(input.studentName.trim() || "Rita");
  const when = input.generatedAt ?? new Date();
  const dateLabel = when.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensure = (height: number) => {
    if (y - height < MARGIN) newPage();
  };

  const drawLines = (
    lines: string[],
    options: { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; gap?: number },
  ) => {
    const gap = options.gap ?? options.size + 4;
    for (const line of lines) {
      ensure(gap);
      y -= options.size;
      page.drawText(line, {
        x: MARGIN,
        y,
        size: options.size,
        font: options.font,
        color: options.color ?? rgb(0.15, 0.12, 0.16),
      });
      y -= gap - options.size;
    }
  };

  drawLines(["MELBOURNE CBD  ·  ENGLISH PHOTO SCAVENGER HUNT"], {
    size: 10,
    font: bold,
    color: rgb(0.71, 0.29, 0.51),
  });
  y -= 8;
  drawLines([`${name}'s Photo Report`], { size: 22, font: bold });
  y -= 6;
  drawLines(
    [
      pdfSafe(
        `Completed: ${input.completed} of ${input.total} missions · ${dateLabel}`,
      ),
    ],
    { size: 11, font },
  );
  y -= 16;

  if (input.sections.length === 0) {
    drawLines(["No photos or notes yet. Add your first mission to make your report."], {
      size: 12,
      font,
    });
    y -= 8;
  }

  for (const section of input.sections) {
    ensure(36);
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: rgb(0.85, 0.75, 0.8),
    });
    y -= 16;
    drawLines([pdfSafe(`${section.index}. ${section.title}`)], { size: 14, font: bold });
    y -= 8;

    if (section.photo && section.photo.byteLength > 0) {
      try {
        const embedded =
          section.photoType === "png"
            ? await pdf.embedPng(section.photo)
            : await pdf.embedJpg(section.photo);
        const maxH = 280;
        const scale = Math.min(contentWidth / embedded.width, maxH / embedded.height, 1);
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        ensure(height + 12);
        y -= height;
        page.drawImage(embedded, { x: MARGIN, y, width, height });
        y -= 12;
      } catch (error) {
        console.warn("Could not embed photo in report", error);
        drawLines(["Photo could not be added to this PDF page."], { size: 11, font });
        y -= 6;
      }
    }

    if (section.word) {
      drawLines(wrapText(`New vocabulary: ${section.word}`, font, 12, contentWidth), {
        size: 12,
        font,
      });
      y -= 4;
    }
    if (section.sentence) {
      drawLines(wrapText(section.sentence, font, 12, contentWidth), { size: 12, font });
      y -= 8;
    }
  }

  y -= 8;
  ensure(40);
  drawLines(["Speaking task"], { size: 14, font: bold });
  y -= 6;
  drawLines(
    wrapText(
      "Choose your five favourite photographs. Explain what each shows, why you chose it and which English word you learnt.",
      font,
      12,
      contentWidth,
    ),
    { size: 12, font },
  );

  return pdf.save();
}
