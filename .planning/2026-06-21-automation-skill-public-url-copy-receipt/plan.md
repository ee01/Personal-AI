# Public Skill URL Copy Receipt Plan

## Target

- Random feature: `Public Skill URL`
- Capability: `Skill Foundry`
- Source doc: `docs/features/personal_skill_foundry.md`
- Reminder check: local Reminders was reachable, but there is no `Personal AI` list, so no Reminder item is included or completed.

## Research Notes

- OpenAI GPT sharing and publishing separates private, link, workspace, and public exposure; public/action-backed sharing carries extra policy and data-handling requirements.
- Anthropic Claude Skills packages instructions, metadata, scripts, and resources as reusable agent capabilities, which makes sharing a skill closer to handing another agent a capability package than sharing a plain note.
- Current Agent Skills security research frames creation, distribution, deployment, and execution as separate attack surfaces; a copied tokenized skill URL should therefore be presented as a read credential, not as installation or execution.
- MCP and remote-tool integration docs reinforce the same boundary: connection/read capability, tool execution, and external writes must be separately governed.

## UX Problem

The binding tab already explains that the visible short URL is not the accessible token URL, and the share receipt says the public URL is read-only. However, the actual `Copy accessible URL` and platform instruction copy buttons had no persistent result receipt. As a user, after clicking copy it was still easy to wonder whether the clipboard contains the short display URL, the token URL, an install command, or whether Personal AI triggered sync/install side effects.

## Implementation Plan

1. Add a binding-tab copy receipt that appears after copying the accessible URL or a platform install command.
2. Make success copy state explicit: clipboard contains the complete token URL or an install command containing that token URL, not the display short URL.
3. Make non-effects explicit: copying only writes local clipboard and does not open links, install skills, trigger platform sync, write external platforms, or execute scripts.
4. Show a failure receipt when the browser does not confirm clipboard write.
5. Update `docs/features/personal_skill_foundry.md` and the feature index.
6. Extend `tools/verify-personal-skill-foundry-e2e.mjs` to click both copy paths, assert clipboard payloads, and assert receipt copy.
7. Verify with the skills API regression test, `npm start` first successful compile, Skill Foundry E2E, scoped whitespace check, and watcher cleanup.
