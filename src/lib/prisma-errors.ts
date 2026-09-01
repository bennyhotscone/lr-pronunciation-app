/** True when Prisma reports a missing table/column (migration not applied yet). */
export function isPrismaSchemaMissingError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return code === "P2021" || code === "P2022";
}