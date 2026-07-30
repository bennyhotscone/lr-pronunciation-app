"use client";

import type { LearnerLanguage } from "@/types/progress";

const options: {
  value: LearnerLanguage;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  { value: "ja", label: "Japanese", hint: "JA tips", emoji: "🇯🇵" },
  { value: "th", label: "Thai", hint: "TH tips", emoji: "🇹🇭" },
  { value: "other", label: "Other", hint: "General tips", emoji: "🌍" },
];

type Props = {
  value: LearnerLanguage;
  onChange: (value: LearnerLanguage) => void;
  disabled?: boolean;
};

export function LanguageSelector({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold text-foreground">
        Who are you practising for?
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`touch-target flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-center transition ${
                selected
                  ? "border-accent bg-gradient-to-br from-accent-soft to-white text-accent shadow-md shadow-accent/15"
                  : "border-border bg-surface text-foreground hover:border-accent/40"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <input
                type="radio"
                className="sr-only"
                name="learner-language"
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              <span aria-hidden="true" className="text-xl">
                {option.emoji}
              </span>
              <span className="text-sm font-bold">{option.label}</span>
              <span className="text-xs font-medium text-muted">{option.hint}</span>
              <span className="sr-only">
                {selected ? "selected" : "not selected"}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
