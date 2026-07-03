# Today Pilot Context Pack Source Coverage Findings

## Local Product Findings

- `docs/features/today_pilot.md` already documents the key boundary: context packs are deterministic, external-AI context only, not execution authorization.
- `DayPilotService.renderMissionContextPack()` returns evidence counts, source-kind counts, redaction, and truncation state, but it does not say how many evidence items survived into the clamped markdown body.
- Today Pilot Home and popup copy receipts currently say evidence count plus redaction/truncation. On truncated packs, this can imply every evidence item is inside the copied text even when the body is clipped.
- The existing E2E already covers copy receipt, non-storage of raw body in ambient calibration, and execution-card context-pack hiding.

## External Reference Findings

- NotebookLM documents source type limits, inaccessible-source behavior, and source selection, which supports visible source scope and limitations before reuse.
- Microsoft Copilot grounding docs emphasize permission-bounded sources, explicit grounding limitations, and critical-source review.
- IBM CHI 2025 RAG transparency research found that source attribution and highlighting used document sections improve trust more than confidence scores alone.
- The 2024 arXiv paper `Correctness is not Faithfulness in RAG Attributions` separates support from faithful source use and warns that attribution can create misplaced trust unless source use is made clear.

## UX Direction

- Add a compact source-coverage receipt instead of adding another review surface.
- Keep the copy flow fast, but include `copied X/Y evidence` in UI receipts and a `Source Scope` section in generated markdown.
- For truncated packs, explicitly say how many evidence items were omitted from the copied body because of the token budget.

