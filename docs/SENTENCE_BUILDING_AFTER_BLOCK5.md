# Sentence building after Block 5

Requirements capture only. **Do not implement** until the user has reviewed and signed off on the word lists.

## Gate before any coding

1. User reviews the **first 500** word list (blocks 1-10) and the **next 500** candidates (blocks 11-20).
2. User **signs off** on those lists.
3. Only after that approval may sentence-building UI or scoring be coded.

Until wordlist approval is explicit, leave this as a planning doc.

## Unlock conditions

Sentence practice unlocks only after the learner has completed:

- **5 vocab blocks** (blocks 1-5), **and**
- the **grammar section** (verb forms + essential particles)

## Prompt / generation principle

When generating sentence prompts (LLM or curated lists), prefer the **highest-frequency spoken English sentences and phrases** someone would actually say, that can be expressed with **only** the unlocked vocab pool (e.g. blocks 1-5) plus essential grammar already taught (verb forms, essential particles).

- Base prompts on what an LLM would judge as the most common everyday English sentences/phrases expressible from that pool.
- **Not** random grammar drills or artificial constructions built just to exercise a form.
- Aim for natural things people actually say in conversation.
- Still constrained: every target must be sayable with **only** unlocked vocab + essential grammar — no leaking later-block words.

## Vocabulary / grammar scope (v1)

- Draw **only** from blocks **1-5** vocab plus grammar already taught (basic verb forms, essential particles).
- Do **not** pull words from later blocks.
- Later: extend the same pattern to the **next 5 blocks** once those lists exist and are approved.

## Practice design

- Extensive **5-round** sentence-building (same round depth spirit as vocab practice, applied to building sentences).
- Prefer natural, useful, high-frequency spoken sentences/phrases (see generation principle above).
- **No unnecessary particles.**
- **No forced `watashi wa`** (or equivalent "always add subject" padding).

## Scoring

Score for:

- vocabulary (target words from blocks 1-5)
- basic verb form
- essential particles (when the prompt requires them)

Do **not** score word order — order does not matter for correctness (order-agnostic).

Use **lenient spelling** (accept reasonable typos / romanization variants consistent with existing Japanese practice).

## Explicit non-goals (until approved)

- No sentence-building UI implementation in this pass.
- No wiring into `JapaneseLearningApp` until wordlist sign-off.
- No expansion past blocks 1-5 until the next lists are ready and approved.
