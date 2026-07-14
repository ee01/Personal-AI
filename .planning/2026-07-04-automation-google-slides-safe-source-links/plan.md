# Google Slides Analyzer safe source links

## Target

- Selected feature: `Google Slides 项目分析器` from `docs/features/index.md`.
- Skip reason for earlier random candidates: recent automation runs already touched Project Dashboard, Quick Ask, Glip markers, Relationship Radar, Memory Lens, Compose Assist, and User Profile export.
- Reminder check: AppleScript did not list `Personal AI`; EventKit found 4 completed historical Doubao / notification items and no open Google Slides Analyzer feedback.

## Research signal

- Gemini in Slides keeps generated content in a preview / insert flow and exposes sources before users apply output.
- Google Slides `batchUpdate` validates requests before applying them and applies valid batches atomically, so source and writeback boundaries should remain close to the submit path.
- NB2Slides / slide-creation research argues for human-AI collaboration rather than full automation, which supports visible provenance and conservative source handling.

## Improvement plan

1. Keep safe Jira source URLs clickable when they are ordinary `http(s)` links.
2. Render credential-bearing, tokenized, signed, auth/session, or non-`http(s)` source URLs as plain Jira keys.
3. Add a visible `链接已隐藏` boundary so users know the link was intentionally blocked, not lost.
4. Update E2E coverage with a tokenized Jira URL fixture and assert it does not create an anchor.
5. Update `docs/features/google_slides_analyzer.md` with the current behavior.

## Verification target

- `npm run verify:google-slides-analyzer`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:google-slides-analyzer:e2e`
- Scoped `git diff --check`
