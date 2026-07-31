# Compose Assist Experience Workflow

Evaluate whether Compose Assist suggestions are useful, language-consistent, grounded when they use memory, and scoped to the user's current composer.

Add cases when a suggested reply is irrelevant, a prompt rewrite loses the user's goal or language, evidence contains low-information recall shells, a patch uses the wrong insertion mode, the system should have stayed quiet, or real user behavior should produce an ambient calibration trace.

Expected case inputs:

- site/composer type
- current thread or issue context
- draft text, if any
- expected evidence anchors
- expected output behavior: `suggest_reply`, `suggest_context_pack`, `suggest_prompt_patch`, `suggest_prompt_rewrite`, `hide`
- expected ambient calibration behavior, when applicable: trace action, polarity, evidence refs, and redaction guarantees
- for Web AI context-pack / prompt-patch / prompt-rewrite cases: endpoint, current chat text, draft prompt, sourceTypes, expected mode and insertMode, language, risk/preview expectations, required professional structure, and banned noise terms

Executable case kinds:

- `compose_assist_context_pack`: calls `/composer/assist` with `contextType=web_agent_prompt` and judges whether the generated context pack is relevant, grounded, and safe to insert.
- `compose_assist_prompt_patch`: calls `/composer/assist` with `contextType=web_agent_prompt` and judges whether the generated prompt patch fills task slots, keeps writeback/submission boundaries visible, and stays grounded in Personal AI memory evidence.
- `compose_assist_prompt_rewrite`: calls `/composer/assist` with `contextType=web_agent_prompt` and judges whether a complete draft can be professionally rewritten even with zero memory, returns `rewrite_prompt + replace_draft`, preserves the draft language and stated facts, adds research/decision rigor, and excludes recall shells or tool recommendations.
- `compose_assist_lens_routing_contract`: checks that evidence-only composer results do not render Compose Assist, remain eligible for Memory Lens, and that source code keeps the Lens/Compose mutual-exclusion contract.
- `compose_assist_ambient_calibration`: simulates send-time edit learning and judges whether the trace is privacy-safe.

Report requirements:

- Show what composer/context sample was evaluated without leaking raw sensitive text.
- Show expected behavior next to actual output behavior.
- For context-pack / prompt-patch / prompt-rewrite cases, show the chat/context text, draft, source types, generated compose text, suggestionType, insertMode, evidence snippets, debug summary, score, and concrete improvement suggestions.
- For prompt-patch cases that depend on the browser extension surface, include manual verification steps for compose icon visibility, hover/preview copy, insertion behavior, and the no-submit boundary.
- For Lens routing contract cases, show the synthetic composer response, expected route, actual route, and the source-code contract checks.
- For ambient calibration, show trace action, polarity, privacy class, evidence refs, redacted diff fields, and whether raw text was stored.
- Show the user-facing verdict and improvement suggestions, not only status and raw scores.
