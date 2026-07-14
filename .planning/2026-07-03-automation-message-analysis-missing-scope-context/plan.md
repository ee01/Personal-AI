# Message Analysis missing scope context plan

## Target

- Feature: `规则范围校验` in `docs/features/message_analysis.md`
- User-facing gap: a manual rule can be limited by sender or group, but the final matched-rule resolver currently treats missing sender/group context as eligible. That can make a hallucinated `RULE_REF` look valid when the message lacks the field needed to prove scope.

## External scan

- Slack keyword workflows require both the selected channel and keyword conditions before the workflow starts.
- Zapier Filter/Paths describe conditions as gates that determine whether later actions run.
- Trigger-action debugging research emphasizes that non-programmers need visible reasons for why rules did or did not fire.

## Implementation steps

1. Keep LLM prefiltering permissive so batch/group prompts do not drop sender-scoped rules before individual messages are inspected.
2. Make final `resolveMatchedWatchRules(...)` reject manual rules when a configured sender/group scope cannot be confirmed from the message context.
3. Make local scope diagnostics distinguish actual mismatch from missing sender/group context.
4. Update the scope execution receipt copy and canonical feature doc to describe the fail-closed final boundary.
5. Verify with the existing runtime, message-flow, topic-rule-safety, webpack, and Message Analysis E2E harnesses.
