# Sentence building after Block 5

Requirements capture only. **Do not implement** until the user has reviewed and signed off on the word lists.

## Gate before any coding

1. User reviews the **first 500** word list (blocks 1–10) and the **next 500** candidates (blocks 11–20).
2. User **signs off** on those lists.
3. Only after that approval may sentence-building UI or scoring be coded.

Until wordlist approval is explicit, leave this as a planning doc.

## Unlock conditions

Sentence practice unlocks only after the learner has completed:

- **5 vocab blocks** (blocks 1–5), **and**
- the **grammar section** (verb forms + essential particles)

## Vocabulary / grammar scope (v1)

- Draw **only** from blocks **1–5** vocab plus grammar already taught (basic verb forms, essential particles).
- Do **not** pull words from later blocks.
- Later: extend the same pattern to the **next 5 blocks** once those lists exist and are approved.

## Practice design

- Extensive **5-round** sentence-building (same round depth spirit as vocab practice, applied to building sentences).
- Prefer natural, useful sentences.
- **No unnecessary particles.**
- **No forced `watashi wa`** (or equivalent "always add subject" padding).

## Scoring

Score for:

- vocabulary (target words from blocks 1–5)
- basic verb form
- essential particles (when the prompt requires them)

Do **not** score word order — order does not matter for correctness.

Use **lenient spelling** (accept reasonable typos / romanization variants consistent with existing Japanese practice).

## Explicit non-goals (until approved)

- No sentence-building UI implementation in this pass.
- No wiring into `JapaneseLearningApp` until wordlist sign-off.
- No expansion past blocks 1–5 until the next lists are ready and approved.