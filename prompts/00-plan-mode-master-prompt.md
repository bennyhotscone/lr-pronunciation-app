# Cursor Plan Mode master prompt

Read every file in this repository before proposing a plan, especially:

- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `src/data/pairs.ts`

We are building a mobile-first Next.js pronunciation app called **L or R?** for Japanese and Thai learners.

The supplied pair sequence is product-owner-approved. Do not remove, correct, deduplicate, reorder or replace any entry. Repetitions are intentional. The only authorised correction has already been made: `cloudy — crowded` was replaced by `cloud — crowd`.

The application must remain free for students and must not require a paid API. The MVP must keep recordings on the device, save progress in localStorage and use browser speech recognition only as an optional feature labelled **Experimental word recognition**.

Your current task is PLANNING ONLY.

Produce a concrete implementation plan that:

1. Audits the current repository and identifies what already exists.
2. Lists files to create or modify.
3. Breaks work into small, independently testable stages.
4. Specifies component boundaries, hooks, data flow and error states.
5. Includes mobile accessibility and microphone privacy requirements.
6. Includes verification commands and manual test cases after each stage.
7. Preserves a clean abstraction so experimental browser recognition can later be replaced with an on-device L/R classifier.
8. Does not add authentication, a database, payments, analytics, cloud storage or paid services.
9. Does not begin implementation until I approve the plan.

Be explicit about assumptions. Prefer the simplest robust architecture.
