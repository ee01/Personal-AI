# Dream Replay Review Handoff Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over verification item.
- Random selection was filtered away from very recent exact feature families. `梦境重放` remained a suitable candidate with a stable E2E harness.
- `DreamInsights.vue` already loads recent `dreams/*.md`, supports `?file=` notification deep links, shows page scope, card triage, evidence readiness, and a `复核这个主题` link to `/reflection-threads?status=all&source=dream&search=<title>`.
- `ReflectionThreads.vue` already reads `source=dream` and `search`, displays `来自梦境重放`, and pre-fills the search box.
- UX gap: the card action says it will carry the topic, but the action location does not summarize the source file, evidence state, risk/new-relationship counts, or the non-effect boundary before the user leaves the page.

## External Reference Findings

- OpenAI's current Dreaming/memory release emphasizes long-term memory staying relevant over time and using evals for context-sensitive recall; this supports making dream/replay outputs visible as reviewable evidence rather than hidden state.
- OpenAI Memory controls distinguish saved memories and chat-history-derived memory, with user management and deletion controls; Dream Replay should keep review handoff distinct from durable profile or memory writes.
- Claude memory emphasizes project-scoped memory, view/edit control, and incognito paths; this supports carrying source/scope into the handoff instead of blending unrelated contexts.
- Claude's memory tool frames memory as just-in-time retrieval with client-controlled storage; this supports explicit source-file and retrieval-boundary copy.
- Generative Agents uses memory, reflection, and retrieval together; Reflective Memory Management uses forward/backward reflection and cited evidence; ReAP shows reflection helps agents avoid repeated mistakes. These support a handoff path from generated replay to Reflection, but only as review context.
- Brain-inspired replay research supports replay as consolidation, but does not justify treating generated replay as confirmed user facts or executable actions.

