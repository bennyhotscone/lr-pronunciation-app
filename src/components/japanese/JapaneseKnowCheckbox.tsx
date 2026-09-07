"use client";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (known: boolean) => void;
  id?: string;
};

/** Explicit Know / Don't know control (source of truth for JapaneseWordStat.known). */
export function JapaneseKnowCheckbox({ checked, disabled, onChange, id }: Props) {
  const inputId = id ?? "jp-know-word";
  return (
    <label className="jp-know-checkbox" htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>I know this</span>
    </label>
  );
}
