"use client";

import { useEffect, useState } from "react";

/** Multi-select tag chips + optional AI suggestions. */
export function TagPicker({
  classId,
  knownTags,
  name = "tags",
  title = "",
  body = "",
  enableAi = false,
}: {
  classId: string;
  knownTags: string[];
  name?: string;
  title?: string;
  body?: string;
  enableAi?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  function toggle(tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t) return;
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function addCustom() {
    const t = custom.trim().toLowerCase();
    if (!t) return;
    setSelected((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustom("");
  }

  async function suggest() {
    if (!enableAi) return;
    setLoadingAi(true);
    try {
      const res = await fetch("/api/portal/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title, body, knownTags }),
      });
      const data = (await res.json()) as { tags?: string[]; source?: string };
      setSuggestions(Array.isArray(data.tags) ? data.tags : []);
      setAiSource(data.source || null);
    } catch {
      setSuggestions([]);
      setAiSource("error");
    } finally {
      setLoadingAi(false);
    }
  }

  useEffect(() => {
    // reset AI chips when content changes a lot is optional — keep manual
  }, []);

  const pool = [...new Set([...knownTags, ...suggestions, ...selected])];

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Tags</p>
        {enableAi ? (
          <button
            type="button"
            onClick={() => void suggest()}
            disabled={loadingAi || (!title.trim() && !body.trim())}
            className="text-xs font-bold text-accent underline-offset-2 hover:underline disabled:opacity-40"
          >
            {loadingAi ? "Suggesting…" : "Suggest tags"}
          </button>
        ) : null}
      </div>
      {aiSource ? (
        <p className="text-[0.7rem] text-muted">
          Suggestions from {aiSource === "llm" ? "AI" : aiSource === "heuristic" ? "keywords" : aiSource}
          {" — click to add (nothing is applied automatically)."}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {pool.map((tag) => {
          const on = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                on ? "bg-accent text-background" : "bg-surface text-muted ring-1 ring-border"
              }`}
            >
              {tag}
            </button>
          );
        })}
        {!pool.length ? <span className="text-xs text-muted">No tags yet</span> : null}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add tag…"
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
        <button type="button" onClick={addCustom} className="btn-secondary rounded px-3 py-1.5 text-xs font-bold">
          Add
        </button>
      </div>
    </div>
  );
}

export function TagFilterBar({
  tags,
  active,
  onChange,
}: {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
}) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          !active ? "bg-accent text-background" : "bg-surface ring-1 ring-border"
        }`}
      >
        All
      </button>
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(active === t ? null : t)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            active === t ? "bg-accent text-background" : "bg-surface ring-1 ring-border"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
