# Attention Triage

Run `npm run eval:run -- --suite attention-triage --no-repair`.
The runner executes production pure functions and SQLite ledger methods with Vitest;
no online model or judge is needed. Manual cadence is 14 days after changes to request,
audience, date parsing or lifecycle policy. Cases map to actual assertions, not report shape.

## Report requirements

Record executed assertion names and pass/fail, command exit status and six contract groups.
The 60 real seeds retain semantic paraphrases, source timestamps and explicit labels;
raw identifiers, links and source content are excluded. Their labels were reviewed by
the coding agent, not an independent human annotator. Do not claim production quality
from this small, negative-heavy sample. Report date recall, audience, false-positive,
dedup and lifecycle boundaries separately. E2E must also demonstrate four buttons,
identity confirmation, failures/retry and host read/reply boundaries in fresh dist.
