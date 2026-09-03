# Cursor implementation prompt: LRMastery Japanese Particle Round

Use the attached `lrmastery_grammar_after_block3_prototype_v4.html` as the working reference. It is already functioning reasonably well. Do not rebuild the whole UI from scratch. Adapt the existing LRMastery Japanese learner so this particle practice becomes an integrated round/block using the learner's existing mastered vocabulary and progress system.

## What this particle round is

- A practical **sentence-building round for spoken Japanese particles**.
- It is NOT a conventional grammar course and should not require memorising grammar terminology.
- The learner sees an English meaning/prompt and builds the natural Japanese sentence by tapping words/particles in sequence.
- Use vocabulary the learner has already mastered/unlocked. Do not introduce random new lexical items just to make an exercise.
- The core learning goal is to feel which particle belongs between already-known words.
- Keep Japanese conversational and short. Do not force subjects/topics that Japanese would normally omit.
- In particular, do **not** automatically translate English `I`, `you`, `he`, etc. as `watashi wa`, `anata wa`, etc.
- `wa` is not "to be". It is a topic marker. It should be taught only when it actually adds a topic/contrast, not inserted mechanically because English has a subject.
- `ga` should likewise not be added mechanically. Prioritise particles that immediately help build useful spoken sentences.

## Particle order / initial functions

Teach ONE practical use at a time. Do not dump every meaning of a particle at once.

1. `o` = object of an action
   - pattern: THING + `o` + ACTION
   - `mizu o nomu` = drink water
   - `niku o taberu` = eat meat

2. `ni` = TO a destination
   - pattern: PLACE + `ni` + MOVEMENT
   - `gakkou ni iku` = go to school
   - `mise ni iku` = go to the shop

3. `de` = place where an action happens
   - pattern: PLACE + `de` + ACTION
   - `ie de taberu` = eat at home
   - contrast explicitly with destination `ni`: `gakkou ni iku` vs `gakkou de taberu`

4. `no` = possession / relationship
   - pattern: X + `no` + Y
   - `watashi no hon` = my book
   - `tomodachi no ie` = friend's house

5. `to` = WITH someone
   - pattern: PERSON + `to` + ACTION
   - `tomodachi to iku` = go with a friend
   - `Harper to biriyaado shitai` = want to play billiards with Harper

Later, once these are solid, add separate narrow-function blocks for:
- `to` = and between nouns
- `ni` = existence/location with `iru/aru`
- `mo` = also/too
- `kara` = from
- `made` = until/to
- `e` = toward/direction
- `ka` = question marker where useful
- `wa` = topic/contrast
- `ga` = subject/focus/existence subject

Do not make `wa` and `ga` early prerequisites for ordinary sentence building.

## Core round interaction

Create a **sequential multiple-choice sentence builder**.

Example prompt:
`I go to school.`

Tile pool (roughly 8–12 options):
`gakkou` `mise` `ni` `de` `o` `to` `iku` `kuru` `taberu` `miru`

Correct tapped sequence:
`gakkou` → `ni` → `iku`

NOT:
`watashi` → `wa` → `gakkou` → `ni` → `iku`

Requirements:
- Selected tiles appear in a sentence area in tap order.
- Tapping a selected tile removes it.
- Include Clear and Check controls.
- Distractors must be plausible competitors, especially competing particles and verbs. Avoid random junk distractors.
- After a correct answer, automatically play the Japanese sentence audio.
- Then advance to the next item without requiring the learner to press a separate audio button first.
- Keep romaji central. Japanese script may be shown as support, but never make Japanese-script reading/writing necessary to pass.

## Cumulative grammar

Once a particle has been learned, mix it with previously learned verb forms and particles.

Examples:
- `sushi o tabetai` = want to eat sushi
- `ie de sushi o tabetai` = want to eat sushi at home
- `ie de sushi o tabetakunai` = don't want to eat sushi at home
- `ashita mise de sushi o tabetai` = want to eat sushi at the shop tomorrow
- `tomodachi to mise ni iku` = go to the shop with a friend

The system should become cumulative rather than resetting to isolated grammar every block.

## Verb-form interaction

The latest grammar prototype also teaches useful verb meanings together. Preserve that approach.

Do not create standalone tests for labels such as "te-form" or "connector form". The user cares about communicative meanings, e.g.:
- `taberu` = eat
- `tabenai` = don't eat
- `tabeta` = ate
- `tabenakatta` = didn't eat
- `tabetai` = want to eat
- `tabetakunai` = don't want to eat
- `tabetakatta` = wanted to eat
- `tabeteru` = eating / is eating
- `taberareru` = can eat
- `tabeyou` = let's eat

If a grammatical form is only useful as machinery inside another expression, teach the useful expression rather than asking the learner to identify the grammar label.

## Vocabulary constraint

- Pull sentence content from the learner's unlocked/mastered vocabulary.
- Grammar particles and transformed verb forms are allowed as the new learning target.
- Prefer words already in the existing Japanese blocks.
- Do not silently expand the vocabulary list during grammar practice.

## Answer handling

For typed romaji rounds, normalise:
- case
- surrounding punctuation
- repeated/extra spaces
- common romaji variants where they are genuinely equivalent
- long-vowel spelling variants where appropriate

Allow more than one natural answer when Japanese genuinely permits multiple conversational renderings. Do not mark a shorter natural omitted-subject sentence wrong merely because a more explicit sentence also exists.

## UI / integration

- Preserve the visual style and interaction model of the attached v4 prototype where practical.
- Do not create a second unrelated app inside LRMastery.
- Refactor prototype data into the project's existing block/round architecture rather than copying a monolithic HTML page verbatim.
- Reuse existing LRMastery audio/TTS and progress/account infrastructure if available.
- Keep the prototype's automatic audio-on-correct behaviour.
- Make it work well on mobile/touch screens.
- Keep feedback short and useful.
- Avoid grammar jargon unless it helps explain an immediately useful distinction.

## Acceptance examples

These should be accepted as natural target answers:
- `gakkou ni iku` → go to school
- `mise de kau` → buy at the shop
- `mizu o nomu` → drink water
- `tomodachi to iku` → go with a friend
- `Harper to biriyaado shitai` → want to play billiards with Harper

The system should NOT require:
- `watashi wa gakkou ni iku`
- `watashi wa Harper to biriyaado shitai`
when the subject is obvious and omitted Japanese is natural.

## Attached reference

`lrmastery_grammar_after_block3_prototype_v4.html`

Treat it as a behavioural/UI reference and source of working exercise logic. Integrate/refactor it into the actual LRMastery codebase rather than simply embedding the standalone HTML as an iframe.
