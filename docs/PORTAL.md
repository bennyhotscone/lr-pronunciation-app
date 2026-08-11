# Portal model (Google Classroom–like)

## Plain English

| Concept | Meaning |
| --- | --- |
| **Classroom** | One shared space for a teacher + a group of students. Stream, lessons, and a Files shelf. |
| **Invite** | Students join with **code / link / QR**. Teachers do **not** create student emails/passwords. |
| **Stream post** | Announcement on the classroom board (pinnable; students can comment). |
| **Lesson** | One session writeup for that teaching session, with optional **sub-entries** + file attachments. |
| **Files** | Class materials live on the classroom Files shelf and on My Desk so students can reopen downloads at home. |

Individual “just-for-you lessons” are **not** the classroom product. Teaching happens inside a **Classroom** board.

## Teacher / admin login

Public `/signup` is **STUDENT only**. Seed admin already teaches.

1. https://lrmastery.guru/login — `teacher@lrmastery.guru` / `TeacherTemp2026!`
2. Lands on `/teacher`. Invite staff under **Invite a teacher** if needed.

## Teacher click-path

1. Log in → create **classroom** (name only)  
2. Copy **invite code** / link / QR  
3. Post to **Stream** (pin optional); write a **Lesson** + sub-entries; upload **Files**  
4. Students appear after they join — open a student for **goals/checklists**; remove from class if needed  

## Student click-path

1. Sign up / log in as student  
2. https://lrmastery.guru/portal/join — enter code (or open `/join/CODE`)  
3. Classroom: **Stream**, **Lessons**, **Files** (+ My Desk lists the classroom)  

## Goals

- Teacher adds goals + checklist steps on the student page.  
- Student sees them on Goals; **only teacher can tick steps**.

## Lesson summary & info tags (free)

- Each lesson shows a **Summary** built from the teacher’s summary text (or title + sub-entries). No LLM, **$0**.
- **Info tags** on a lesson are clickable. Students see matching classroom posts/files/lessons plus free links (Wikipedia, Wiktionary, Simple English, British Council, YouGlish). No API keys.


```bash
node scripts/classroom-golden-path.mjs https://lrmastery.guru
```

Form-POST join + student sees post/lesson/file + teacher sees student.

## Prisma claim (if DB expires)

https://create-db.prisma.io/claim?projectID=proj_d6g83y9mw7zy52fxwngbfzhs
