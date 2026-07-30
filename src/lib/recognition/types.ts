export type RecognitionOutcome =
  | "idle"
  | "listening"
  | "target"
  | "other"
  | "unclear"
  | "unsupported"
  | "error";

export type RecognitionResultLabel =
  | "Target recognised"
  | "Other word recognised"
  | "Unclear"
  | "Recognition unavailable"
  | "Error"
  | "";

export function outcomeToLabel(outcome: RecognitionOutcome): RecognitionResultLabel {
  switch (outcome) {
    case "target":
      return "Target recognised";
    case "other":
      return "Other word recognised";
    case "unclear":
      return "Unclear";
    case "unsupported":
      return "Recognition unavailable";
    case "error":
      return "Error";
    default:
      return "";
  }
}

export interface WordRecognitionProvider {
  isSupported(): boolean;
  recognize(opts: {
    targetWord: string;
    otherWord: string;
    lang?: string;
    signal?: AbortSignal;
  }): Promise<Exclude<RecognitionOutcome, "idle" | "listening">>;
}
