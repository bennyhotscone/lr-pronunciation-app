Add optional browser speech recognition as an explicitly experimental check.

Requirements:
- Create typed support for `SpeechRecognition` and `webkitSpeechRecognition`
- Encapsulate it in `useSpeechRecognition`
- Listen for one short utterance
- Normalise transcript case and surrounding punctuation
- Compare only with the target word and the other word in the current pair
- Results: Target recognised, Other word recognised, Unclear, Recognition unavailable, Error
- Label the feature `Experimental word recognition`
- Explain that it is not phoneme-level scoring
- Do not invent a percentage or confidence score
- Recording and recognition controls must not compete for microphone access
- Hide or disable the feature cleanly on unsupported browsers
- Keep the API isolated for replacement by a future on-device classifier

Run lint and build.
