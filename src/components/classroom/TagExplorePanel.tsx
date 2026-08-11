import Link from "next/link";
import { InfoTagLearnMore } from "@/components/classroom/InfoTag";
import { portalResourceDownloadHref } from "@/lib/portal-files";
import { normalizeTag } from "@/lib/info-tag-links";

type Hit = { kind: "post" | "lesson" | "file"; title: string; href?: string; meta?: string };

/** Shows classroom matches + free external study links for a tag (zero API cost). */
export function TagExplorePanel({
  classId,
  tag,
  posts,
  lessons,
  files,
}: {
  classId: string;
  tag: string;
  posts: { id: string; title: string; tags: string[] }[];
  lessons: { id: string; title: string | null; day: Date; tags: string[] }[];
  files: { id: string; title: string; tags: string[] }[];
}) {
  const t = normalizeTag(tag);
  const hits: Hit[] = [];

  for (const p of posts) {
    if ((p.tags || []).map(normalizeTag).includes(t)) {
      hits.push({ kind: "post", title: p.title, meta: "Stream post" });
    }
  }
  for (const l of lessons) {
    if ((l.tags || []).map(normalizeTag).includes(t)) {
      hits.push({
        kind: "lesson",
        title: l.title || l.day.toISOString().slice(0, 10),
        meta: `Lesson · ${l.day.toISOString().slice(0, 10)}`,
      });
    }
  }
  for (const f of files) {
    if ((f.tags || []).map(normalizeTag).includes(t)) {
      hits.push({
        kind: "file",
        title: f.title,
        href: portalResourceDownloadHref(f.id),
        meta: "Classroom file",
      });
    }
  }

  return (
    <section className="card rounded-xl border-desk-accent/40 p-5 ring-1 ring-desk-accent/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">Info tag</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            {t}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Classroom materials with this tag, plus free study links (no paid AI).
          </p>
        </div>
        <Link
          href={`/portal/classrooms/${classId}`}
          className="text-sm font-semibold text-desk-accent underline-offset-2 hover:underline"
        >
          Clear filter
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">In this classroom</p>
        {hits.length ? (
          <ul className="mt-2 space-y-2">
            {hits.map((h, i) => (
              <li key={`${h.kind}-${h.title}-${i}`} className="text-sm">
                <span className="text-xs font-bold uppercase text-muted">{h.kind}</span>{" "}
                {h.href ? (
                  <a
                    href={h.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-desk-accent underline-offset-2 hover:underline"
                  >
                    {h.title}
                  </a>
                ) : (
                  <span className="font-semibold text-ink">{h.title}</span>
                )}
                {h.meta ? <span className="text-muted"> · {h.meta}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Nothing in this classroom is tagged “{t}” yet. You can still use the free links below.
          </p>
        )}
      </div>

      <InfoTagLearnMore tag={t} />
    </section>
  );
}
