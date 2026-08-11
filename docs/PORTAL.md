# Student / Teacher / Admin Portal

## Overview

Real Auth.js (credentials) + Postgres (Prisma) portal on top of the existing LR Mastery tools.

- Roles: `ADMIN` | `TEACHER` | `STUDENT` — **one account = one role**
- Access policy: **live membership** — ACTIVE class membership sees current class library; leaving removes class access; individual (`studentId`) items persist
- Portal files: Vercel Blob prefix `portal-files/…` (never `studio-audio/`)
- Mandarin studio mutating APIs require an authenticated **ADMIN** session

## Roles & login redirects

| Role | Powers | After login |
| --- | --- | --- |
| **ADMIN** | Everything a teacher can do + Mandarin Studio audio file management + create TEACHER accounts | `/teacher` (Admin badge) |
| **TEACHER** | Classes, students, lessons, files, homework, goals, classroom posts — **not** studio audio overrides | `/teacher` |
| **STUDENT** | My Desk, profile/avatar, class materials, comment/reply on classroom posts | `/portal` |

Role is set when the account is created (or by admin). There is no dual-role account.

### Studio auth (clean approach)

- `/english-for-mandarin-speakers/studio` and `POST`/`DELETE` `/api/studio/audio` require an **authenticated ADMIN session**
- Shared `MANDARIN_STUDIO_PASSWORD` is **no longer** the primary gate (optional legacy tooling may still reference it; the live UI and routes use admin session)
- Teachers and students are redirected away from studio

## Seed admin

| Field | Value |
| --- | --- |
| Email | `teacher@lrmastery.guru` |
| Password | `TeacherTemp2026!` |
| Role | **ADMIN** |

Change this password after first login in production. Teachers created from the admin dashboard stay `TEACHER`.

## Classroom posts + pin

- Model: `ClassPost` (classId, authorId, title, body, `pinnedAt?`, attachments)
- Comments: `ClassPostComment` (nested reply via `parentId`)
- Teacher/Admin: create + **Pin / Unpin** (pinned sort first)
- Students: see posts on My Desk; can comment/reply
- Server-side membership / class ownership checks on all mutations

## Session basket (honest MVP)

On the teacher class page:

- Toggle **Session basket ON**
- Drag-drop or browse files → uploaded to `portal-files/session-basket/{userId}/`
- Select items and attach when saving a **lesson** or **class post**
- Persists for the current calendar day in `localStorage` + Blob

**Does:** catch files you deliberately drop/pick during a session.  
**Does not:** intercept all OS downloads from a website alone (that needs a browser extension or desktop helper later).

UI copy: “Drop files here during the session. Auto-catching all computer downloads needs a helper app later.”

## Online file storage (production)

Production portals upload/download **real** Blob objects — not a `public/portal-uploads` sandbox.

| Step | What happens |
| --- | --- |
| Teacher upload | `POST /api/portal/resources` or teacher server action → `uploadPortalFile` → Vercel Blob under `portal-files/{classOrStudentId}/…` → Postgres `Resource` row |
| Student / teacher open | UI links only to `/api/portal/resources/{id}/download` (never raw Blob URLs in the page) |
| Auth gate | Download route checks session + membership / ownership, then streams bytes |
| Missing Blob token on Vercel | Upload returns **503** — production **never** writes to the ephemeral filesystem |

Prefixes:

- Portal: `portal-files/…`
- Session basket: `portal-files/session-basket/{userId}/…`
- Studio: `studio-audio/…`

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
| `MANDARIN_STUDIO_PASSWORD` | Optional / legacy | Studio primary auth is now ADMIN session |

## Student accounts

Students do **not** self-signup in v1. Staff create accounts from `/teacher` → **Add Student**. Share the temp password; they log in at `/login` and land on `/portal` (My Desk).

## Key routes

| Route | Who |
| --- | --- |
| `/login` | Everyone |
| `/teacher` | ADMIN + TEACHER |
| `/teacher/classes/[id]` | Enroll, posts, pin, lessons, files, homework, session basket |
| `/teacher/students/[id]` | Just-for-you assignments + goals |
| `/portal` | Student My Desk |
| `/portal/profile` | Preferred name + curated avatar |
| `/english-for-mandarin-speakers/studio` | **ADMIN only** |
| `POST /api/portal/resources` | Staff multipart upload |
| `POST /api/portal/session-basket` | Staff session-basket upload |
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

## Landing gateways

Order (left → right / top → bottom on mobile):

1. **Student Portal** (binder-open animation; labels: Student Portal / My Desk)
2. **Vocabulary & Grammar Games**
3. **Pronunciation Practice**
