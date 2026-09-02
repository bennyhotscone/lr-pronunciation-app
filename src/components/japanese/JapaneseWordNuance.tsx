"use client";

import type { JapaneseWord } from "@/lib/japanese/types";
import {
  getNuanceForWord,
  getNuanceGroupForWord,
  type WordNuanceEntry,
} from "@/lib/japanese/word-nuances";

type Props = {
  word: JapaneseWord;
  /** Show full group comparison. Default: true in quiz, use showGroup in word list. */
  showGroup?: boolean;
};

function GroupComparison({
  current,
  entries,
}: {
  current: string;
  entries: WordNuanceEntry[];
}) {
  return (
    <ul className="jp-learn-nuance-list">
      {entries.map((e) => (
        <li
          key={e.romaji}
          className={e.romaji === current ? "jp-learn-nuance-current" : undefined}
        >
          <strong>{e.romaji}</strong> — {e.when}
        </li>
      ))}
    </ul>
  );
}

export function JapaneseWordNuance({ word, showGroup = true }: Props) {
  const nuance = getNuanceForWord(word);
  const group = getNuanceGroupForWord(word);
  if (!nuance || !group || group.entries.length < 2) return null;

  return (
    <aside className="jp-learn-nuance" aria-label="Why not just one word?">
      <div className="jp-learn-nuance-label">Why not just one word?</div>
      <p className="jp-learn-nuance-when">{nuance.when}</p>
      {showGroup ? (
        <>
          <p className="jp-learn-nuance-compare">{group.title} — compare:</p>
          <GroupComparison current={word.r} entries={group.entries} />
        </>
      ) : null}
    </aside>
  );
}
