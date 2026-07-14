# Findings

## Repo State

- `AGENT.md` requires targeted tests, `npm start` until first successful compile, browser/E2E proof for extension UI, and scoped docs updates for user-visible feature changes.
- `docs/progressing/to-verify.md` is empty.
- Automation memory showed recent exact targets: Jira import secret re-entry and Memory Search channel receipt. The random sample included `Public Skill URL`; this is acceptable because the current gap is a narrow disabled-state presentation issue, not the earlier copy/preview success receipts.
- AppleScript did not list `Personal AI`; EventKit did. EventKit found 4 total reminders and all were completed historical Doubao/notification/test items, with no open Public Skill URL feedback.

## Current Feature Behavior

- Skill detail returns `share` only for active skills when `SkillLibraryService.ensureShareLink()` succeeds.
- `ensureShareLink()` scans the active version for secrets before returning a tokenized URL. On failure, `getSkill()` returns `shareError`.
- The binding tab currently disables `复制可访问 URL` and `打开预览` when `selectedSkill.share` is missing, and it shows `shareError` text when present.
- Gap: disabled action controls do not carry an explicit pre-click reason or no-effect boundary, so a user may see blocked buttons without knowing whether the share is not active yet, secret-scan blocked, or simply unavailable.

## External Research

- Anthropic Agent Skills docs/products position skills as reusable capability packages. Their public guidance emphasizes installing only from trusted sources and auditing bundled files, scripts, dependencies, and external network instructions before use.
- W3C Capability URL guidance frames possession of the URL as access to the resource and warns that URLs are hard to keep secret. This supports treating tokenized skill URLs as bearer credentials, not ordinary share links.
- Google/NDSS Macaroons research shows bearer credentials can be made safer when constrained by caveats. Personal AI currently uses plain token URLs; the UI should therefore be explicit about access scope, token freshness, and revocation boundaries.
- Recent skill supply-chain research and security writeups argue that `SKILL.md` content is operational agent context, not passive documentation. This supports surfacing secret-scan blocks and read-only/no-execution boundaries before copying or previewing a skill package.

## Implementation Notes

- Best scoped change: add computed helper text/title/aria labels for the share action buttons and add rows in `skillShareReceiptRows()` when no token URL is available.
- E2E can reuse the existing fixture by adding an active skill detail whose `share` is absent and `shareError` is set.
