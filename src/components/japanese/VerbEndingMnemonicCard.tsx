"use client";

import { useEffect, useState } from "react";
import {
  getVerbEndingMnemonic,
  resolveEndingKey,
  type VerbEndingMnemonic,
} from "@/lib/japanese/particles/mnemonics";
import {
  clearEndingMnemonicOverride,
  getEndingMnemonicOverride,
  setEndingMnemonicOverride,
} from "@/lib/japanese/particles/mnemonic-storage";

type Props = {
  ending?: string;
  romaji?: string;
  /** Compact single-line for teach form rows. */
  compact?: boolean;
  /** Start with options open (e.g. formMC drill). */
  defaultOpen?: boolean;
  className?: string;
  onChange?: (sound: string) => void;
};

export function VerbEndingMnemonicCard({
  ending,
  romaji,
  compact = false,
  defaultOpen = false,
  className,
  onChange,
}: Props) {
  const key = resolveEndingKey(ending, romaji);
  const base: VerbEndingMnemonic | undefined = getVerbEndingMnemonic(ending, romaji);
  const [selected, setSelected] = useState(() =>
    getEndingMnemonicOverride(ending, romaji) ?? base?.sound ?? "",
  );
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState(selected);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    const next = getEndingMnemonicOverride(ending, romaji) ?? base?.sound ?? "";
    setSelected(next);
    setDraft(next);
    setCustomMode(false);
  }, [ending, romaji, base?.sound, key]);

  if (!base || !key) return null;

  const apply = (sound: string) => {
    const trimmed = sound.trim();
    if (!trimmed) return;
    setEndingMnemonicOverride(key, trimmed, romaji);
    setSelected(trimmed);
    setDraft(trimmed);
    onChange?.(trimmed);
  };

  const reset = () => {
    clearEndingMnemonicOverride(key, romaji);
    setSelected(base.sound);
    setDraft(base.sound);
    setCustomMode(false);
    onChange?.(base.sound);
  };

  const isCustom = !base.options.includes(selected) && selected !== base.sound;

  return (
    <div
      className={
        className ??
        (compact ? "jp-particle-ending-mnemonic-card is-compact" : "jp-particle-ending-mnemonic-card")
      }
    >
      <div className="jp-particle-mn-meaning">
        <span className="jp-particle-mn-label">What it does</span>
        <span>{base.meaning}</span>
      </div>
      <div className="jp-particle-mn-sound">
        <span className="jp-particle-mn-label">Sound hook</span>
        <strong>{selected}</strong>
        <button
          type="button"
          className="jp-learn-mnemonic-edit"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Hide options" : "Options"}
        </button>
      </div>

      {open ? (
        <div className="jp-particle-mn-options">
          <div className="jp-particle-mn-option-list" role="listbox" aria-label={`Hooks for -${key}`}>
            {base.options.map((opt) => {
              const active = selected === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`jp-particle-mn-option ${active ? "is-active" : ""}`}
                  onClick={() => {
                    apply(opt);
                    setCustomMode(false);
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {!customMode ? (
            <button
              type="button"
              className="jp-learn-btn"
              onClick={() => {
                setCustomMode(true);
                setDraft(selected);
              }}
            >
              Write your own
            </button>
          ) : (
            <div className="jp-learn-edit-panel jp-learn-mnemonic-panel">
              <label htmlFor={`ending-mn-${key}`}>Your sound hook for -{key}</label>
              <textarea
                id={`ending-mn-${key}`}
                className="jp-learn-edit-panel textarea"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="jp-learn-row mt-2">
                <button
                  type="button"
                  className="jp-learn-btn jp-learn-btn-primary"
                  onClick={() => {
                    apply(draft);
                    setCustomMode(false);
                    setOpen(false);
                  }}
                >
                  Save hook
                </button>
                <button type="button" className="jp-learn-btn" onClick={() => setCustomMode(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {isCustom || getEndingMnemonicOverride(key, romaji) ? (
            <button type="button" className="jp-learn-btn" onClick={reset}>
              Reset to default
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}