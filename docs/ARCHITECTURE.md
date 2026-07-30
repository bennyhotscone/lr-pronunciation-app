# Architecture

## Stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- Browser MediaRecorder API
- Web Audio API where needed
- localStorage for MVP progress
- Web Speech API only as an experimental optional recogniser
- Future: ONNX/Transformers.js or another browser-compatible on-device model

## Suggested source structure

```text
src/
  app/
    page.tsx
    learn/page.tsx
    practice/page.tsx
    progress/page.tsx
    layout.tsx
    globals.css
  components/
    AppHeader.tsx
    LanguageSelector.tsx
    PairCard.tsx
    ListenButton.tsx
    Recorder.tsx
    RecordingPlayback.tsx
    RecognitionResult.tsx
    ProgressSummary.tsx
  data/
    pairs.ts
  hooks/
    useAudioRecorder.ts
    useSpeechRecognition.ts
    useLocalProgress.ts
  lib/
    speech.ts
    storage.ts
    pair-utils.ts
  types/
    speech-recognition.d.ts
    progress.ts
```

## State

For the MVP, use React state plus localStorage. Avoid a global state library unless complexity genuinely requires it.

## Audio privacy

- Request microphone access only after a user action.
- Stop all media tracks when recording finishes or errors.
- Revoke object URLs when replaced or unmounted.
- Do not upload recordings.
- Do not retain recordings after page reload.

## Speech-recognition abstraction

Expose a small interface:

```ts
type RecognitionStatus =
  | "idle"
  | "listening"
  | "target"
  | "other"
  | "unclear"
  | "unsupported"
  | "error";
```

Keep browser-specific recognition logic in one hook so it can later be replaced by an on-device model.

## Accessibility

- Keyboard-operable controls.
- Visible focus.
- Large touch targets.
- Text labels in addition to icons.
- Status messages announced with an `aria-live` region.
- Do not use colour as the only signal.

## Testing priorities

- Pair sequence and duplicate preservation.
- `cloud — crowd` is present.
- Microphone permission denial.
- Automatic recording stop.
- Track cleanup.
- localStorage recovery.
- Unsupported speech-recognition browser.
- Mobile layout.
