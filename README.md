# L or R? — Cursor handoff kit

This package is designed to be copied into a new Cursor project or attached to Cursor Plan Mode.

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
