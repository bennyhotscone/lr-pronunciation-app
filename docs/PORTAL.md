# Student / Teacher Portal

## Overview

Real Auth.js (credentials) + Postgres (Prisma) portal on top of the existing LR Mastery tools.

- Roles: `TEACHER` | `STUDENT`
- Access policy: **live membership** — ACTIVE class membership sees current class library; leaving removes class access; individual (`studentId`) items persist
- Portal files: Vercel Blob prefix `portal-files/…` (never `studio-audio/`)
- Mandarin studio APIs (`/api/studio/*`) are unchanged

## Online file storage (production)

Production portals upload/download **real** Blob objects — not a `public/portal-uploads` sandbox.

| Step | What happens |
| --- | --- |
| Teacher upload | `POST /api/portal/resources` or teacher server action → `uploadPortalFile` → Vercel Blob under `portal-files/{classOrStudentId}/…` → Postgres `Resource` row stores `blobPath` + `blobUrl` |
| Student / teacher open | UI links only to `/api/portal/resources/{id}/download` (never raw Blob URLs in the page) |
| Auth gate | Download route checks session + class membership / individual assignment (students) or uploader / class ownership (teachers), then streams bytes |
| Missing Blob token on Vercel | Upload returns **503** with a clear message — production **never** writes to the ephemeral filesystem |

The Blob store may be shared with Mandarin studio. Prefixes keep data separate:

- Portal: `portal-files/…`
- Studio: `studio-audio/…`

The linked store uses **public** CDN URLs (same as studio). Authorization still depends on the app: only listed/downloadable resources a user is allowed to see are returned. Prefer opening files via the download API rather than pasting `blobUrl` elsewhere.

### Storage modes

| Environment | `BLOB_READ_WRITE_TOKEN` | Behavior |
| --- | --- | --- |
| Vercel Production / Preview | set | Blob only |
| Vercel | missing | Fail loud (503) — no local fallback |
| Local `next dev` | set | Blob |
| Local `next dev` | missing | Writes under `public/portal-uploads/` for convenience only |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | Auth.js session signing secret |
| `AUTH_TRUST_HOST` | Recommended (`true`) | Trust host on Vercel |
| `BLOB_READ_WRITE_TOKEN` | **Required on Production** for portal uploads | Shared Blob store; portal writes only under `portal-files/` |
| `MANDARIN_STUDIO_PASSWORD` | Studio only | Unrelated to portal login |

## Seed teacher (local / after `npm run db:seed`)

| Field | Value |
| --- | --- |
| Email | `teacher@lrmastery.guru` |
| Password | `TeacherTemp2026!` |

Change this password after first login in production.

## Student accounts

Students do **not** self-signup in v1. Teachers create accounts from `/teacher` → **Add Student** (email, name, optional temp password). Share the temp password with the student; they log in at `/login` and land on `/portal` (My Desk).

## Key routes

| Route | Who |
| --- | --- |
| `/login` | Everyone |
| `/teacher` | Teacher dashboard |
| `/teacher/classes/[id]` | Enroll, lessons, files, homework |
| `/teacher/students/[id]` | Just-for-you assignments + goals |
| `/portal` | Student My Desk |
| `/portal/profile` | Preferred name + curated avatar |
| `/portal/lessons` | Lesson list |
| `/portal/resources` | File list |
| `/portal/goals` | Goals + DB progress |
| `/portal/diary` | Learning diary |
| `POST /api/portal/resources` | Teacher multipart upload |
| `GET /api/portal/resources/[id]/download` | Authenticated file stream |

## Local setup

```bash
npm install
# set DATABASE_URL + AUTH_SECRET in .env.local
npx prisma db push
npm run db:seed
npm run dev
```

## Prisma Postgres claim

If you used `npx create-db`, **claim the database before it expires**:

https://create-db.prisma.io/claim?projectID=proj_d6g83y9mw7zy52fxwngbfzhs

(Also check local `.env` / `.env.local` `CLAIM_URL` if present.) After claiming, keep the claimed `DATABASE_URL` on Vercel Production with `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, and `BLOB_READ_WRITE_TOKEN`.

## Smoke tests

```bash
npm run db:seed
node scripts/portal-e2e-seed.mjs      # DB path: class + lesson + files
node scripts/portal-http-e2e.mjs      # HTTP: login + middleware + My Desk
node scripts/portal-prod-files-e2e.mjs  # Production: Blob upload + auth download
```

Set `PORTAL_E2E_BASE=https://lrmastery.guru` (default in the prod files script) when verifying the live site.
