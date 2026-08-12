"use client";

import { useState } from "react";
import {
  MATERIAL_KIND_LABELS,
  type MaterialKind,
  parseMaterialKind,
} from "@/lib/material-kind";

const OPTIONS: { value: MaterialKind; hint: string }[] = [
  {
    value: "INFO",
    hint: "Explanation, notes, reference sheets",
  },
  {
    value: "EXERCISE",
    hint: "Worksheets, practice, activities",
  },
];

type Props = {
  name?: string;
  value?: MaterialKind;
  defaultValue?: MaterialKind;
  onChange?: (kind: MaterialKind) => void;
  /** Compact inline for per-file basket rows */
  compact?: boolean;
  idPrefix?: string;
};

/** Two-way choice: Information vs Exercises & activities. */
export function MaterialKindPicker({
  name = "materialKind",
  value,
  defaultValue = "INFO",
  onChange,
  compact = false,
  idPrefix = "material-kind",
}: Props) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<MaterialKind>(() =>
    parseMaterialKind(defaultValue),
  );
  const selected = parseMaterialKind(controlled ? value! : internal);

  function choose(kind: MaterialKind) {
    if (!controlled) setInternal(kind);
    onChange?.(kind);
  }

  return (
    <fieldset className={compact ? "min-w-0" : "space-y-2"}>
      {!compact ? (
        <legend className="text-xs font-bold uppercase tracking-wide text-muted">
          File basket
        </legend>
      ) : null}
      <div
        className={compact ? "flex flex-wrap gap-1" : "grid gap-2 sm:grid-cols-2"}
        role="radiogroup"
        aria-label="File basket"
      >
        {OPTIONS.map((opt) => {
          const id = `${idPrefix}-${opt.value}`;
          const checked = selected === opt.value;

          if (compact) {
            return (
              <label
                key={opt.value}
                htmlFor={id}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[0.7rem] font-bold ring-1 transition ${
                  checked
                    ? opt.value === "EXERCISE"
                      ? "bg-[#1f4e46] text-white ring-[#1f4e46]"
                      : "bg-desk-accent text-white ring-desk-accent"
                    : "bg-[#f3f2ee] text-ink ring-border hover:ring-desk-accent/50"
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={name}
                  value={opt.value}
                  className="sr-only"
                  checked={checked}
                  onChange={() => choose(opt.value)}
                />
                {MATERIAL_KIND_LABELS[opt.value]}
              </label>
            );
          }
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition ${
                checked
                  ? opt.value === "EXERCISE"
                    ? "border-[#1f4e46] bg-[#1f4e46]/10 ring-1 ring-[#1f4e46]/40"
                    : "border-desk-accent bg-desk-accent/10 ring-1 ring-desk-accent/40"
                  : "border-border bg-background hover:border-desk-accent/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  id={id}
                  type="radio"
                  name={name}
                  value={opt.value}
                  className="h-4 w-4"
                  checked={checked}
                  onChange={() => choose(opt.value)}
                />
                <span className="text-sm font-bold text-ink">
                  {MATERIAL_KIND_LABELS[opt.value]}
                </span>
              </span>
              <span className="pl-6 text-xs text-muted">{opt.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MaterialKindBadge({
  kind,
}: {
  kind: MaterialKind | string | null | undefined;
}) {
  const k = parseMaterialKind(kind);
  const exercise = k === "EXERCISE";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide ${
        exercise
          ? "bg-[#1f4e46]/15 text-[#1f4e46] ring-1 ring-[#1f4e46]/30"
          : "bg-desk-accent/15 text-desk-accent ring-1 ring-desk-accent/30"
      }`}
    >
      {MATERIAL_KIND_LABELS[k]}
    </span>
  );
}
