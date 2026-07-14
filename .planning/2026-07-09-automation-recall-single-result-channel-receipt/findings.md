# Findings

- Selected feature: `四通道召回` under `Memory Service`.
- Reminder check: EventKit found `Personal AI`; all 4 items are completed and unrelated, so no Reminder item should be marked done.
- Code gap: `formatEvidenceChannelOverlapReceipt` suppresses the receipt for exactly one visible result, even when that result has `metadata.channels`.
- UX risk: a single keyword-only result shows a channel chip but no result-level receipt saying there is no cross-channel support.
- Scope decision: keep this presentation-only; do not change `RecallEngine`, channel diagnostics, MMR, feedback, or `/recall` payloads.
