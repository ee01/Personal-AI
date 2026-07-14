# Task Plan: Memory Lens Page Recall Receipt

## Goal
Improve the passive Memory Lens right-bottom card so users can see which current-page signal produced the related-memory hint after they open the card, without changing recall ranking, write behavior, feedback, or site controls.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, and `docs/features/index.md`.
- [x] Randomly select a non-fresh feature target from the index.
- [x] Check local Reminders `Personal AI` with AppleScript plus EventKit fallback.
- [x] Inspect Memory Lens docs, source, and existing E2E verifier.

### Phase 2: Research And UX Decision
- [x] Review comparable product and research references for page-context, permission, citation, and RAG transparency patterns.
- [x] Choose one bounded UX improvement that does not need user decisions.
- [x] Record concise findings and source links.

### Phase 3: Implementation
- [x] Add a compact passive `页面召回回执` to the Expanded Card.
- [x] Pass current-page recall context into the passive card for current and cached recall paths.
- [x] Update the existing webpage-memory E2E assertions.
- [x] Update canonical Memory Lens docs and feature index.

### Phase 4: Verification
- [x] Run syntax/static checks for touched verifier/source where useful.
- [x] Run `npm run verify:webpage-memory-detection`.
- [x] Run `npm start -- --progress` until the first successful compile, then stop it.
- [x] Run `npm run verify:webpage-memory-detection:e2e`.
- [x] Run scoped `git diff --check`.

### Phase 5: Closeout
- [x] Update planning progress and automation memory.
- [x] Mark Reminder done only if a related open item existed.
- [x] Summarize changed files and verification evidence.

## Decisions Made

| Decision | Rationale |
|---|---|
| Target `记忆提示右下角关联记忆` under Memory Lens | Random viable sample, not one of the freshest exact automation-memory targets. |
| Add context receipt inside Expanded Card | Direct-click users can bypass Hover Peek, so the opened card should also explain the page-context basis. |
| Keep change presentation-only | Existing recall and feedback contracts already work; the gap is user understanding of why the passive hint appeared. |
