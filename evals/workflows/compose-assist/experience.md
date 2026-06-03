# Compose Assist Experience Workflow

Evaluate whether Compose Assist suggestions are sendable, grounded in relevant memory, and scoped to the user's current composer.

V1 stores the workflow and registry entry only. Add cases when a suggested reply is irrelevant, overreaches, cites the wrong memory, should have stayed quiet, or should produce an ambient calibration trace from real user behavior.

Expected case inputs:

- site/composer type
- current thread or issue context
- draft text, if any
- expected evidence anchors
- expected output behavior: `suggest_reply`, `suggest_context_pack`, `hide`
- expected ambient calibration behavior, when applicable: trace action, polarity, evidence refs, and redaction guarantees
- for Web AI context-pack cases: endpoint, current chat text, draft prompt, sourceTypes, expected context-pack sections, risk/preview expectations, and expected evidence terms

Executable case kinds:

- `compose_assist_context_pack`: calls `/composer/assist` with `contextType=web_agent_prompt` and judges whether the generated context pack is relevant, grounded, and safe to insert.
- `compose_assist_ambient_calibration`: simulates send-time edit learning and judges whether the trace is privacy-safe.

Report requirements:

- Show what composer/context sample was evaluated without leaking raw sensitive text.
- Show expected behavior next to actual output behavior.
- For context-pack cases, show the chat/context text, draft, source types, generated compose text, evidence snippets, debug summary, score, and concrete improvement suggestions.
- For ambient calibration, show trace action, polarity, privacy class, evidence refs, redacted diff fields, and whether raw text was stored.
- Show the user-facing verdict and improvement suggestions, not only status and raw scores.
