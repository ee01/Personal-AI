# Memory Capture Selection Pre-Review Receipt

## Goal

Improve `选中文字保存为资料记忆` so the first visible selection-save entry says the selected text is not written yet and clicking opens review first, without changing source-memory write semantics.

## Selected Feature

- Feature: `选中文字保存为资料记忆`
- Capability: Memory Capture
- Source doc: `docs/features/memory_capture.md`
- Code path: `src/contentScriptWebIntelligence.ts`, `src/background.ts`, `memory-service/src/core/SourceMemoryCaptureService.ts`

## Plan

1. Complete repo, memory, Reminder, docs, and code inspection. Status: complete.
2. Refresh external product and research grounding for selection/highlight saving. Status: complete.
3. Implement a pre-review receipt on the selected-text `+ 记住` dock. Status: complete.
4. Update existing Memory Capture E2E assertions for the new first-visible boundary. Status: complete.
5. Update canonical feature docs without over-detailing. Status: complete.
6. Verify with source checks, focused Memory Capture harnesses, dev compile, E2E, and scoped whitespace checks. Status: complete.

## External Grounding

- Notion Web Clipper and Readwise Reader frame clipping/highlighting as a deliberate save action with destination/notes.
- Hypothesis distinguishes highlights/annotations anchored to a selected passage and keeps visibility explicit.
- Zotero Connector preserves source URL/access-date/snapshot expectations.
- KFTF and PIM research support keeping source context and the "why saved" trail for re-finding later.

## Implementation Decision

Do not alter backend candidate scoring, auto-save thresholds, or source-memory storage. The issue is presentation: selected-text dock default copy lags behind the whole-page dock, which already says `未写入 · 先复核`.

## Verification Target

- `node --check desktop-app/scripts/webpage-memory-detection-check.mjs`
- `npm run verify:webpage-memory-detection`
- `npm start -- --progress`, stop after first successful compile
- `npm run verify:webpage-memory-detection:e2e`
- Scoped `git diff --check`

## Errors Encountered

None so far.

## Verification Results

- `node --check desktop-app/scripts/webpage-memory-detection-check.mjs`: passed.
- `npm run verify:webpage-memory-detection`: passed.
- `npm start -- --progress`: compiled successfully once in 15.939s, then stopped.
- `npm run verify:webpage-memory-detection:e2e`: passed.
- `npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts`: passed 17/17.
- Scoped `git diff --check`: passed.
- `pgrep -fl "webpack.*webpack\\.dev\\.cjs"`: no watcher remained.
