# Product specification

## Working name

**L or R?**

## Purpose

A mobile-first pronunciation trainer that helps Japanese and Thai learners hear and produce English /l/ and /r/, including initial sounds, consonant clusters and longer words.

## Primary users

- Japanese learners who may substitute an alveolar tap for both English sounds.
- Thai learners who may merge L/R in some contexts, omit cluster consonants or insert a vowel inside clusters.
- ESL teachers assigning focused pronunciation practice.

## Core principles

1. Train listening before judging speaking.
2. Compare the learner against the two words in the current pair.
3. Do not penalise accent features that do not reduce intelligibility.
4. Never describe basic browser transcription as phoneme-accurate AI.
5. Keep recordings on the device in the first release.
6. No login, payment or database in the MVP.
7. Student progress is stored locally.
8. Repeated pairs remain in the supplied lesson sequence.

## MVP screens

### Home

- App title and concise explanation.
- Learner-language selection: Japanese, Thai or Other.
- Start/continue button.
- Privacy notice: recordings remain on the device in MVP.

### Learn

- Current pair.
- Listen button for each word.
- Short physical articulation instructions.
- Japanese/Thai learner-specific tip.
- Previous and next navigation.

### Listening discrimination

- Play one word.
- Student chooses the word heard.
- Immediate correctness feedback.
- Randomise left/right button placement without changing the pair itself.

### Speaking practice

- Show a target word.
- Record up to three seconds.
- Stop early option.
- Playback.
- Experimental word-recognition check when supported.
- Clear unavailable/error state when unsupported.

### Progress

- Completed attempts.
- Listening accuracy.
- Words repeatedly confused.
- Reset progress control.

## MVP scoring language

Use:
- Target recognised
- Other word recognised
- Unclear
- Recognition unavailable

Do not show invented precision percentages in Version 1.

## Later pronunciation-AI phase

- Run an on-device audio model through WebGPU or WebAssembly.
- Compare L, R, tap-like, deleted-consonant, inserted-vowel and unclear classes.
- Keep the model interface isolated behind a provider abstraction.
- Do not redesign the UI when replacing the experimental recogniser.
