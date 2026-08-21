# Findings

## Requirements
- Do not ask users to specify result JSON/artifacts in the Task prompt
- System prompt should teach a generic receipt contract that fits Jira writes, reads, browser, sheets, files, etc.
- Implement and deploy if code changes are needed

## Research Findings
- Gateway already sends `extraSystemPrompt` via `buildDeveloperPrompt`, but it is English schema jargon (`Return JSON only`, metadata field names). The Nova Committed agent returned a Chinese Markdown report anyway.
- `parseEnvelope` takes the first `{` … last `}`. The report contained `customfield_31650 = {"value":"Yes"}`, so the parser treated that object as the envelope, defaulted `status` to `error`, and copied the markdown into both summary and error.
- Agent Task `targetSystem` defaults to `agent_task`, so the prompt hint `Target system: agent_task` does not help the model fill `sourceSystem=jira`.
- `hasVerifiableArtifact` is still the ledger gate. Artifacts are self-reported; synthesizing them from a structured markdown receipt is the same trust model as accepting model-authored JSON.
- OpenClawDelegationService already synthesizes artifacts from structured `payload` (calendar / AR). Gateway has no equivalent markdown recovery.
- Existing test `treats a non-empty plain-text final answer as error` encoded the old "plain text always fails" policy. Product direction now: recover when the text is a receipt, keep failing when it is not.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Shared prompt + parser modules | Gateway, ACP, and legacy responses must not drift |
| Envelope = object with known `status` | Avoid incidental JSON false positives |
| One artifact per touched entity | Batch Jira updates become 4 receipts, not one blob |
| Footer appended to composed user message | `extraSystemPrompt` is easy to under-weight; footer is system-owned, not user-authored |
