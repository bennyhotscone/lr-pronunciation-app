/** Durable classroom file baskets (not the same as Resource.category scope tags). */
export const MATERIAL_KINDS = ["INFO", "EXERCISE"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  INFO: "Explanations/Notes",
  EXERCISE: "Exercises/Activities",
};

export function parseMaterialKind(raw: unknown): MaterialKind {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (v === "EXERCISE" || v === "EXERCISES" || v === "ACTIVITY" || v === "ACTIVITIES") {
    return "EXERCISE";
  }
  return "INFO";
}

export function materialKindLabel(kind: MaterialKind | string | null | undefined): string {
  const k = parseMaterialKind(kind);
  return MATERIAL_KIND_LABELS[k];
}

/** Write mode (overlay text boxes / homework submit) is only for Exercises/Activities. */
export function allowsPdfWriteMode(kind: MaterialKind | string | null | undefined): boolean {
  return parseMaterialKind(kind) === "EXERCISE";
}

export function groupByMaterialKind<T extends { materialKind?: string | null }>(
  items: T[],
): { kind: MaterialKind; label: string; items: T[] }[] {
  const buckets: Record<MaterialKind, T[]> = { INFO: [], EXERCISE: [] };
  for (const item of items) {
    buckets[parseMaterialKind(item.materialKind)].push(item);
  }
  return (MATERIAL_KINDS as readonly MaterialKind[])
    .map((kind) => ({
      kind,
      label: MATERIAL_KIND_LABELS[kind],
      items: buckets[kind],
    }))
    .filter((g) => g.items.length > 0);
}
