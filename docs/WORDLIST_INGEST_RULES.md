# Japanese wordlist ingest rules (HARD CONSTRAINTS)

Angry-user constraints. Read before touching any Japanese vocab JSON/CSV.

## LOCKED: blocks 1–5 (words 1–250)

- **Never modify** blocks 1–5 / the first 250 words unless the user **explicitly** says to.
- Do not “fix”, reorder, re-gloss, re-audio, or regenerate those entries as a side effect of later-list work.
- New material starts at **word 251+** (block 6 onward).

## New lists (251+)

- User will supply new wordlists for later words. Ingest carefully; do not overwrite locked data.
- Prefer additive updates to later blocks / proposed files only.
- Keep ids/order stable once shipped unless the user asks for a reshuffle.

## Audio checklist (every new word)

Web Speech misreads raw kanji (e.g. `mita` → “mama”, `tabenai` → “shoku”). Every new word **must** have correct kana for TTS.

Per word, before ship:

1. **romaji** (`r`) — correct romanization
2. **jp script** (`jp`) — display form (kanji/kana as appropriate)
3. **audio field** — hiragana and/or katakana suitable for TTS (not kanji-only)
4. **`getAudioText(word)`** — must be non-empty after ingest
5. **Pipeline only** — use the working vocab TTS path:
   - `getAudioText` / romaji→katakana normalization / `playWordAudio`
   - Never feed raw kanji-only strings that Web Speech will misread
6. Spot-check playback for conjugations and common traps

## Regression (must stay correct)

Sample TTS text for these patterns must remain correct after any ingest:

| Pattern | Expectation |
|---------|-------------|
| `miru` / `mita` | kana-based TTS (not “mama” / kanji misread) |
| `taberu` / `tabenai` | kana-based TTS (not “shoku” / kanji misread) |

If `getAudioText` regresses on these, **stop and fix audio** before merging wordlist changes.

## Do not

- Touch blocks 1–5 JSON/CSV unless explicitly asked
- Ship a word with empty `audio` / empty `getAudioText`
- Bypass helpers and pass kanji-only text straight to Web Speech
