# L or R? — Cursor handoff kit

This package is designed to be copied into a new Cursor project or attached to Cursor Plan Mode.

## Mandarin course tools (live site)

- **Quiz:** `/english-for-mandarin-speakers`
- **Mahjong Solitaire (English ↔ 中文):** `/english-for-mandarin-speakers/mahjong`  
  Frequency batches of 50 (ranks 1–50, then 51–100). Group 2 unlocks after all of group 1 is mastered in-browser. INDEX PDF has lemmas only — Chinese glosses in `src/data/mandarin-vocab.ts` are curated study glosses.
- **Public audio review:** `/english-for-mandarin-speakers/review`  
  Draft-length flags only; not a claim that clips are pedagogically good.
- **Audio Studio (password):** `/english-for-mandarin-speakers/studio`  
  - Prefer env `MANDARIN_STUDIO_PASSWORD` on Vercel.  
  - Fallback password (change it): see `STUDIO_PASSWORD_FALLBACK` in `src/lib/studio-progress.ts` (default `lrmastery-studio`).  
  - First **50** frequency words: batch filters (1–10 … 41–50), play, **OK / Needs addressing / unmarked**, notes.  
  - Notes / status persist in **localStorage**; use Export/Import JSON.  
  - Record / upload → **preview**, then **download** a correctly named `NNNN-word.ext` file. Optional IndexedDB copy for same-browser replay.  
  - Vercel cannot persist writes into `public/` — commit replacements into `public/audio/mandarin-vocab/`.  
  - This is the quality gate before trusting Mahjong Audio modes.

## What is fixed

- The app is for Japanese and Thai learners of English.
- It teaches and tests English L/R pronunciation.
- It must be free for students.
- It must not require a paid speech API.
- The complete supplied pair sequence must remain.
- Repeated pairs are intentional.
- The only word-list correction is `cloudy — crowded` → `cloud — crowd`.
- Version 1 may use browser speech recognition as an explicitly experimental check.
- The architecture must leave room for a later on-device phoneme classifier.

## Recommended workflow

1. Create a fresh Next.js project.
2. Add this entire kit to the repository.
3. Open Cursor Plan Mode.
4. Paste `prompts/00-plan-mode-master-prompt.md`.
5. Tell Cursor to inspect all files before proposing its plan.
6. Review the proposed plan.
7. Move to Agent Mode and use the staged prompts in numerical order.
8. Run and test after every stage.

## New project command

```bash
npx create-next-app@latest lr-pronunciation-app
cd lr-pronunciation-app
npm run dev
```

Choose TypeScript, ESLint, Tailwind, App Router and `src/`.

## Important rule for Cursor

Do not ask Cursor to build the custom pronunciation model in the first pass. First finish the interface, audio capture, listening activities, local progress and experimental recognition.
