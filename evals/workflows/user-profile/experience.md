# User Profile Experience Workflow

Evaluate whether profile-backed behavior uses confirmed facts correctly and avoids treating inferred or sensitive facts as confirmed context.

V1 stores the workflow and registry entry only. Add cases when a surface leaks sensitive profile data, uses an unconfirmed inference, or misses an explicitly confirmed preference.

Expected case inputs:

- profile facts and confirmation state
- consuming surface
- prompt or context snapshot
- expected allowed facts
- must-not-use facts

Report requirements:

- Show the consuming surface, prompt/context snapshot, and profile facts with confirmation state.
- Show which facts are allowed and which facts must not be used.
- Show the actual profile-backed output or context fields consumed by the surface.
- Show score, user-facing verdict, and concrete suggestions for confirmation gating, privacy, or evidence quality.
