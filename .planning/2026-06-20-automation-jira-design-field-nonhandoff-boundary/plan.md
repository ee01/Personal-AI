# Jira Design Field Non-Handoff Boundary Plan

## Target

- Random feature: `Figma/Zeplin 保守分类`
- Source doc: `docs/features/jira_design_links.md`
- Runtime surface: Jira Design Links content script and shared URL classifier

## Findings

- The normal description and remote-link scan already filters Figma Community/help/marketing and Zeplin marketing/profile/settings URLs.
- UX ticket design fields intentionally allow generic `http(s)` links for internal handoff URLs.
- Current classifier lets known non-handoff Figma/Zeplin URLs fall through to generic `Design link` when `allowGeneric=true`, so a plugin listing, docs page, profile, or settings page can occupy the handoff row.
- External scan confirms Figma/Jira and Zeplin/Jira integrations are built around attached design resources plus handoff status/update signals, not tool marketing/help/profile pages.
- Traceability research flags false positives and opaque candidate-link lists as developer review cost; this argues for filtering known non-handoff tool URLs before they become generic design candidates.

## Implementation Steps

1. Treat known Figma/Zeplin non-handoff URLs as terminal filtered results before generic fallback.
2. Preserve generic `http(s)` fallback for unknown/internal domains in UX ticket design fields.
3. Add focused verifier assertions for allow-generic Figma/Zeplin non-handoff paths.
4. Update the feature doc to state UX ticket design fields follow the same known-tool exclusion.
5. Validate with the Jira Design Links verifier, dev webpack compile, extension E2E, and scoped whitespace checks.
