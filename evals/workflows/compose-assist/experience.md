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
