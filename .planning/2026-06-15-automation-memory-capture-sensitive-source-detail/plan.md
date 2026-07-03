# Memory Capture sensitive source detail receipt

## Context

Automation 3 randomly selected `docs/features/memory_capture.md`. The real-user pass focused on a user who saves work source packets and cares that saved source evidence remains reviewable without exposing tokenized URLs.

`webpage-mcp` was unavailable because the native bridge socket was not running, so validation uses the repo extension/Playwright harness.

## Problem

Context Recall source-memory cards already hide sensitive source URLs, but the Source Memory detail page accepted any `http(s)` URL. A saved capsule with `?token=...`, `?code=...`, userinfo, or similar sensitive source data could show the raw URL and expose an `打开来源` action.

## Plan

1. Tighten the shared memory source-link safety helper so sensitive userinfo and query parameters are treated as hidden source links.
2. Make Source Memory detail use that helper for the header action and metadata display.
3. Show a clear boundary receipt when the raw source URL is hidden, while keeping host and saved content reviewable.
4. Extend the source-memory capsule E2E with a tokenized source URL case.
5. Update `docs/features/memory_capture.md` and run targeted verification.
