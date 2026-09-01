"use client";

import { useEffect, useState, useTransition } from "react";
import { getMnemonic } from "@/lib/japanese/word-helpers";
import {
  resetJapaneseWordOverrideField,
  saveJapaneseWordOverride,
} from "@/lib/japanese-actions";

type Props = {
  blockNumber: number;
  wordIndex: number;
  canonicalMnemonic: string;
  mnemonic?: string | null;
  showRomajiLine?: { romaji: string; english: string };
  romajiOnly?: string;
  romajiMd?: string;
  onMnemonicChange: (wordIndex: number, value: string | null) => void;
  className?: string;
};

export function JapaneseMnemonicHook({
  blockNumber,
  wordIndex,
  canonicalMnemonic,
  mnemonic,
  showRomajiLine,
  romajiOnly,
  romajiMd,
  onMnemonicChange,
  className = "jp-learn-mnemonic",
}: Props) {
  const wordLike = { m: canonicalMnemonic, jp: "", audio: "", r: "", en: "" };
  const display = getMnemonic(wordLike, { mnemonic });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing) setDraft(display);
  }, [display, editing]);

  const save = () => {
    const trimmed = draft.trim();
    const toSave = trimmed === canonicalMnemonic.trim() ? null : trimmed || null;
    onMnemonicChange(wordIndex, toSave);
    startTransition(async () => {
      await saveJapaneseWordOverride(blockNumber, wordIndex, "mnemonic", toSave);
      setEditing(false);
    });
  };

  const reset = () => {
    onMnemonicChange(wordIndex, null);
    startTransition(async () => {
      await resetJapaneseWordOverrideField(blockNumber, wordIndex, "mnemonic");
      setDraft(canonicalMnemonic);
      setEditing(false);
    });
  };

  return (
    <div className={className}>
      <div className="jp-learn-mnemonic-head">
        <strong>Memory hook</strong>
        {!editing ? (
          <button
            type="button"
            className="jp-learn-mnemonic-edit"
            onClick={() => setEditing(true)}
            aria-label="Edit memory hook"
          >
            Edit
          </button>
        ) : null}
      </div>

      {showRomajiLine ? (
        <div className="jp-learn-romaji-xl">
          {showRomajiLine.romaji} = {showRomajiLine.english}
        </div>
      ) : romajiOnly ? (
        <div className="jp-learn-romaji-xl">{romajiOnly}</div>
      ) : romajiMd ? (
        <div className="jp-learn-romaji-lg">{romajiMd}</div>
      ) : null}

      {editing ? (
        <div className="jp-learn-edit-panel jp-learn-mnemonic-panel">
          <label htmlFor={`train-mnemonic-${wordIndex}`}>Your memory hook</label>
          <textarea
            id={`train-mnemonic-${wordIndex}`}
            className="jp-learn-edit-panel textarea"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
          />
          <div className="jp-learn-row mt-2">
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              onClick={save}
              disabled={pending}
            >
              Save hook
            </button>
            <button type="button" className="jp-learn-btn" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </button>
            {mnemonic?.trim() ? (
              <button type="button" className="jp-learn-btn" onClick={reset} disabled={pending}>
                Reset to default
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="jp-learn-mnemonic-body"
          onClick={() => setEditing(true)}
          title="Tap to customize this memory hook"
        >
          {display}
        </button>
      )}
    </div>
  );
}
