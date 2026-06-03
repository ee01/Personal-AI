# Eval Report Contract

Every runnable eval report must answer these user-facing questions:

1. What data or target did this case evaluate?
2. What behavior was expected?
3. What did the system actually return, generate, or decide?
4. What score/verdict was assigned and why?
5. What should be improved next?

Runner output should include these structured fields for each executed case:

- `caseTitle`
- `sampleSummary` or redacted `sampleDetails`
- `expectedBehavior` or `expectedTopics`
- `actualOutput`, `topMatch`, `error`, or `reason`
- `scores`
- `userConclusion`
- `improvementSuggestions`

Suite workflows must include a `Report requirements` section. If a suite has domain-specific output, add a suite-specific HTML renderer. Otherwise the generic card renderer will use the fields above and will surface any missing fields as report-contract issues.
