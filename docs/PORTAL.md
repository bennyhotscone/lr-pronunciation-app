# Portal model (Google Classroom–like)

## Plain English

| Concept | Meaning |
| --- | --- |
| **Classroom** | One shared space for a teacher + a group of students. Stream (announcements), daily diary, and a Files shelf. |
| **Invite** | Students join with **code / link / QR**. Teachers do **not** create student emails/passwords. |
| **Stream post** | Announcement on the classroom board (pinnable; students can comment). |
| **Day’s diary** | One parent writeup for that calendar day, with optional **sub-entries** (topics, notes, homework bits) + file attachments. |
| **Files** | Class materials live on the classroom Files shelf and on My Desk so students can reopen downloads at home. |

`Lesson` in the old schema is **not** what you open as a “classroom”. Teaching happens inside a **Classroom** board.

## Create a teacher account?

Public `/signup` is **STUDENT only**. Seed admin already teaches.

1. https://lrmastery.guru/login — `teacher@lrmastery.guru` / `TeacherTemp2026!`
2. Lands on blackboard `/teacher` (Admin). Invite staff under **Invite a teacher** if needed.

## Teacher click-path (today)

1. Log in → https://lrmastery.guru/login  
2. https://lrmastery.guru/teacher → **Create your classroom** (name only)  
3. On the classroom board: copy **invite code**, **link** (`/join/CODE`), or show **QR**  
4. Post to **Stream** / pin; write **Today’s diary** + sub-entries; upload **Files**  
5. Students appear under Students after they join  

## Student click-path

1. Open invite link https://lrmastery.guru/join/CODE **or** https://lrmastery.guru/join  
2. **Sign up** (or log in) as student  
3. Join completes → https://lrmastery.guru/portal/classrooms/[id]  
4. Use **Stream**, **Class diary**, and **Files** (also listed on My Desk / All files)

## Goals & checklist accountability

- Teachers add goals on a student page, with optional checklist steps (one per line).
- Students see goals + checklist on **My Desk → Goals** and can leave notes.
- **Only teachers/admins can tick checklist items.** Progress % updates from ticks automatically.

## Prisma claim (if DB expires)

https://create-db.prisma.io/claim?projectID=proj_d6g83y9mw7zy52fxwngbfzhs
