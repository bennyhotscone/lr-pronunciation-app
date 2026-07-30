# On-device L/R classifier (future design)

This document describes how the Experimental on-device word check can later be
replaced with a purpose-trained pronunciation classifier without redesigning
the Practice UI.

It does **not** claim that any pretrained model already available in this
repository can reliably distinguish English /l/, /r/, tap-like substitutions,
deleted consonants, or inserted vowels. No classifier weights ship with the MVP.

## Current provider boundary

The app isolates recognition behind:

- `src/lib/recognition/types.ts` — `WordRecognitionProvider`, `RecognitionOutcome`
- `src/lib/recognition/onDeviceWhisperProvider.ts` — current local Whisper adapter
- `src/lib/recognition/browserSpeechProvider.ts` — retained legacy Web Speech adapter
- `src/hooks/useSpeechRecognition.ts` — React wrapper
- `src/components/RecognitionResult.tsx` — outcome labels only

The current Whisper Tiny check is free and keeps recorded audio in the browser.
It performs open-vocabulary transcription and then compares the transcript with
the known pair. It is not a phoneme classifier and must remain labelled
Experimental.

UI consumers must keep using:

| Outcome | Student-facing label |
| --- | --- |
| `target` | Target recognised |
| `other` | Other word recognised |
| `unclear` | Unclear |
| `unsupported` | Recognition unavailable |
| `error` | Error |

Do not invent percentage scores in the student UI.

## Proposed provider interface extension

Keep `WordRecognitionProvider.recognize()` as the stable entry point. Optionally
extend the return payload later (still mapped to the same five student labels):

```ts
type ClassifierDetail = {
  outcome: "target" | "other" | "unclear" | "unsupported" | "error";
  classes?: Array<{
    label:
      | "L"
      | "R"
      | "tap-like"
      | "deleted-consonant"
      | "inserted-vowel"
      | "unclear";
    score: number; // internal only
  }>;
};
```

Internal class scores may drive coaching copy; they must not be shown as fake
accuracy percentages.

## Audio preprocessing

1. Capture short mono PCM from `MediaRecorder` / `AudioContext` (reuse the
   existing recorder blob; do not upload).
2. Resample to the model’s expected rate (commonly 16 kHz).
3. Trim leading/trailing silence with a simple energy gate.
4. Peak-normalise; reject clips that are too quiet or clipped.
5. Optional: extract log-mel spectrogram frames in WASM if the model expects
   features rather than raw waveform.

All steps run in the browser. Discard buffers after inference.

## Runtime: WebGPU with WebAssembly fallback

- Prefer WebGPU (`navigator.gpu`) for ONNX Runtime Web or Transformers.js when
  available.
- Fall back to WASM (SIMD if present) on older phones.
- On complete failure, return `unsupported` and keep recording/playback usable.
- Cap concurrent model loads; show a one-time “Loading on-device check…” state.

## Model loading and caching

- Host a small static model asset with the app (or Cache Storage after first
  visit). No paid API.
- Use content hashes for cache busting.
- Lazy-load only when the learner opens Experimental recognition (or a future
  “On-device check” control).
- Budget: aim for a few MB quantized weights so mid-range phones remain usable.

## Constrained pair comparison

The classifier must not grade open vocabulary. For each attempt:

1. Know `targetWord` and `otherWord` from the current pair.
2. Map model classes to which member of the pair is more likely, or `unclear`.
3. Prefer forced choice between the two lexical items over free transcription.

Example mapping:

- Strong L evidence + target starts with L-like onset → `target` or `other`
  depending on which word matches.
- Tap-like / deleted / inserted-vowel / low confidence → `unclear` (optionally
  with coaching detail internally).

## Output classes (internal)

| Class | Meaning |
| --- | --- |
| L | Lateral-like onset/gesture |
| R | Approximant-like English /r/ |
| tap-like | Single brief contact (common JA transfer) |
| deleted-consonant | Cluster member missing |
| inserted-vowel | Epenthesis inside cluster |
| unclear | Low confidence / noise / silence |

## Japanese and Thai feedback mapping

Keep coaching text in `src/data/guidance.ts` (or a sibling map). Examples:

- JA + tap-like → remind learner to hold /l/ or /r/ instead of tapping.
- TH + deleted-consonant → remind learner to keep both consonants in clusters.
- inserted-vowel → slow the cluster, then remove the extra vowel.

Do not shame accent features that still leave the pair intelligible when the
constrained comparison says `target`.

## Privacy

- Mic access only after a user gesture.
- Stop tracks and revoke object URLs after use (already required in MVP).
- No upload of audio, embeddings, or transcripts.
- No analytics SDK required for inference.

## Device constraints

- Detect low memory / missing WebGPU and stay on WASM or disable with a clear
  message.
- Avoid blocking the main thread: run inference in a Worker when practical.
- Time out long inferences and return `error` / `unclear`.

## Training-data requirements (future work)

To build a trustworthy model you would need:

- Recordings of JA and TH learners plus reference speakers.
- Labels for pair identity and the internal classes above.
- Balanced coverage of initial, cluster, and longer-word items from the
  canonical sequence (including intentional repeats as separate practice items,
  not merged classes).
- Held-out speakers for evaluation.

Until that evidence exists, marketing copy must not claim phoneme-accurate AI.

## Evaluation metrics

- Pair forced-choice accuracy (target vs other) on held-out speakers.
- Confusion rates for tap-like / deletion / epenthesis when labelled.
- False-confident rate: how often `target`/`other` is returned when humans mark
  unclear.
- Latency p50/p95 on mid-range Android and iOS browsers.
- Failure rate falling back to `unsupported`.

## Staged rollout

1. Keep local Whisper behind the provider interface as the Experimental check.
2. Train and ship a small pair-aware classifier only after it beats Whisper on
   a held-out learner dataset.
3. Shadow-mode: run the classifier without showing results; log only local
   anonymised counters if ever needed (optional; default is no logging).
4. Replace the Whisper provider when forced-choice quality beats it on the
   internal eval set for JA/TH speakers.
5. Add richer coaching from internal classes without changing
   `RecognitionResult` labels.

## Non-goals

- Server-side ASR
- Paid speech APIs
- Account systems or cloud audio stores
- Student-facing confidence percentages in v1 of the classifier UI
