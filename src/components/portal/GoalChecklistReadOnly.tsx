export function GoalChecklistReadOnly({
  items,
}: {
  items: { id: string; title: string; done: boolean }[];
}) {
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Competency checklist ({done}/{items.length}) — only your teacher ticks these
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                item.done
                  ? "border-foreground/40 bg-foreground text-background"
                  : "border-border bg-white text-transparent"
              }`}
              aria-hidden
            >
              ✓
            </span>
            <span className={item.done ? "text-muted line-through" : ""}>{item.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
