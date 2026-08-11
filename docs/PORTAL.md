# Student / Teacher Portal

## Overview

Real Auth.js (credentials) + Postgres (Prisma) portal on top of the existing LR Mastery tools.

- Roles: `TEACHER` | `STUDENT`
- Access policy: **live membership** — ACTIVE class membership sees current class library; leaving removes class access; individual (`studentId`) items persist
- Portal files: Vercel Blob prefix `portal-files/…` (never `studio-audio/`)
- Mandarin studio APIs (`/api/studio/*`) are unchanged

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | Auth.js session signing secret |
| `AUTH_TRUST_HOST` | Recommended (`true`) | Trust host on Vercel |
| `BLOB_READ_WRITE_TOKEN` | Prod uploads | Shared Blob store; portal writes only under `portal-files/` |
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

## Local setup

```bash
npm install
# set DATABASE_URL + AUTH_SECRET in .env.local
npx prisma db push
npm run db:seed
npm run dev
```

## Prisma Postgres claim

If you used `npx create-db`, open the printed **claim URL** (see local `.env` `CLAIM_URL`) before the deletion date so the database becomes permanent, then put the (claimed) `DATABASE_URL` on Vercel Production along with `AUTH_SECRET` and `AUTH_TRUST_HOST=true`.

Also set `BLOB_READ_WRITE_TOKEN` on Vercel so teacher uploads go to Blob under `portal-files/` (local dev falls back to `public/portal-uploads/` when the token is missing).

## Smoke tests

```bash
npm run db:seed
node scripts/portal-e2e-seed.mjs   # DB path: class + lesson + files
node scripts/portal-http-e2e.mjs   # HTTP: login + middleware + My Desk
```
