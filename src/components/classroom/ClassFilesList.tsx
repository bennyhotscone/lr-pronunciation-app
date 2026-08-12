"use client";

import { useMemo, useState } from "react";
import { TagFilterBar } from "@/components/classroom/TagPicker";
import { MaterialKindBadge } from "@/components/classroom/MaterialKindPicker";
import {
  groupByMaterialKind,
  parseMaterialKind,
  type MaterialKind,
} from "@/lib/material-kind";

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
  materialKind?: MaterialKind | string;
};

function FileThumb({ file }: { file: ClassFileItem }) {
  const href = fileHref(file.id);
  const kind = fileKindLabel(file.mimeType, file.filename);
  const image = isImageMime(file.mimeType);
  const pdf = isPdfMime(file.mimeType, file.filename);
  const exercise = parseMaterialKind(file.materialKind) === "EXERCISE";
  const primaryHref = pdf
    ? `/portal/read/${file.id}${exercise ? "?mode=write" : ""}`
    : href;

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-[#faf9f6] transition hover:border-desk-accent/40 hover:bg-white">
      <a
        href={primaryHref}
        {...(pdf ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="relative aspect-[4/3] overflow-hidden bg-[#ebe8e0]"
      >
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
      </a>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <a
          href={primaryHref}
          {...(pdf ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="line-clamp-2 text-sm font-semibold leading-snug text-ink hover:text-desk-accent"
        >
          {file.title}
        </a>
        <MaterialKindBadge kind={file.materialKind} />
        {pdf ? (
          <div className="mt-1 flex flex-wrap gap-2">
            <a
              href={`/portal/read/${file.id}`}
              className="text-[0.7rem] font-bold text-desk-accent hover:underline"
            >
              Read
            </a>
            <a
              href={`/portal/read/${file.id}?mode=write`}
              className={`text-[0.7rem] font-bold hover:underline ${
                exercise ? "text-[#1f4e46]" : "text-ink/50"
              }`}
            >
              {exercise ? "Open in write mode" : "Write"}
            </a>
          </div>
        ) : null}
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
    </div>
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
  const [basketFilter, setBasketFilter] = useState<"all" | MaterialKind>("all");
  const allTags = useMemo(() => {
    const s = new Set<string>(knownTags);
    for (const f of files) for (const t of f.tags || []) s.add(t);
    return [...s].sort();
  }, [files, knownTags]);

  const visible = useMemo(() => {
    let list = filterTag
      ? files.filter((f) => (f.tags || []).includes(filterTag))
      : files;
    if (basketFilter !== "all") {
      list = list.filter((f) => parseMaterialKind(f.materialKind) === basketFilter);
    }
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
  }, [files, filterTag, fileType, basketFilter]);

  const sections = useMemo(() => groupByMaterialKind(visible), [visible]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All baskets"],
            ["INFO", "Information"],
            ["EXERCISE", "Exercises & activities"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setBasketFilter(id)}
            className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 transition ${
              basketFilter === id
                ? id === "EXERCISE"
                  ? "bg-[#1f4e46] text-white ring-[#1f4e46]"
                  : "bg-desk-accent text-white ring-desk-accent"
                : "bg-[#f3f2ee] text-ink ring-border hover:ring-desk-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {showTypeOrganiser ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All types"],
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
      {sections.length ? (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.kind}>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                <MaterialKindBadge kind={section.kind} />
                <span className="text-muted">({section.items.length})</span>
              </h4>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.items.map((f) => (
                  <li key={f.id}>
                    <FileThumb file={f} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          No files
          {basketFilter !== "all"
            ? ` in ${basketFilter === "EXERCISE" ? "Exercises & activities" : "Information"}`
            : ""}
          {fileType !== "all" ? ` (${fileType})` : ""}
          {filterTag ? ` tagged “${filterTag}”` : ""}
          {!filterTag && fileType === "all" && basketFilter === "all" ? " yet" : ""}.
        </p>
      )}
    </div>
  );
}
