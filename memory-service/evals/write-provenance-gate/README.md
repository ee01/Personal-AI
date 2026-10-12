# Write Provenance Gate

`npm run eval:write-provenance-gate` runs the deterministic production-path assertions (no model calls). `npm run eval:run -- --suite write-provenance-gate --no-repair` produces the five-group reader report. `npm run eval:memory-abilities` chains the deterministic assertions before the six-ability benchmark; its live endpoint must run the branch's deployed code. The registry workflow is also required at feature delivery.

Groups: 10 background writes; 10 Ask/Compose prompt replays; 10 same-family/independent-family comparisons; 6 declared network tool turns; 100 synthetic pre-migration owner rows plus 100 content-free production owner records. Tests live at `memory-service/src/__tests__/writeProvenanceGate.test.ts`. `phase0.json` records a read-only audit; `owner-sample.json` contains only whitelisted classification fields, no original text, names, URLs or source IDs. Audit scripts run read-only in the service container.

Boundary: marker-stripped arbitrary paraphrases and undeclared network tools cannot be traced deterministically. Context Pack removes internal tags before external export; imported/external AI data stays untrusted. Owner authority requires a manual trusted entry or explicit first-party connector authorship; document imports cannot claim it merely because they use source_type=manual.
