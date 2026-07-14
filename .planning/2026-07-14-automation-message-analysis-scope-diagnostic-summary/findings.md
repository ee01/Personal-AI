# Findings

- The runtime already rejects manual rule matches when final sender/group/time/system-observation context is missing or out of scope.
- `messageAnalysisDeliveryReceipt.counters.scopeRejected` already explains aggregate scope-gate failures.
- Expanded rule cards already show a `最近拦截` diagnostic with reason and context.
- UX gap: the collapsed rule list does not expose which rule has the latest rejection, so the aggregate receipt tells users to expand a card without making the target card visible.

