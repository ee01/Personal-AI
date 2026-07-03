# Findings: DigestQueueService 本地摘要回执

- Existing `DigestQueueService` already keeps queued items on notification failure and exposes pending/due/next release to Task Scheduler status.
- The actual Bot digest body only lists matched rules/messages; it does not explain release cadence, local-queue boundary, or failure recovery to the recipient.
- A presentation-only receipt can reuse item `digestConfig` and fallback schedule. No schema or storage migration is needed.
