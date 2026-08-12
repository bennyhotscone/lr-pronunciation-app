# Portal status (2026-08-11)

## Roles

| Role | Account | Landing |
|------|---------|---------|
| ADMIN | `teacher@lrmastery.guru` (seed) | `/teacher` + Studio |
| TEACHER | Created by admin on dashboard | `/teacher` |
| STUDENT | `/signup` or staff-created | `/portal` |

Password (seed): `TeacherTemp2026!` — change in production.

## How to create a teacher

1. Admin login: https://lrmastery.guru/login → https://lrmastery.guru/teacher
2. **Invite a teacher** form on that page (not public signup)
3. Teacher logs in at `/login` — no Studio access

Admin already teaches without a second account.

## Features shipped

- Student self-signup + forgot/reset password (DB tokens; Resend when configured)
- Classroom posts + pin/unpin + student comments
- Session basket MVP (drag-drop; not OS download interception)
- Dark sand professional chrome + viking-inspired LR mark
- Landing order: Portal → Games → Pronunciation (binder open animation; no “trapper keeper” copy)
- Studio gated to ADMIN session

## Live URLs

- Home: https://lrmastery.guru/
- Login: https://lrmastery.guru/login
- Student signup: https://lrmastery.guru/signup
- Forgot password: https://lrmastery.guru/forgot-password
- Teacher/Admin: https://lrmastery.guru/teacher
- Student My Desk: https://lrmastery.guru/portal
- Studio (admin): https://lrmastery.guru/english-for-mandarin-speakers/studio

## Database

Agent-managed Prisma Postgres. **Ignore any create-db “Claim your database” browser link** — it is broken/misleading.

If the DB expires: `node scripts/provision-prisma-db.mjs --vercel` (fresh DB + seed + Vercel sync + prod deploy). Optional permanent DB later via Vercel marketplace Prisma Postgres (free plan), not via claim URLs.
