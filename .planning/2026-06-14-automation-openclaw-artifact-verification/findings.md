# OpenClaw Artifact Verification Badge Findings

## Current State

- `docs/index.md` lists `OpenClaw 外部委派` under Memory Service, with `docs/memory_system.md` as the current source of truth.
- The existing OpenClaw delegation backend already downgrades `success` responses without a verifiable artifact into `status: error` plus `payload.artifactValidation = 'missing_verifiable_artifact'`.
- `ActionQueue.vue` already shows a `证据校验回执` for failed OpenClaw results and keeps artifact/payload/transcript visible after refresh.
- UX bug found: `delegationArtifactCountLabel()` currently labels every returned artifact as `可验证 artifact N 条`, even when the same card says `OpenClaw 返回缺少可验证 artifact`.

## External Reference Notes

- OpenAI Agents SDK HITL docs describe pausing tool calls for approval and resuming from run state, supporting explicit pending/approved/resumed state receipts.
- LangGraph HITL docs separate approve/edit/reject/respond decisions, supporting clear execution-state labels instead of generic success.
- Zapier Agents activity/status docs expose run status and detailed activity so users can debug what ran and whether input is needed.
- Trigger-action debugging research supports making automation failure/verification boundaries visible, because users otherwise misread whether an automation actually succeeded.

## Implementation Notes

- Mirror the backend's practical verifiability check in the UI label: source/target system, entity key/id, verification marker, artifact body, and observed/changed fields, operation, or timestamp.
- Keep incomplete artifacts visible for debugging, but label them as unverified rather than verified.
