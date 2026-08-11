# L or R? — Cursor handoff kit

This package is designed to be copied into a new Cursor project or attached to Cursor Plan Mode.

## Student / Teacher Portal

See **[docs/PORTAL.md](docs/PORTAL.md)** for Auth.js + Postgres setup, env vars, and seed credentials.

| Route | Purpose |
| --- | --- |
| `/login` | Real credentials login |
| `/teacher` | Teacher dashboard (students, classes, lessons, files, homework) |
| `/portal` | Student My Desk |

Seed teacher (after `npm run db:seed`): `teacher@lrmastery.guru` / `TeacherTemp2026!`

Students are created by teachers (no public signup). Portal files use Blob prefix `portal-files/` — Mandarin studio (`studio-audio/`, `/api/studio/*`) is unchanged.

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
  - Record / upload → preview → **Save permanently** (primary). Uploads to **Vercel Blob** and updates a public override map so quiz, mahjong, review, and studio all play the new clip everywhere.  
  - Download named file remains a secondary backup. Browser-only IndexedDB copy is de-emphasized.  
  - This is the quality gate before trusting Mahjong Audio modes.

### Permanent audio overrides (Vercel)

Uploads require these **Production** env vars on the Vercel project:

| Variable | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | From Vercel → Storage → Blob (create a Blob store, link to this project). Required for permanent saves on production. |
| `MANDARIN_STUDIO_PASSWORD` | Password for Studio unlock + upload writes. |

**Dashboard steps if CLI cannot create Blob:**

1. Open the project on [vercel.com](https://vercel.com) → **Storage** → **Create Database** → **Blob**.
2. Link it to this project (Production).
3. Confirm `BLOB_READ_WRITE_TOKEN` appears under **Settings → Environment Variables**.
4. Set `MANDARIN_STUDIO_PASSWORD` (or keep the code fallback only for local testing).
5. Redeploy (`vercel --prod` or push to the production branch).

Without `BLOB_READ_WRITE_TOKEN` on Vercel, `POST /api/studio/audio` returns a clear **503** error (it will **not** silently fall back to IndexedDB). Locally (`next dev` without Vercel), uploads write under `public/audio/mandarin-vocab/` plus a local override JSON.

APIs:

- `POST /api/studio/audio` — multipart `audio` + `rank` + `filename`; auth via `password` field or `x-studio-password` header.
- `GET /api/studio/overrides` (or `GET /api/studio/audio`) — public override map `{ "0012": { url, filename, updatedAt } }`.

Playback order: override URL (`?v=updatedAt`) → else `/audio/mandarin-vocab/NNNN-word.mp3`.

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
