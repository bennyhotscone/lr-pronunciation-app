"use client";

type Props = {
  /** true = known, false = needs practice. null/undefined = not chosen yet when `requireChoice`. */
  checked: boolean | null;
  disabled?: boolean;
  onChange: (known: boolean) => void;
  id?: string;
};

/**
 * Explicit Know / Need practice control (source of truth for JapaneseWordStat.known).
 */
export function JapaneseKnowCheckbox({ checked, disabled, onChange, id }: Props) {
  const baseId = id ?? "jp-know-word";
  return (
    <div
      className="jp-know-choice"
      role="group"
      aria-label="Do you know this word?"
      id={baseId}
    >
      <button
        type="button"
        id={`${baseId}-know`}
        className={`jp-know-choice-btn${checked === true ? " jp-know-choice-btn-active jp-know-choice-btn-know" : ""}`}
        disabled={disabled}
        aria-pressed={checked === true}
        onClick={() => onChange(true)}
      >
        I know this
      </button>
      <button
        type="button"
        id={`${baseId}-practice`}
        className={`jp-know-choice-btn${checked === false ? " jp-know-choice-btn-active jp-know-choice-btn-practice" : ""}`}
        disabled={disabled}
        aria-pressed={checked === false}
        onClick={() => onChange(false)}
      >
        I need to practice this
      </button>
    </div>
  );
}
