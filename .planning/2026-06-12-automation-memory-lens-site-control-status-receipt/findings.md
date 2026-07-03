# Findings

## Repo Findings

- `docs/features/memory_lens.md` already documents passive-only site controls, local storage keys, Options management, conflict cleanup, and card-menu/toast receipts.
- `src/contentScriptWebIntelligence.ts` already enforces passive suppression before context recall and page/visual memory capture evaluation. It also clears active passive bubbles when storage changes suppress the current page.
- Card-menu site controls already disclose passive scope, active selection search availability, and non-effects such as no delete/sync/external send.
- `src/options.tsx` manages allowlist mode, allowed sites, temporary mutes, permanent site blocks, and page path blocks. It currently has a compact count summary plus one-line action messages, but no persistent status receipt that explains the current global mode and boundary.

## External Research

- Chrome extension permission docs recommend optional/runtime permission patterns when possible, because permissions exist to limit compromise blast radius and help users make informed access decisions.
- Microsoft Edge Copilot exposes page-context use as a permission/preferences boundary: browsing context can be used only when relevant and users can disable context clues separately from personalization/memory.
- Google Chrome quiet-notification research supports low-interruption controls that reduce unwanted prompts while preserving user agency.
- Browser privacy-extension research found that privacy extensions often improve awareness by showing what is detected/blocked and offering blocking controls; users need controls plus understandable state, not hidden behavior.

## Product Direction

The smallest useful improvement is not another blocking rule. It is a persistent Options-page status receipt that names:

- active mode: default vs allowlist-only
- what passive surfaces are governed
- which blocker currently takes precedence
- what remains available
- what will not happen

This keeps the existing autonomous Lens behavior while making the control state auditable.
