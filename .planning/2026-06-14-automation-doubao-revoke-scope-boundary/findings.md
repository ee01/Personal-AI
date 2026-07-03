# Doubao Bridge Revoke Scope Boundary Findings

## Local Findings

- `docs/progressing/to-verify.md` currently says `暂无。`; no carry-over verification item overrides the random feature selection.
- Random feature sample selected `豆包互联 / Doubao Bridge`.
- Recent automation memory covered Google Slides skipped target receipt, Agent Thinking approval retry receipt, Memory events identity receipt, Scheduled Messages target-filter receipt, and Meeting Pilot ASR receipt. This run avoids those exact feature surfaces.
- Local Reminders lists are visible, but none is named `Personal AI`: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- `docs/features/doubao_bridge.md` is broadly current for the Desktop App bridge, including provider-neutral boundaries, source-card Explorer input, raw cache, artifact preview, reset cache, and revoke-ingested-memory behavior.
- Current code already distinguishes remote deletion and local artifact audit after revoke via `formatRevokeResultMessage(...)`.
- UX gap remains near the action: the revoke button can be disabled with no adjacent reason, and the revoke panel does not explicitly state that the operation is limited to the current saved default scope while leaving the other scope and the remote source conversation untouched.
- Existing verifier: `npm --prefix desktop-app run test:source-toggle-gating` exercises Desktop App source cards, pipeline receipts, preview/reset, and revoke result behavior.

## External Reference Findings

- OpenAI's Memory FAQ separates saved memories, referenced chat history, chats, files, connected apps, and safety logs; deletion may require removing the relevant item from each place where it appears. Design implication: Personal AI should name which layer a revoke action touches instead of saying only "deleted".
- Claude's memory import/export help frames memory transfer as an import flow that extracts key information into memory edits and warns that imports are experimental and may not incorporate all details. Design implication: Explorer artifact counts and source/scope receipts are useful because ingestion and memory formation are not identical.
- Eywa (arXiv 2605.30771v1) argues for provenance-grounded memory where source evidence and canonical facts stay linked so they can be inspected, repaired, and deleted. Design implication: the Desktop App should keep revoke wording tied to source, scope, local audit artifacts, and downstream Memory Service deletion.

## External Links

- OpenAI Memory FAQ: https://help.openai.com/en/articles/8590148-memory-faq
- Claude memory import/export: https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude
- Eywa provenance-grounded long-term memory: https://arxiv.org/html/2605.30771v1
