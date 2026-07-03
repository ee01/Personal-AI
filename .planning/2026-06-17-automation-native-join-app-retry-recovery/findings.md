# Native Join Findings

## Repo Findings

- `docs/progressing/to-verify.md` is `暂无。`, so there is no carry-over verification item.
- The worktree is already heavily dirty. Scope changes to Native Join files and this planning directory.
- Current Native Join already supports trusted `v.ringcentral.com` parsing, Safe Links / redirect unwrap, passcode-hidden browser display, `Join in browser`, `Copy link`, copy-failure manual reveal, and reversible default preference.
- Current recovery state says the app did not take over and keeps browser recovery visible, but it does not offer a direct app retry path from the panel.

## External References

- RingCentral positions browser join as a no-download fallback across common desktop browsers, which supports keeping web recovery visible even when native app handoff is preferred.
- Zoom documents a configurable `Join from your browser` fallback after the meeting link flow, supporting the product pattern of preserving browser entry when app join is unavailable.
- Microsoft Teams user reports show real cases where `Open Teams app` can fail while the web page still offers `Continue on this browser` and another app-open option. This supports an explicit retry action instead of only one native attempt.
- USENIX Security 2017 deep-link measurement found URI schemes and app links can have hijacking and verification weaknesses, so this change must not loosen host or parameter validation.
- Android deep-link security guidance emphasizes validation and allowlists for incoming deep-link data, reinforcing that retry should reuse the already-validated target instead of parsing a new untrusted URL.

## Improvement Decision

Add `Try app again` only after recovery state, not during the initial app-prompt window. Retrying will relaunch the already-validated native URL, reset the handoff timers, update the receipt, and keep browser/copy fallback available.
