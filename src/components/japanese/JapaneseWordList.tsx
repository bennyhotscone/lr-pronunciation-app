"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { resolveWord } from "@/lib/japanese/engine";
import { playWordAudio } from "@/lib/japanese/tts";
import { buildPlayAudioDebug, getMnemonic, getPronunciationCue, getAudioText } from "@/lib/japanese/word-helpers";
import type { JapaneseWord } from "@/lib/japanese/types";
import {
  catalogEntriesForBlock,
  catalogEntryMatchesQuery,
  getJapaneseCatalog,
  groupRepeatedRomaji,
  otherBlocksLabel,
  summarizeJapaneseCatalog,
} from "@/lib/japanese/blocks/catalog";
import {
  countWordlist,
  isWordlistEntryKnown,
  matchesKnownFilter,
  mergeKnownKeys,
  type WordlistFilter,
} from "@/lib/japanese/wordlist-catalog";
import {
  resetJapaneseWordOverrideField,
  saveJapaneseWordOverride,
  type JapaneseProgressPayload,
  type JapaneseWordStatSnapshot,
} from "@/lib/japanese-actions";
import { loadJapaneseKnownFlags } from "@/lib/japanese-wordlist-actions";
import { JapaneseCatalogList } from "./JapaneseCatalogList";
import { JapaneseWordNuance } from "./JapaneseWordNuance";

type ListScope = "block" | "all";
type ListFilter = "all" | "repeats" | WordlistFilter;

type Props = {
  blockNumber: number;
  words: JapaneseWord[];
  overrides: JapaneseProgressPayload["overrides"];
  wordStats?: Record<number, JapaneseWordStatSnapshot>;
  onOverrideChange: (
    wordIndex: number,
    field: "mnemonic" | "pronunciationCue" | "ttsInput",
    value: string | null,
  ) => void;
  onSelectBlock?: (blockNumber: number) => void;
};

function emptyListCopy(filter: ListFilter, query: string, scope: ListScope): string {
  if (query.trim()) return "No words match that search.";
  if (filter === "known") {
    return scope === "block" ? "No known words in this block yet." : "No known words in this view yet.";
  }
  if (filter === "unknown") {
    return scope === "block"
      ? "No unknown words here — everything in this block is known."
      : "No unknown words here — everything in this view is known.";
  }
  if (filter === "repeats") return "No repeated words in this view.";
  return "No words to show.";
}

export function JapaneseWordList({
  blockNumber,
  words,
  overrides,
  wordStats = {},
  onOverrideChange,
  onSelectBlock,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    mnemonic: "",
    pronunciationCue: "",
    ttsInput: "",
  });
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<ListScope>("all");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [query, setQuery] = useState("");
  const [fetchedKnownKeys, setFetchedKnownKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadJapaneseKnownFlags().then((data) => {
      if (cancelled || "error" in data) return;
      setFetchedKnownKeys(data.knownKeys);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalog = useMemo(() => getJapaneseCatalog(), []);
  const summary = useMemo(() => summarizeJapaneseCatalog(catalog), [catalog]);
  const blockCatalog = useMemo(
    () => catalogEntriesForBlock(blockNumber, catalog),
    [blockNumber, catalog],
  );
  const blockCatalogByIndex = useMemo(() => {
    const map = new Map<number, (typeof blockCatalog)[number]>();
    for (const entry of blockCatalog) map.set(entry.wordIndex, entry);
    return map;
  }, [blockCatalog]);

  const knownKeys = useMemo(
    () => mergeKnownKeys(fetchedKnownKeys, blockNumber, words.length, wordStats),
    [fetchedKnownKeys, blockNumber, words.length, wordStats],
  );

  const scopedEntries = scope === "all" ? catalog : blockCatalog;
  const counts = useMemo(
    () => countWordlist(scopedEntries, knownKeys),
    [scopedEntries, knownKeys],
  );

  const visibleEntries = useMemo(() => {
    const knownFilter: WordlistFilter =
      filter === "known" || filter === "unknown" ? filter : "all";
    return scopedEntries.filter((entry) => {
      if (filter === "repeats" && !entry.isRomajiRepeat) return false;
      if (!matchesKnownFilter(entry, knownFilter, knownKeys)) return false;
      return catalogEntryMatchesQuery(entry, query);
    });
  }, [scopedEntries, filter, query, knownKeys]);

  const repeatGroups = useMemo(() => {
    if (filter !== "repeats" || scope !== "all") return null;
    return groupRepeatedRomaji(visibleEntries);
  }, [filter, scope, visibleEntries]);

  const blockRepeatCount = useMemo(
    () => blockCatalog.filter((entry) => entry.isRomajiRepeat).length,
    [blockCatalog],
  );

  const openEdit = (index: number) => {
    const o = overrides[index];
    const w = words[index];
    setEditingIndex(index);
    setDraft({
      mnemonic: getMnemonic(w, o),
      pronunciationCue: getPronunciationCue(w, o),
      ttsInput: getAudioText(w, o),
    });
  };

  const saveField = (
    index: number,
    field: "mnemonic" | "pronunciationCue" | "ttsInput",
    value: string,
    canonical: string,
  ) => {
    const trimmed = value.trim();
    const toSave = trimmed === canonical.trim() ? null : trimmed;
    onOverrideChange(index, field, toSave);
    startTransition(async () => {
      await saveJapaneseWordOverride(blockNumber, index, field, toSave);
    });
  };

  const resetField = (
    index: number,
    field: "mnemonic" | "pronunciationCue" | "ttsInput",
    canonical: string,
  ) => {
    onOverrideChange(index, field, null);
    setDraft((d) => ({ ...d, [field]: canonical }));
    startTransition(async () => {
      await resetJapaneseWordOverrideField(blockNumber, index, field);
    });
  };

  const visibleBlockIndices = useMemo(() => {
    if (scope !== "block") return [];
    return visibleEntries.map((entry) => entry.wordIndex);
  }, [scope, visibleEntries]);

  return (
    <section>
      <p className="jp-learn-sub">
        {summary.total} words across {summary.blockCount} blocks · {summary.uniqueRomaji} unique ·{" "}
        {summary.repeatedRomajiCount} repeats ({summary.repeatedRomajiSlots} slots). This block has{" "}
        {blockRepeatCount} words that also show up elsewhere.
      </p>
      <div className="jp-learn-catalog-toolbar" role="toolbar" aria-label="Word list options">
        <button
          type="button"
          className={`jp-learn-btn ${scope === "block" ? "jp-learn-btn-primary" : ""}`}
          aria-pressed={scope === "block"}
          onClick={() => setScope("block")}
        >
          This block
        </button>
        <button
          type="button"
          className={`jp-learn-btn ${scope === "all" ? "jp-learn-btn-primary" : ""}`}
          aria-pressed={scope === "all"}
          onClick={() => setScope("all")}
        >
          All {summary.blockCount} blocks
        </button>
        <button
          type="button"
          className={`jp-learn-btn ${filter === "all" ? "jp-learn-btn-primary" : ""}`}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`jp-learn-btn ${filter === "known" ? "jp-learn-btn-primary" : ""}`}
          aria-pressed={filter === "known"}
          onClick={() => setFilter("known")}
        >
          Known
        </button>
        <button
          type="button"
          className={`jp-learn-btn ${filter === "unknown" ? "jp-learn-btn-primary" : ""}`}
          aria-pressed={filter === "unknown"}
          onClick={() => setFilter("unknown")}
        >
          Unknown
        </button>
        <button
          type="button"
          className={`jp-learn-btn ${filter === "repeats" ? "jp-learn-btn-primary" : ""}`}
          aria-pressed={filter === "repeats"}
          onClick={() => setFilter("repeats")}
        >
          Repeats
        </button>
        <label className="jp-learn-catalog-search-label" htmlFor="jp-wordlist-search">
          Search
        </label>
        <input
          id="jp-wordlist-search"
          className="jp-learn-catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="romaji, English, or block"
        />
      </div>
      <div className="jp-learn-downloads" aria-label="Download word lists">
        <p className="jp-learn-sub">
          Download curriculum lists: blocks 1–10 (shipped) and proposed blocks 11–20 (frequency draft — review TBD glosses before building).
        </p>
        <div className="jp-learn-row jp-learn-downloads-row">
          <a className="jp-learn-btn jp-learn-btn-primary" href="/japanese/blocks-1-10.csv" download>
            Download first 500 (CSV)
          </a>
          <a className="jp-learn-btn" href="/japanese/blocks-1-10.json" download>
            First 500 (JSON)
          </a>
          <a className="jp-learn-btn jp-learn-btn-primary" href="/japanese/proposed-blocks-11-20.csv" download>
            Download next 500 (CSV)
          </a>
          <a className="jp-learn-btn" href="/japanese/proposed-blocks-11-20.json" download>
            Next 500 (JSON)
          </a>
        </div>
      </div>
      <p className="jp-learn-counts">
        Known {counts.known} / unknown {counts.unknown} / total {counts.total}
      </p>
      <p className="jp-learn-sub">
        {filter === "known"
          ? "Words you never missed in rounds 1–3, then got right in rounds 4 and 5. They skip round retries but still appear in milestone stories."
          : filter === "unknown"
            ? "Everything in this view that is not known yet."
            : scope === "block"
              ? `Block ${blockNumber} reference. Known words skip round retries but still appear in milestone stories. Tap Edit to customize memory hooks.`
              : filter === "repeats"
                ? "Grouped by romaji so the same headword is easy to compare across blocks."
                : "Romaji first. Highlighted rows appear in more than one block."}
      </p>

      {scope === "all" ? (
        visibleEntries.length === 0 ? (
          <p className="jp-learn-sub mt-4">{emptyListCopy(filter, query, scope)}</p>
        ) : (
          <div className="mt-4">
            <JapaneseCatalogList
              entries={visibleEntries}
              groups={repeatGroups}
              currentBlock={blockNumber}
              knownKeys={knownKeys}
              onSelectBlock={onSelectBlock}
            />
          </div>
        )
      ) : (
        <div className="jp-learn-wordgrid mt-4">
          {visibleBlockIndices.length === 0 ? (
            <p className="jp-learn-sub">{emptyListCopy(filter, query, scope)}</p>
          ) : null}
          {visibleBlockIndices.map((i) => {
            const w = words[i];
            if (!w) return null;
            const resolved = resolveWord(w, i, overrides[i]);
            const isEditing = editingIndex === i;
            const catalogEntry = blockCatalogByIndex.get(i);
            const alsoIn = catalogEntry ? otherBlocksLabel(catalogEntry) : null;
            const isKnown = catalogEntry
              ? isWordlistEntryKnown(catalogEntry, knownKeys)
              : !!wordStats[i]?.known;
            return (
              <article
                key={i}
                className={`jp-learn-word${isKnown ? " jp-learn-word-known" : ""}${catalogEntry?.isRomajiRepeat ? " jp-learn-word-repeat" : ""}`}
              >
                <div className="jp-learn-meta">
                  {String(i + 1).padStart(3, "0")}
                  {isKnown ? <span className="jp-learn-known-badge">Known</span> : null}
                </div>
                <div className="jp-learn-romaji">{resolved.displayRomaji}</div>
                <div className="jp-learn-english">{w.en}</div>
                <div className="jp-learn-jp">{w.jp}</div>
                {alsoIn ? (
                  <div className="jp-learn-repeat-tag jp-learn-repeat-tag-block">
                    {catalogEntry?.romajiClash ? "Same sound in " : "Also in "}
                    {alsoIn}
                  </div>
                ) : null}
                <JapaneseWordNuance word={w} showGroup />
                <div className="jp-learn-mnemonic">
                  <strong>Mnemonic</strong>
                  {resolved.displayMnemonic}
                </div>
                <div className="jp-learn-row mt-2">
                  <button
                    type="button"
                    className="jp-learn-btn"
                    onClick={() =>
                      playWordAudio(
                        resolved.speakText,
                        buildPlayAudioDebug(w, i, overrides[i]),
                      )
                    }
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="jp-learn-btn"
                    onClick={() => (isEditing ? setEditingIndex(null) : openEdit(i))}
                  >
                    {isEditing ? "Close" : "Edit"}
                  </button>
                </div>

                {isEditing ? (
                  <div className="jp-learn-edit-panel">
                    <label htmlFor={`mnemonic-${i}`}>Mnemonic (your memory hook)</label>
                    <textarea
                      id={`mnemonic-${i}`}
                      rows={3}
                      value={draft.mnemonic}
                      onChange={(e) => setDraft((d) => ({ ...d, mnemonic: e.target.value }))}
                      disabled={pending}
                    />
                    <div className="jp-learn-row">
                      <button
                        type="button"
                        className="jp-learn-btn jp-learn-btn-primary"
                        onClick={() => saveField(i, "mnemonic", draft.mnemonic, w.m)}
                        disabled={pending}
                      >
                        Save mnemonic
                      </button>
                      <button
                        type="button"
                        className="jp-learn-btn"
                        onClick={() => resetField(i, "mnemonic", w.m)}
                        disabled={pending}
                      >
                        Reset
                      </button>
                    </div>

                    <label htmlFor={`cue-${i}`}>Learner pronunciation cue (shown in training)</label>
                    <input
                      id={`cue-${i}`}
                      type="text"
                      value={draft.pronunciationCue}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, pronunciationCue: e.target.value }))
                      }
                      disabled={pending}
                    />
                    <p className="jp-learn-sub text-xs">Canonical romaji for grading: {w.r}</p>
                    <div className="jp-learn-row">
                      <button
                        type="button"
                        className="jp-learn-btn jp-learn-btn-primary"
                        onClick={() =>
                          saveField(i, "pronunciationCue", draft.pronunciationCue, w.r)
                        }
                        disabled={pending}
                      >
                        Save cue
                      </button>
                      <button
                        type="button"
                        className="jp-learn-btn"
                        onClick={() => resetField(i, "pronunciationCue", w.r)}
                        disabled={pending}
                      >
                        Reset
                      </button>
                    </div>

                    <label htmlFor={`tts-${i}`}>TTS audio input</label>
                    <input
                      id={`tts-${i}`}
                      type="text"
                      value={draft.ttsInput}
                      onChange={(e) => setDraft((d) => ({ ...d, ttsInput: e.target.value }))}
                      disabled={pending}
                    />
                    <p className="jp-learn-sub text-xs">Default audio: {w.audio}</p>
                    <div className="jp-learn-row">
                      <button
                        type="button"
                        className="jp-learn-btn jp-learn-btn-primary"
                        onClick={() => saveField(i, "ttsInput", draft.ttsInput, w.audio)}
                        disabled={pending}
                      >
                        Save TTS
                      </button>
                      <button
                        type="button"
                        className="jp-learn-btn"
                        onClick={() => resetField(i, "ttsInput", w.audio)}
                        disabled={pending}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
