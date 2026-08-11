import Link from "next/link";
import { freeInfoTagLinks, normalizeTag, tagClassroomHref } from "@/lib/info-tag-links";

/** Clickable info tag — students open classroom find + free study links. */
export function InfoTag({
  tag,
  classId,
  active = false,
}: {
  tag: string;
  classId: string;
  active?: boolean;
}) {
  const t = normalizeTag(tag);
  return (
    <Link
      href={tagClassroomHref(classId, t)}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.75rem] font-bold ring-1 transition ${
        active
          ? "bg-desk-accent text-white ring-desk-accent"
          : "bg-[#f3f2ee] text-ink ring-border hover:bg-desk-accent/10 hover:ring-desk-accent"
      }`}
    >
      {t}
    </Link>
  );
}

export function InfoTagLearnMore({ tag }: { tag: string }) {
  const links = freeInfoTagLinks(tag);
  if (!links.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-[#f3f2ee] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        Free explanations &amp; practice
      </p>
      <p className="mt-1 text-xs text-muted">
        No AI cost — these open free public sites for “{normalizeTag(tag)}”.
      </p>
      <ul className="mt-2 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-desk-accent underline-offset-2 hover:underline"
            >
              {l.label}
            </a>
            <span className="text-sm text-muted"> — {l.blurb}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
