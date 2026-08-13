"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePreviewThumb } from "@/components/classroom/FilePreviewThumb";
import { MaterialKindBadge } from "@/components/classroom/MaterialKindPicker";
import { parseMaterialKind } from "@/lib/material-kind";
import {
  studentCreateFolder,
  studentDeleteFolder,
  studentMoveResource,
  studentToggleStar,
} from "@/lib/file-library-actions";

export type StudentFileItem = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  materialKind: string;
  tags: string[];
  folderId: string | null;
  starred: boolean;
};

export type StudentFolderItem = {
  id: string;
  name: string;
  parentId: string | null;
};

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
  return "File";
}

export function StudentFilesBrowser({
  files,
  folders,
}: {
  files: StudentFileItem[];
  folders: StudentFolderItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [starsOnly, setStarsOnly] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === folderId),
    [folders, folderId],
  );

  const breadcrumb = useMemo(() => {
    const trail: StudentFolderItem[] = [];
    let cur = folderId;
    while (cur) {
      const f = folders.find((x) => x.id === cur);
      if (!f) break;
      trail.unshift(f);
      cur = f.parentId;
    }
    return trail;
  }, [folderId, folders]);

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      if (starsOnly) {
        if (!f.starred) return false;
      } else if ((f.folderId ?? null) !== folderId) {
        return false;
      }
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.filename.toLowerCase().includes(q) ||
        (f.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [files, folderId, query, starsOnly]);

  function run(action: () => Promise<{ error?: string } | { ok: true }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await action();
      if (res && "error" in res && res.error) setMsg(res.error);
      else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
          className="min-w-[12rem] flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setStarsOnly((v) => !v);
            if (!starsOnly) setFolderId(null);
          }}
          className={`rounded-xl px-3 py-2 text-xs font-bold ring-1 ${
            starsOnly
              ? "bg-amber-500 text-white ring-amber-600"
              : "bg-white text-ink ring-border"
          }`}
        >
          Starred
        </button>
      </div>

      {!starsOnly ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            className="font-bold text-desk-accent hover:underline"
            onClick={() => setFolderId(null)}
          >
            All files
          </button>
          {breadcrumb.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-2">
              <span className="text-muted">/</span>
              <button
                type="button"
                className="font-semibold text-ink hover:underline"
                onClick={() => setFolderId(b.id)}
              >
                {b.name}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Showing starred files across folders.</p>
      )}

      {!starsOnly ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newFolder.trim();
            if (!name) return;
            const fd = new FormData();
            fd.set("name", name);
            if (folderId) fd.set("parentId", folderId);
            run(() => studentCreateFolder(fd));
            setNewFolder("");
          }}
        >
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder name"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
          >
            Create folder
          </button>
        </form>
      ) : null}

      {msg ? <p className="text-sm font-semibold text-danger">{msg}</p> : null}

      {!starsOnly && childFolders.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {childFolders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => setFolderId(folder.id)}
                className="flex w-full flex-col gap-2 rounded-lg border border-border bg-[#faf9f6] p-3 text-left hover:border-desk-accent/40"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#ebe8e0] text-2xl" aria-hidden>
                  {"\u{1F4C1}"}
                </span>
                <span className="text-sm font-semibold text-ink">{folder.name}</span>
              </button>
              <button
                type="button"
                className="mt-1 text-[0.65rem] font-bold text-muted hover:text-danger"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("folderId", folder.id);
                  run(() => studentDeleteFolder(fd));
                }}
              >
                Delete folder
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {visibleFiles.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleFiles.map((file) => {
            const href = fileHref(file.id);
            const image = isImageMime(file.mimeType);
            const pdf = isPdfMime(file.mimeType, file.filename);
            const exercise = parseMaterialKind(file.materialKind) === "EXERCISE";
            const primaryHref = pdf
              ? `/portal/read/${file.id}${exercise ? "?mode=write" : ""}`
              : href;
            const kind = fileKindLabel(file.mimeType, file.filename);

            return (
              <li key={file.id} className="group flex flex-col overflow-hidden rounded-lg border border-border bg-[#faf9f6]">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#ebe8e0]">
                  <a
                    href={primaryHref}
                    {...(pdf ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                    className="absolute inset-0"
                  >
                    {image || pdf ? (
                      <FilePreviewThumb
                        src={href}
                        filename={file.filename}
                        mimeType={file.mimeType}
                        className="h-full w-full rounded-none ring-0"
                        imgClassName="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                        <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md bg-desk-accent px-2 py-1 text-xs font-bold text-white">
                          {kind}
                        </span>
                        <span className="break-all text-[0.7rem] text-muted">{file.filename}</span>
                      </span>
                    )}
                  </a>
                  <button
                    type="button"
                    aria-label={file.starred ? "Unstar file" : "Star file"}
                    className={`absolute right-2 top-2 rounded-full px-2 py-1 text-sm shadow ${
                      file.starred ? "bg-amber-400 text-white" : "bg-white/90 text-muted"
                    }`}
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("resourceId", file.id);
                      run(() => studentToggleStar(fd));
                    }}
                  >
                    {"\u2605"}
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <a
                    href={primaryHref}
                    {...(pdf ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                    className="break-all text-sm font-semibold leading-snug text-ink hover:text-desk-accent"
                  >
                    {file.title}
                  </a>
                  <MaterialKindBadge kind={file.materialKind} />
                  {pdf ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <a href={`/portal/read/${file.id}`} className="text-[0.7rem] font-bold text-desk-accent hover:underline">
                        Read
                      </a>
                      <a
                        href={`/portal/read/${file.id}?mode=write`}
                        className={`text-[0.7rem] font-bold hover:underline ${
                          exercise ? "text-[#1f4e46]" : "text-ink/50"
                        }`}
                      >
                        Write
                      </a>
                    </div>
                  ) : null}
                  <label className="mt-2 block text-[0.65rem] font-semibold text-muted">
                    Move to
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1 text-xs text-ink"
                      value={file.folderId || "root"}
                      disabled={pending}
                      onChange={(e) => {
                        const fd = new FormData();
                        fd.set("resourceId", file.id);
                        fd.set("folderId", e.target.value);
                        run(() => studentMoveResource(fd));
                      }}
                    >
                      <option value="root">All files (root)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {starsOnly ? "No starred files yet." : "No files in this folder."}
        </p>
      )}
    </div>
  );
}