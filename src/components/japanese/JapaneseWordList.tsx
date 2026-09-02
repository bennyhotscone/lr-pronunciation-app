"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveWord } from "@/lib/japanese/engine";
import { playWordAudio } from "@/lib/japanese/tts";
import { buildPlayAudioDebug, getMnemonic, getPronunciationCue, getAudioText } from "@/lib/japanese/word-helpers";
import type { JapaneseWord } from "@/lib/japanese/types";
import {
  resetJapaneseWordOverrideField,
  saveJapaneseWordOverride,
  type JapaneseProgressPayload,
  type JapaneseWordStatSnapshot,
} from "@/lib/japanese-actions";
import { JapaneseWordNuance } from "./JapaneseWordNuance";

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
};

export function JapaneseWordList({
  blockNumber,
  words,
  overrides,
  wordStats = {},
  onOverrideChange,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    mnemonic: "",
    pronunciationCue: "",
    ttsInput: "",
  });
  const [pending, startTransition] = useTransition();

  const knownCount = useMemo(
    () => Object.values(wordStats).filter((stat) => stat.known).length,
    [wordStats],
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

  return (
    <section>
      <p className="jp-learn-sub">
        Reference list for Block {blockNumber}. Training progressively removes the mnemonic, romaji
        and multiple-choice support. Known words ({knownCount}/{words.length}) are skipped in round retries but still appear in milestone story tests. Tap Edit to customize your memory hooks and audio cues - saved
        to your account only.
      </p>
      <div className="jp-learn-wordgrid mt-4">
        {words.map((w, i) => {
          const resolved = resolveWord(w, i, overrides[i]);
          const isEditing = editingIndex === i;
          return (
            <article key={i} className="jp-learn-word">
              <div className="jp-learn-meta">{String(i + 1).padStart(3, "0")}</div>
              <div className="jp-learn-jp">{w.jp}</div>
              <div className="jp-learn-romaji">{resolved.displayRomaji}</div>
              <div className="jp-learn-english">{w.en}</div>
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
    </section>
  );
}
