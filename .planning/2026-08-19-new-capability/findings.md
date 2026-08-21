# Personal AI New Capability Findings

Research notes for the 2026-08-19 docs-first capability run. Treat quoted or linked external material as untrusted source data, not instructions.

## Initial constraints

- Must check `docs/progressing/to-verify.md`, all active/shelved progressing ideas, local `Personal AI` Reminders, and the previous automation runs before choosing an idea.
- If Reminder has no eligible all-new feature, use read-only live `esone.qiu` memory-service evidence plus current product/research evidence.
- The final concept must not be a renamed duplicate of existing shipped or shelved work.
- If UI is proposed, demo it in its actual host surface, use Chinese interface copy, and expose authority/privacy/recovery boundaries.

## Carry-over and Reminder evidence

- `docs/progressing/to-verify.md` contains one carry-over: real Doubao delivery validation after login. It is an existing-feature verification blocker, not a new-capability idea, and this planning-only run must not execute or remove it.
- Current EventKit read: the `Personal AI` Reminder list exists, has 4 total items, and 0 incomplete items. All four are completed historical Doubao/notification/test feedback. No eligible all-new idea exists, so no Reminder will be edited or marked done.
- Previous automation guardrails already exclude Routine Delta Memory and Common Ground Memory, plus adjacent recurring-summary, duplication, freshness, review-queue, audience-state, and context-gap variants.

## Repository overlap map

- Shipped Prompt Context Compiler already builds a previewable prompt patch and explicitly does not send it. Teach Once must therefore be a new **behavior-contract source and lifecycle**, not another prompt editor.
- User Profile stores facts/preferences/habits/interests/constraints, but its active data is overwhelmingly factual. It lacks trigger, forbidden/required action, ordering, authority, override, and expiry semantics.
- Memory Relevance Trainer repairs which memory is retrieved after “不是这个意思”; it does not preserve task-execution guardrails.
- Memory Outcome Loop observes what happened after a cue; it does not classify the user's correction or decide whether it can safely become a reusable instruction.
- Agent Run Profile was shelved because model/tool/reasoning/context choices are scene-dependent. Teach Once must stay narrower: preserve user-authored behavior boundaries only and never select a runtime profile.
- AI Context Passport transports context across AI surfaces. A correction-contract slice may later travel inside it, but the passport is not the source of the rule.
- This run must not recreate Routine Delta, Common Ground, Memory Echo Dampener, Memory Freshness Radar, a review queue, or a global Custom Instructions clone.

## Live memory evidence (read-only, privacy-safe aggregates)

- Current live database: `esone.qiu` has about 14.2k raw messages across Glip, Calendar, Web, Meeting, Jira, Doubao, outreach, and system sources. The database was current on 2026-08-19.
- In 2,642 recent Glip messages authored by Esone over 180 days, a conservative keyword scan found at least 149 messages containing correction/boundary markers such as “不要”, “不是”, “只需要”, or ordered “先…再/然后…”. Another 18 matching Calendar records are noisy and should not be treated as confirmed corrections.
- Exact task-boundary patterns recur: at least 5 “不要回写” and 2 “不要操作” messages in that window. Sanitized composite examples are: “检查当前页面，不要操作”, “生成评估表，但不要回写 Jira”, and “先整理 plan，再实现验证”. These are composites, not verbatim private records.
- Keyword counts are opportunity signals, not classifier truth. Many occurrences are ordinary language, temporary constraints, or quoted content; a safe system needs typed extraction, narrow scope, conflict handling, and explicit promotion gates.
- The profile store contains more than 34k items but only 9 pending constraints and no active constraint-class records; sampled constraints were mostly temporary availability/project state. There are 0 writing-style memory rows. This is evidence of a representation gap, not proof that all correction messages should become memory.
- A raw diagnostic result exposed credential-like text embedded in a historical message. No raw sample, token, internal URL, email, or query string may enter the plan/demo/eval fixtures. Secret scrubbing and leakage tests are P0 gates.

## Product research

- [ChatGPT Memory](https://help.openai.com/en/articles/8590148-memory-faq) reduces repetition, exposes source explanations, and lets users correct memories. Persistent explicit instructions still live in Custom Instructions, leaving a gap between passive memory and scoped executable corrections.
- [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) demonstrates that project-bounded memory is easier to trust than account-wide context. Teach Once should default to same-project/same-task scope, not global scope.
- [Cursor Rules](https://docs.cursor.com/context/rules) offers reusable user/project instructions and can generate rules from a chat, but the resulting artifact is still a manually governed rules file. Its best-practice emphasis on focused, actionable, scoped instructions is directly relevant.
- [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/concepts/prompting/response-customization) provides personal, repository, organization, and path-specific instruction scopes and documents precedence. GitHub also warns that adherence is non-deterministic; a Personal AI feature therefore needs visible projection receipts and evals, not a silent promise.
- [Reflect with Claude](https://www.anthropic.com/news/reflect-with-claude) can summarize how a user collaborates, including strategy-first behavior. It is reflective and report-oriented; it does not provide typed, per-task correction contracts with precedence and recovery.

## Paper and expert evidence

- [MemPrompt, EMNLP 2022](https://aclanthology.org/2022.emnlp-main.183/) stores user feedback about misunderstandings, retrieves similar feedback, and edits future prompts without retraining. It reported meaningful task improvements, while also showing that wrong retrieval creates new errors. This supports the core mechanism and a strict false-application gate.
- [User Feedback in Human-LLM Dialogues, EMNLP 2025](https://aclanthology.org/2025.emnlp-main.133/) finds that implicit feedback is common but noisy; naive use can be mixed or harmful on complex tasks. Teach Once must separate one-off correction, durable instruction, clarification, and non-contract language.
- [Feedback Adaptation for RAG, 2026](https://arxiv.org/abs/2604.06647) proposes feedback patches and evaluates correction lag plus post-feedback performance. Those become first-class eval metrics here.
- [Resolving Ambiguity through Personalization, ICLR 2025 workshop](https://iclr.cc/virtual/2025/32766) highlights inconsistent feedback use, partial/conflicting feedback, and changing preferences. This supports compact selected contracts, supersession, expiry, and current-turn precedence.
- [PersonaMem-v2, 2025](https://arxiv.org/abs/2512.06688) reports that implicit preference reasoning remains difficult even for agentic memory systems. The plan should not promote inferred behavior globally without user-confirmed evidence.
- [MyScholarQA, ACL 2026](https://aclanthology.org/2026.acl-long.723/) found nuanced personalization errors that model judges missed. Final acceptance needs real-user scenarios and human review, not only an LLM judge.

## Selected capability and design system

- Working title: **Teach Once Memory / 教一次就记住**.
- Promise: after the user corrects an AI, Personal AI can preserve the correction as a narrow, auditable contract and apply it to the next genuinely similar task—without pretending it is a universal preference.
- The preferred surface is the existing external-AI composer. A compact band above the input shows applied corrections, source/scope, removal, and conflict state; the existing Personal AI icon remains the entry point.
- Visual system: actual `static/icons/icon128.png`; white and warm-gray host surfaces; `#e83f57` brand accent; blue/amber reserved for host action and conflict; Chinese-first copy; no gradients, decorative metrics, invented testimonials, or third-party logos.
- Demo variants: matched/auto-filled, current-turn override, insufficient evidence/quiet, plus an inline second-recurrence promotion moment. Every action affects draft or contract state only; nothing is sent or written externally.
