# User Profile Experience Workflow

Evaluate whether profile-backed behavior uses confirmed facts correctly and avoids treating inferred or sensitive facts as confirmed context.

V1 stores the workflow and registry entry only. Add cases when a surface leaks sensitive profile data, uses an unconfirmed inference, or misses an explicitly confirmed preference.

Expected case inputs:

- profile facts and confirmation state
- consuming surface
- prompt or context snapshot
- expected allowed facts
- must-not-use facts
