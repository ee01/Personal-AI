# Memory Lens Expanded Card Findings

## Initial Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the freshest runs already covered Memory Capture API, Evidence Watch, Notification Center, Today Pilot popup, Agent Thinking, Relationship Radar, Agent Workflow, Topic Messages, Scheduled Messages, Project Dashboard, Doubao, Native Join, and other adjacent surfaces.
- EventKit found `Personal AI` Reminders with 4 total items and 0 incomplete items. Completed historical items are Doubao / Notification feedback and not related to Memory Lens expanded cards.
- The worktree is broadly dirty from prior automation runs; do not revert or stage unrelated changes.

## Selected Feature

- Feature: `记忆提示 Expanded Card`
- Capability: Memory Lens
- Source doc: `docs/features/memory_lens.md`
- Index description: `完整卡片、反馈、来源`

## Research Notes

- [OpenAI Memory FAQ](https://help.openai.com/articles/8590148-memory-faq) describes Memory Sources as visible context used to personalize responses, and keeps user controls for saved memories / chat history explicit.
- [Slack AI Trailhead](https://trailhead.salesforce.com/content/learn/modules/slack-ai/get-to-know-slack-ai) says AI search draws from Slack data the user has access to and uses citations to source material.
- [Notion Enterprise Search security and privacy](https://www.notion.com/help/enterprise-search-security-and-privacy-practices) says queries respect permissions in each connected app; [Notion Enterprise Search](https://www.notion.com/product/enterprise-search) frames connected-app search as permission-filtered across Slack, Drive, Jira, GitHub, and other tools.
- CHI 2025 RAG trust/transparency work (`10.1145/3706599.3719985`) emphasizes trust, transparency, and control for high-stakes retrieval surfaces.
- The HCINLP 2025 user-control survey argues that end users need control over transparency, privacy, and accuracy properties of trustworthy LLM systems.
- Product implication: Memory Lens Expanded Card should expose source/permission/write boundaries at the exact clickable controls: source links, memory-detail links, and feedback buttons. The card already shows receipts after an action, but click targets should also say what will happen before the click.

## Code And UX Findings

- `docs/features/memory_lens.md` is mostly current for Expanded Card structure: page recall receipt, action boundary footer, source status/open receipts, feedback write receipts, and validation guidance are already documented.
- `src/contentScriptWebIntelligence.ts` already renders source open receipts after source/memory-detail clicks and has a detailed memory-detail action label.
- Gap: ordinary original-source links only receive `title` / `aria-label` when `match.type === 'source_memory'`. Non-source-memory cards render bare links, so users do not get the pre-click boundary even though the card records a source-open receipt after click.
- Gap: positive and negative feedback icon hover text is still terse (`这条有用`, `不是这个意思`). The visible/in-card receipt after click is good, but the controls do not say before click that feedback writes a recall-quality signal, does not insert/send/confirm facts, and can be retried if service write fails.
