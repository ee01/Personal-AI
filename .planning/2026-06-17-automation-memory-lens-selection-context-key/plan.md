# Memory Lens Selection Context Key Plan

## Target

- Feature: `Memory Lens / 划词查找关联记忆`
- Doc: `docs/features/memory_lens.md`
- Scope: selected-text context recall on webpages.

## Findings

- `docs/progressing/to-verify.md` is `暂无。`.
- Local Reminders is readable, but there is no `Personal AI` list.
- Current selected-text recall uses the selected text, page title, and URL in the context key.
- Nearby paragraph text is sent as background context, but it is not part of the key. On a page with repeated text in different sections, the second selection can reuse the first result instead of re-querying.

## Plan

1. Include nearby selection context in the selected-text context key so identical text in different page sections gets a fresh recall request.
2. Add an E2E regression with two identical selected phrases in different paragraphs and assert the second selection sends a new `selected_text` request with the second paragraph as background.
3. Update the Memory Lens feature doc with the user-facing behavior.
4. Run targeted unit/helper checks, dev build, E2E, and scoped whitespace checks.
