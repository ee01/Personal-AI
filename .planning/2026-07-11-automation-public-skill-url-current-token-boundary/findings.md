# Public Skill URL Current Token Boundary Findings

## Repo Findings

- Random selection chose `Public Skill URL` from `docs/index.md` after excluding the freshest exact automation targets.
- `docs/features/personal_skill_foundry.md` is already current through 2026-07-10 for share receipts, copy receipts, preview receipts, secret-scan blocking, old token freshness, and unavailable button states.
- `src/modals/components/PersonalSkillsPage.vue` has the stable share-control helpers: `shareActionTitle`, `buildShareCopySnapshot`, `shareCopySuccessReceipt`, `sharePreviewReceipt`, and `skillShareReceiptRows`.
- Existing E2E coverage in `tools/verify-personal-skill-foundry-e2e.mjs` already asserts full token clipboard payloads, preview full URL, popup-blocked receipt, unavailable button title/ARIA, manual install copy, and stale copy receipt after token rotation.
- UX gap: enabled buttons only say the action uses a token and has no side effects. They do not expose the current active version, sha, and token tail before click, even though the post-click receipt records that snapshot.

## External Reference Findings

- Anthropic Agent Skills position skills as file/folder packages with instructions, scripts, and resources that agents load when relevant. That supports treating shared skill URLs as executable-supply-chain artifacts, not ordinary links.
- W3C Capability URLs guidance says possession of the URL grants access and that such URLs are hard to keep secret. That supports showing token-bearing status at the exact copy/open control.
- Macaroons research frames bearer credentials as delegable authorization objects whose scope should be confined by caveats. Personal AI does not yet expose caveated tokens here, so the UI should be explicit about current token and revoke limitations.
- The 2026 `Under the Hood of SKILL.md` paper describes semantic supply-chain risk in skill registry metadata and instructions. Public Skill URL should keep source/version/token snapshots visible before handing a skill to another agent.
- The constructive short-term improvement is not a new backend revocation flow in this sweep; it is making the already known version/token snapshot visible on the enabled buttons before the user copies, opens, or hands the URL to a manual-only platform.

Sources:

- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://www.w3.org/TR/capability-urls/
- https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/
- https://arxiv.org/abs/2605.11418
