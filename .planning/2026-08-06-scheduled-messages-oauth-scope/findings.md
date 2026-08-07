# Scheduled Messages OAuth Scope Findings

## Requirements

- Scheduled Messages should request only the Google scopes it needs.
- First-time One Click Setup should retain the complete Google scope request.
- Update other Google authorization callers consistently.
- Improve token/scope-loss detection and recovery.
- Preserve all unrelated dirty worktree changes.

## Prior Browser And Documentation Evidence

- The live Google consent page showed both Google Slides and Google Sheets as additional, unchecked permissions.
- The existing eight grants covered Drive file access, Apps Script capabilities, and identity data, but not full Sheets or Slides access.
- The consent OAuth client matched the client in the current `dist/manifest.json`.
- Chrome Identity supports per-call `scopes`; these override manifest scopes for that request.
- Chrome returns `grantedScopes`, and Google requires apps to handle partial grants.
- Chrome manages access-token caching and expiration; the extension does not persist a separate Slides refresh token.

## Technical Findings

- `src/utils/googleAuth.ts` currently returns only a token string and discards `grantedScopes` and silent failure details.
- `ScheduledMessagesManager` treats every silent failure as an expired authorization.
- `OneClickSetup` intentionally uses `forceRefresh: true`; this must remain full-scope but should validate the result.
- The worktree already contains unrelated edits to `ScheduledMessagesManager.tsx` and `src/manifest.json`; edits must be minimal and merge-safe.
- Authorization callers fall into four practical contracts:
  - Sheets-only: Scheduled Messages CRUD/background markers/auto-reply/config sync/schema/Jira rule sync and Jira query helpers.
  - Slides-only: popup/background Slides analysis and `slide.ts` compatibility helpers.
  - Identity-only: Scheduled Messages user-name lookup.
  - Setup/admin: One Click Setup needs the complete manifest scope set by explicit user request; App Script update needs Sheets plus Apps Script scopes, but not Slides, Drive-file creation, or identity scopes.
- Passing `scopes` to `chrome.identity.getAuthToken` overrides manifest scopes for that request. A smaller request does not revoke a previously broader server-side grant; it only obtains a token limited to the requested set. Therefore feature-scoped calls should not cause re-consent when those scopes are already granted.
- Current `@types/chrome` is old (`^0.0.193`) and types only the callback token string. Runtime Chrome supports a second callback argument with granted scopes, so the helper needs a narrow compatibility type rather than a broad dependency upgrade that could destabilize unrelated files.
- Existing `SheetSchemaUpdater.checkAndAutoUpdate` and updater APIs accept a token callback; their call sites should pass a correctly scoped helper rather than changing updater service interfaces.

## Resources

- https://developer.chrome.com/docs/extensions/reference/api/identity
- https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions

## Implemented Outcome

- Shared auth now has canonical scope constants for Sheets, Slides, identity, App Script admin, and full setup.
- Per-call scopes override the manifest list; requested scopes are validated against `grantedScopes` when Chrome exposes them.
- Partial cached tokens are not used. On an explicit user authorization action, the unusable access-token cache entry is removed before the interactive retry so Google can request the missing scope.
- Scheduled Messages initialization and recovery use structured results and explain the real failure instead of claiming every failure is expiration.
- Scheduled Messages and its background CRUD/config/marker/auto-reply paths request Sheets only.
- Slides analysis requests Slides only; identity lookup requests identity only; App Script update requests its admin set; One Click Setup requests the full manifest set.
- Sheets API scope errors are distinguished from ordinary 403 file-access errors.
- A focused extension E2E proved that a Slides-only partial grant leads to a Sheets-only interactive retry and no Slides request from Scheduled Messages.
