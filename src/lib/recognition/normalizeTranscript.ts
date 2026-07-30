export function normalizeTranscript(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ");
}

export function matchPairWords(
  transcript: string,
  targetWord: string,
  otherWord: string,
): "target" | "other" | "unclear" {
  const normalised = normalizeTranscript(transcript);
  if (!normalised) return "unclear";

  const target = normalizeTranscript(targetWord);
  const other = normalizeTranscript(otherWord);

  const tokens = normalised.split(" ");
  const exactTarget = normalised === target || tokens.includes(target);
  const exactOther = normalised === other || tokens.includes(other);

  if (exactTarget && !exactOther) return "target";
  if (exactOther && !exactTarget) return "other";
  return "unclear";
}
