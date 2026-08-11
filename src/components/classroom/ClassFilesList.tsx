"use client";

import { useMemo, useState } from "react";
import { TagFilterBar } from "@/components/classroom/TagPicker";

function fileHref(resourceId: string) {
  return `/api/portal/resources/${resourceId}/download`;
}

function isImageMime(mime: string | undefined) {
  return Boolean(mime?.startsWith("image/"));
}

function isPdfMime(mime: string | undefined, filename: string) {
  return mime === "application/pdf" || /\.pdf$/i.test(filename);
}

function fileKindLabel(mime: string | undefined, filename: string) {
  if (isPdfMime(mime, filename)) return "PDF";
  if (isImageMime(mime)) return "Image";
  if (mime?.includes("word") || /\.docx?$/i.test(filename)) return "Doc";
  if (mime?.startsWith("text/") || /\.txt$/i.test(filename)) return "Text";
  return "File";
}

export type ClassFileItem = {
  id: string;
  title: string;
  filename: string;
  tags: string[];
  mimeType?: string;
};

function FileThumb({ file }: { file: ClassFileItem }) {
  const href = fileHref(file.id);
  const kind = fileKindLabel(file.mimeType, file.filename);
  const image = isImageMime(file.mimeType);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-[#faf9f6] transition hover:border-desk-accent/40 hover:bg-white"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#ebe8e0]">
        {image ? (
          // Auth cookie on same origin — download route serves inline images.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span
              className={`inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-2 py-1 text-xs font-bold tracking-wide text-white ${
                kind === "PDF" ? "bg-[#b42318]" : "bg-desk-accent"
              }`}
            >
              {kind}
            </span>
            <span className="line-clamp-2 text-[0.7rem] leading-snug text-muted">
              {file.filename}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-desk-accent">
          {file.title}
        </p>
        {file.tags?.length ? (
          <p className="mt-auto flex flex-wrap gap-1 pt-1">
            {file.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-white px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted ring-1 ring-border"
              >
                {t}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </a>
  );
}

export function ClassFilesList({
  files,
  knownTags = [],
  hideTagFilter = false,
  showTypeOrganiser = false,
}: {
  files: ClassFileItem[];
  knownTags?: string[];
  /** When parent already shows tag filters. */
  hideTagFilter?: boolean;
  /** Extra All / Images / PDFs / Docs chips for the Files tab. */
  showTypeOrganiser?: boolean;
}) {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"all" | "image" | "pdf" | "doc">("all");
  const allTags = useMemo(() => {
    const s = new Set<string>(knownTags);
    for (const f of files) for (const t of f.tags || []) s.add(t);
    return [...s].sort();
  }, [files, knownTags]);

  const visible = useMemo(() => {
    let list = filterTag
      ? files.filter((f) => (f.tags || []).includes(filterTag))
      : files;
    if (fileType === "image") {
      list = list.filter((f) => isImageMime(f.mimeType));
    } else if (fileType === "pdf") {
      list = list.filter((f) => isPdfMime(f.mimeType, f.filename));
    } else if (fileType === "doc") {
      list = list.filter(
        (f) =>
          !isImageMime(f.mimeType) &&
          !isPdfMime(f.mimeType, f.filename) &&
          (Boolean(f.mimeType?.includes("word")) ||
            Boolean(f.mimeType?.startsWith("text/")) ||
            /\.(docx?|txt)$/i.test(f.filename)),
      );
    }
    return list;
  }, [files, filterTag, fileType]);

  return (
    <div className="space-y-3">
      {showTypeOrganiser ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["image", "Images"],
              ["pdf", "PDFs"],
              ["doc", "Docs"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFileType(id)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 transition ${
                fileType === id
                  ? "bg-desk-accent text-white ring-desk-accent"
                  : "bg-[#f3f2ee] text-ink ring-border hover:ring-desk-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {!hideTagFilter ? (
        <TagFilterBar tags={allTags} active={filterTag} onChange={setFilterTag} />
      ) : null}
      {visible.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((f) => (
            <li key={f.id}>
              <FileThumb file={f} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No files
          {fileType !== "all" ? ` in ${fileType}` : ""}
          {filterTag ? ` tagged “${filterTag}”` : ""}
          {!filterTag && fileType === "all" ? " yet" : ""}.
        </p>
      )}
    </div>
  );
}
