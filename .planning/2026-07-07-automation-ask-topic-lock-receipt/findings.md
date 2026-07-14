# Ask Topic Lock Receipt Findings

## 2026-07-07

- `docs/progressing/to-verify.md` is empty.
- Random candidate selected: `Ask 短问句话题锁定`.
- The Ask doc already describes backend topic locking, ambiguous candidate clarification, candidate continuation, active answer memory, and evidence watch boundaries.
- Current UI already renders `Ask 本轮状态`, `Ask 候选选择回执`, `Ask 承接候选回执`, `Ask 证据守望回执`, and active-answer receipts.
- UX gap: a direct locked short Ask can put the lock explanation inside generated answer text, but there is no stable pre-answer receipt naming the selected topic and non-effect boundary. That makes the automatic disambiguation less inspectable than the ambiguous/candidate path.
- Implementation target: add `Ask 话题锁定回执` from `contextMatch.selectedTopic`, including reasons/source-anchor metrics and a clear no-effect boundary.
- External references: Slack AI and Notion Enterprise Search both put answers beside citations/sources; CONQRR/Apple QR justify context-complete retrieval for short questions; IBM RAG transparency research supports visible source/transparency controls rather than confidence-only presentation.
