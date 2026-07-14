# Compose Assist Experience Workflow

Evaluate whether Compose Assist suggestions are sendable, grounded in relevant memory, and scoped to the user's current composer.

V1 stores the workflow and registry entry only. Add cases when a suggested reply is irrelevant, overreaches, cites the wrong memory, should have stayed quiet, or should produce an ambient calibration trace from real user behavior.

Expected case inputs:

- site/composer type
- current thread or issue context
- draft text, if any
- expected evidence anchors
- expected output behavior: `suggest_reply`, `suggest_context_pack`, `suggest_prompt_patch`, `hide`
- expected ambient calibration behavior, when applicable: trace action, polarity, evidence refs, and redaction guarantees
- for Web AI context-pack / prompt-patch cases: endpoint, current chat text, draft prompt, sourceTypes, expected insert sections, risk/preview expectations, and expected evidence terms

Executable case kinds:

- `compose_assist_context_pack`: calls `/composer/assist` with `contextType=web_agent_prompt` and judges whether the generated context pack is relevant, grounded, and safe to insert.
- `compose_assist_prompt_patch`: calls `/composer/assist` with `contextType=web_agent_prompt` and judges whether the generated prompt patch fills task slots, keeps writeback/submission boundaries visible, and stays grounded in Personal AI memory evidence.
- `compose_assist_lens_routing_contract`: checks that evidence-only composer results do not render Compose Assist, remain eligible for Memory Lens, and that source code keeps the Lens/Compose mutual-exclusion contract.
- `compose_assist_ambient_calibration`: simulates send-time edit learning and judges whether the trace is privacy-safe.

Report requirements:

- Show what composer/context sample was evaluated without leaking raw sensitive text.
- Show expected behavior next to actual output behavior.
- For context-pack / prompt-patch cases, show the chat/context text, draft, source types, generated compose text, evidence snippets, debug summary, score, and concrete improvement suggestions.
- For prompt-patch cases that depend on the browser extension surface, include manual verification steps for compose icon visibility, hover/preview copy, insertion behavior, and the no-submit boundary.
- For Lens routing contract cases, show the synthetic composer response, expected route, actual route, and the source-code contract checks.
- For ambient calibration, show trace action, polarity, privacy class, evidence refs, redacted diff fields, and whether raw text was stored.
- Show the user-facing verdict and improvement suggestions, not only status and raw scores.
