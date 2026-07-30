Implement private on-device microphone recording.

Requirements:
- Request permission only when Record is pressed
- Use `navigator.mediaDevices.getUserMedia`
- Use `MediaRecorder`
- Stop automatically after three seconds
- Permit early stop
- Display recording state and countdown
- Provide playback after recording
- Stop every media track after completion, cancellation or error
- Revoke old object URLs
- Handle permission denied, no device and unsupported browser states
- Do not upload, persist or transmit audio
- Put logic in a reusable typed `useAudioRecorder` hook
- Add a visible privacy note

Run lint and build. Report the browser test procedure.
