# Memory Capture API No-Write Receipt Findings

## Current Behavior

- Candidate scoring already returns `policyReceipt`, so ignored / blocked candidates can be explained before the user opens a save request.
- Successful capsule creation, details, note updates, duplicate saves, and dismiss calls return `writeReceipt` / `actionReceipt`.
- `POST /source-memory/capsules` validation failures still returned only `{ error }`, so callers could not show the same structured no-write boundary when a save request was rejected.

## UX Gap

When a user clicks save and the request is rejected for a sensitive source URL or low-signal content, a raw error does not tell them whether a partial capsule was created, whether a `web` recall signal was written, or whether anything synced externally.

## Chosen Fix

Return `noWriteReceipt` with `blocked_no_write` or `invalid_no_write` from capsule creation validation errors. The receipt includes source kind, capture mode, scope, source, no capsule created, no recall/search signal written, and a next step.

## Non-Goals

- No scoring threshold changes.
- No persistence/dedupe/distillation changes.
- No frontend UI rewrite.
- No external sync or memory deployment.

