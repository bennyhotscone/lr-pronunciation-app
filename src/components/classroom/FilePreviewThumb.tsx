"use client";

import { useEffect, useState } from "react";
import { getPdfFirstPageThumb } from "@/lib/pdf-first-page-thumb";

function isImageMime(mime: string | undefined, filename: string) {
  return Boolean(mime?.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
}

function isPdfMime(mime: string | undefined, filename: string) {
  return mime === "application/pdf" || /\.pdf$/i.test(filename);
}

function kindLabel(mime: string | undefined, filename: string) {
  if (isPdfMime(mime, filename)) return "PDF";
  if (isImageMime(mime, filename)) return "IMG";
  if (mime?.includes("word") || /\.docx?$/i.test(filename)) return "DOC";
  return "FILE";
}

type Props = {
  src?: string | null;
  filename: string;
  mimeType?: string;
  className?: string;
  imgClassName?: string;
};

export function FilePreviewThumb({
  src,
  filename,
  mimeType,
  className = "h-14 w-11",
  imgClassName = "h-full w-full object-cover object-top",
}: Props) {
  const image = isImageMime(mimeType, filename);
  const pdf = isPdfMime(mimeType, filename);
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src || !pdf) {
      setThumb(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setThumb(null);
    setFailed(false);
    void getPdfFirstPageThumb(src).then((dataUrl) => {
      if (cancelled) return;
      if (dataUrl) setThumb(dataUrl);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [src, pdf]);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#ebe8e0] ring-1 ring-border ${className}`}
      aria-hidden
    >
      {src && image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={imgClassName} />
      ) : thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className={imgClassName} />
      ) : (
        <span
          className={`px-1 text-center text-[0.6rem] font-bold leading-tight ${
            pdf && !failed ? "text-muted" : "text-desk-accent"
          }`}
        >
          {pdf && src && !failed ? "..." : kindLabel(mimeType, filename)}
        </span>
      )}
    </span>
  );
}