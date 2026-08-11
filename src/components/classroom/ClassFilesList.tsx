"use client";

import { useMemo, useState } from "react";
import { TagFilterBar } from "@/components/classroom/TagPicker";

function fileHref(resourceId: string) {
  return `/api/portal/resources/${resourceId}/download`;
}

export type ClassFileItem = {
  id: string;
  title: string;
  filename: string;
  tags: string[];
};

export function ClassFilesList({
  files,
  knownTags = [],
}: {
  files: ClassFileItem[];
  knownTags?: string[];
}) {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const s = new Set<string>(knownTags);
    for (const f of files) for (const t of f.tags || []) s.add(t);
    return [...s].sort();
  }, [files, knownTags]);

  const visible = filterTag
    ? files.filter((f) => (f.tags || []).includes(filterTag))
    : files;

  return (
    <div className="space-y-3">
      <TagFilterBar tags={allTags} active={filterTag} onChange={setFilterTag} />
      <ul className="space-y-2 text-sm">
        {visible.map((f) => (
          <li key={f.id}>
            <a
              href={fileHref(f.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              {f.title}
            </a>
            <p className="text-xs text-muted">{f.filename}</p>
            {f.tags?.length ? (
              <p className="mt-0.5 flex flex-wrap gap-1">
                {f.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-surface px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted ring-1 ring-border"
                  >
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
          </li>
        ))}
        {!visible.length ? (
          <li className="text-muted">No files{filterTag ? ` tagged “${filterTag}”` : " yet"}.</li>
        ) : null}
      </ul>
    </div>
  );
}
