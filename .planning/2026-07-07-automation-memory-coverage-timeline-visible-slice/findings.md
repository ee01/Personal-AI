# Findings

- The Coverage Map page already has strong receipts for snapshot freshness, manual rescan, quality score, repair queue, smart import, and backup restore.
- The remaining user-risk gap is narrower: `最近覆盖信号` says it shows at most 8 events, but the visible panel does not structure that as a receipt. A user can still mistake the visible list for a complete sync log or complete connector audit.
- The backend currently slices timeline events to 8 after sorting by `lastSeenAt`; it does not expose total pre-slice candidate count. The front-end should therefore label the panel as the current visible slice and say reaching 8 means the API may have capped the list.
- This change does not require new backend state or user decisions.
