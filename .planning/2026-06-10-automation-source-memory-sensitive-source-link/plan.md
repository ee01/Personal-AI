# Source Memory sensitive source-link receipt plan

## Target

- Random feature: `Source Memory 召回卡片`
- Canonical docs: `docs/features/memory_capture.md`, with Memory Lens rendering in `src/contentScriptWebIntelligence.ts`

## Gap

Memory Lens already normalizes the current page URL before sending it to Memory Service, but source links returned on a `source_memory` card only pass the `http(s)` protocol check. A saved source URL containing credentials or sensitive query parameters can therefore be rendered as a clickable source while the card still says the saved source is checkable.

## Plan

1. Harden `sanitizeContextExternalUrl()` so card source links reject URLs with userinfo or sensitive query parameters and strip low-value tracking parameters.
2. Extend the focused guard verifier with safe source-link, credentialed source-link, sensitive query, and tracking-query cases.
3. Add a browser fixture proving a `source_memory` card with a sensitive source still shows the capsule detail receipt but hides the raw source URL.
4. Update `docs/features/memory_capture.md` with the source-link privacy boundary.
5. Validate with the Memory Lens/source-memory verifier path, first successful dev compile, and diff checks.
