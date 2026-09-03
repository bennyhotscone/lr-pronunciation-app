"use client";

import type {
  JapaneseCatalogEntry,
  JapaneseRomajiGroup,
} from "@/lib/japanese/blocks/catalog";
import { otherBlocksLabel } from "@/lib/japanese/blocks/catalog";
import { isWordlistEntryKnown } from "@/lib/japanese/wordlist-catalog";

type Props = {
  entries: JapaneseCatalogEntry[];
  groups?: JapaneseRomajiGroup[] | null;
  currentBlock: number;
  knownKeys?: ReadonlySet<string>;
  onSelectBlock?: (blockNumber: number) => void;
};

function RepeatTag({ entry }: { entry: JapaneseCatalogEntry }) {
  const others = otherBlocksLabel(entry);
  if (!others) return <span />;
  return (
    <span className="jp-learn-repeat-tag">
      {entry.romajiClash ? "Same sound · " : "Also "}
      {others}
    </span>
  );
}

function CatalogRow({
  entry,
  currentBlock,
  knownKeys,
  onSelectBlock,
}: {
  entry: JapaneseCatalogEntry;
  currentBlock: number;
  knownKeys?: ReadonlySet<string>;
  onSelectBlock?: (blockNumber: number) => void;
}) {
  const isCurrent = entry.blockNumber === currentBlock;
  const isKnown = knownKeys ? isWordlistEntryKnown(entry, knownKeys) : false;
  return (
    <article
      className={`jp-learn-catalog-row${entry.isRomajiRepeat ? " jp-learn-catalog-row-repeat" : ""}${isKnown ? " jp-learn-catalog-row-known" : ""}`}
    >
      <div className="jp-learn-romaji">
        {entry.word.r}
        {isKnown ? <span className="jp-learn-known-badge">Known</span> : null}
      </div>
      <div className="jp-learn-english">{entry.word.en}</div>
      <button
        type="button"
        className={`jp-learn-catalog-block${isCurrent ? " jp-learn-catalog-block-current" : ""}`}
        onClick={() => onSelectBlock?.(entry.blockNumber)}
        aria-label={`Block ${entry.blockNumber}${isCurrent ? ", current block" : ""}`}
      >
        B{entry.blockNumber}
      </button>
      <div className="jp-learn-catalog-jp">{entry.word.jp}</div>
      <RepeatTag entry={entry} />
    </article>
  );
}

export function JapaneseCatalogList({
  entries,
  groups = null,
  currentBlock,
  knownKeys,
  onSelectBlock,
}: Props) {
  if (groups && groups.length > 0) {
    return (
      <div className="jp-learn-repeat-groups">
        {groups.map((group) => (
          <section
            key={group.romajiKey}
            className="jp-learn-repeat-group"
            aria-label={`${group.displayRomaji}, ${group.entries.length} blocks`}
          >
            <header className="jp-learn-repeat-group-head">
              <span className="jp-learn-romaji">{group.displayRomaji}</span>
              <span className="jp-learn-repeat-tag">
                {group.entries.length} blocks
                {group.romajiClash ? " · different writing" : ""}
              </span>
            </header>
            {group.entries.map((entry) => (
              <CatalogRow
                key={`${entry.blockNumber}-${entry.wordIndex}`}
                entry={entry}
                currentBlock={currentBlock}
                knownKeys={knownKeys}
                onSelectBlock={onSelectBlock}
              />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="jp-learn-catalog" role="list">
      <div className="jp-learn-catalog-head">
        <span>Romaji</span>
        <span>English</span>
        <span>Block</span>
        <span>Japanese</span>
        <span>Repeats</span>
      </div>
      {entries.map((entry) => (
        <CatalogRow
          key={`${entry.blockNumber}-${entry.wordIndex}`}
          entry={entry}
          currentBlock={currentBlock}
          knownKeys={knownKeys}
          onSelectBlock={onSelectBlock}
        />
      ))}
    </div>
  );
}
