Implement listening-discrimination practice.

Requirements:
- Randomly choose the left or right word from the current pair
- Speak it without revealing which word was selected
- Show two answer buttons
- Randomise visual button order while preserving answer correctness
- Give immediate feedback
- Allow replay
- Track total attempts and correct answers in localStorage
- Advance only when the learner chooses to continue
- Avoid race conditions from repeated Listen presses
- Include an aria-live result announcement
- Do not modify the canonical pair data

Run lint and build and manually verify several repeated pairs.
