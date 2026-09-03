"use client";

import { useMemo, useState } from "react";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { getJapaneseCatalog } from "@/lib/japanese/blocks/catalog";
import { playWordAudio } from "@/lib/japanese/tts";
import { buildPlayAudioDebug } from "@/lib/japanese/word-helpers";
import {
  buildWordFamilies,
  type WordFamily,
  type WordFamilyNode,
} from "@/lib/japanese/word-families";

type Props = {
  currentBlock: number;
  onSelectBlock?: (blockNumber: number) => void;
};

function playNode(node: WordFamilyNode) {
  const words = getJapaneseBlock(node.blockNumber);
  const word = words[node.wordIndex];
  if (!word) return;
  const text = (word.audio || word.jp || "").trim();
  if (!text) return;
  playWordAudio(text, buildPlayAudioDebug(word, node.wordIndex, null));
}

function FamilyTree({
  family,
  currentBlock,
  onSelectBlock,
}: {
  family: WordFamily;
  currentBlock: number;
  onSelectBlock?: (blockNumber: number) => void;
}) {
  return (
    <section className="jp-learn-family" aria-labelledby={`jp-family-${family.id}`}>
      <header className="jp-learn-family-head">
        <h3 id={`jp-family-${family.id}`} className="jp-learn-family-title">
          {family.label}
        </h3>
        <p className="jp-learn-family-blurb">{family.blurb}</p>
      </header>
      <ul className="jp-learn-family-tree">
        {family.nodes.map((node, i) => {
          const isCurrent = node.blockNumber === currentBlock;
          const branch =
            node.depth === 0
              ? null
              : i === family.nodes.length - 1 || family.nodes[i + 1]?.depth === 0
                ? "└"
                : "├";
          return (
            <li
              key={`${family.id}-${node.blockNumber}-${node.wordIndex}-${i}`}
              className={`jp-learn-family-node jp-learn-family-depth-${Math.min(node.depth, 2)}`}
            >
              {branch ? <span className="jp-learn-family-branch" aria-hidden="true">{branch}</span> : null}
              <div className="jp-learn-family-main">
                <span className="jp-learn-romaji">{node.romaji}</span>
                <span className="jp-learn-english">{node.english}</span>
              </div>
              <div className="jp-learn-family-meta">
                <button
                  type="button"
                  className={`jp-learn-catalog-block${isCurrent ? " jp-learn-catalog-block-current" : ""}`}
                  onClick={() => onSelectBlock?.(node.blockNumber)}
                  aria-label={`Block ${node.blockNumber}${isCurrent ? ", current block" : ""}`}
                >
                  Block {node.blockNumber}
                </button>
                <button
                  type="button"
                  className="jp-learn-btn jp-learn-family-play"
                  onClick={() => playNode(node)}
                >
                  Play
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function JapaneseWordFamilies({ currentBlock, onSelectBlock }: Props) {
  const [query, setQuery] = useState("");
  const families = useMemo(() => buildWordFamilies(getJapaneseCatalog()), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return families;
    return families.filter(
      (family) =>
        family.label.toLowerCase().includes(needle) ||
        family.blurb.toLowerCase().includes(needle) ||
        family.nodes.some(
          (node) =>
            node.romaji.toLowerCase().includes(needle) ||
            node.english.toLowerCase().includes(needle),
        ),
    );
  }, [families, query]);

  return (
    <section className="jp-learn-families" aria-labelledby="jp-families-heading">
      <h2 id="jp-families-heading" className="jp-learn-practice-title">
        Related words
      </h2>
      <p className="jp-learn-sub">
        Word families that share a stem or sound pattern — like dare, dareka, daremo. Romaji first;
        English and block number on each line.
      </p>

      <div className="jp-learn-catalog-toolbar" role="search">
        <label className="jp-learn-catalog-search-label" htmlFor="jp-family-search">
          Search related words
        </label>
        <input
          id="jp-family-search"
          className="jp-learn-catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search romaji or English…"
        />
      </div>

      <p className="jp-learn-counts">
        {filtered.length} word famil{filtered.length === 1 ? "y" : "ies"}
      </p>

      {filtered.length === 0 ? (
        <p className="jp-learn-sub">No related-word maps match that search.</p>
      ) : (
        <div className="jp-learn-family-list">
          {filtered.map((family) => (
            <FamilyTree
              key={family.id}
              family={family}
              currentBlock={currentBlock}
              onSelectBlock={onSelectBlock}
            />
          ))}
        </div>
      )}
    </section>
  );
}
