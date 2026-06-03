# Compose Style Memory Experience Workflow

Evaluate whether Compose Assist can learn the user's transferable writing style from repeated redacted send-time diffs.

This suite focuses on the user experience problem where a suggested reply is technically relevant but still has obvious AI flavor. It does not require a live LLM. Instead, it checks the deterministic memory pipeline:

- repeated `ambient_calibration_traces` with style feature tags are accepted without raw text;
- similar diffs promote a `UserWritingStyleMemory`;
- `USER_CORE` gains a `## Writing Style` entry;
- the next same-kind compose prompt retrieves the new `writing_style.*` profile item.

Expected case inputs:

- redacted compose traces with hashes, style feature tags, scope metadata, and no raw sent text;
- a compose request fixture for the follow-up scene;
- expected strings that must appear in `USER_CORE`;
- expected strings that must newly appear in the next compose prompt.

Pass criteria:

- all traces store successfully;
- `USER_CORE` includes the expected writing style key/rules and does not include raw final text;
- the prompt before learning does not include the new style rule;
- the prompt after learning includes the writing style rule, so a real LLM has the right instructions to reduce AI-flavored output.

Report requirements:

- Show the number of redacted traces submitted and whether they were stored.
- Show the promoted writing style profile item ids, not raw sent text.
- Show a short `USER_CORE` excerpt with the `## Writing Style` section.
- Show whether the compose prompt changed from no writing-style hint to a prompt containing the expected `writing_style.*` key and style rules.
- Show concrete failure reasons when promotion, privacy, or prompt retrieval fails.
