# Findings

## Repo

- Search results already show search scope, type filter receipt, channel diagnostics, safe open receipts, highlighted query terms, and feedback boundaries.
- Remaining UX gap: when a query returns multiple items, the summary exposes type and scope but not the visible source/title distribution. A user can see result count without knowing whether the visible set is dominated by one source or spans multiple sources.

## External Scan

- Notion Enterprise Search cites sources and lets users narrow search to workspace, connected apps, web, or a specific source.
- OpenAI Memory exposes memory sources and says source views make memory easier to understand and control, while not necessarily showing every factor.
- Faceted exploratory search research frames facets as a way to give users an overview of the current search space and control exploration.
- PIM information-scraps research highlights that personal notes and memories are scattered, incomplete, and often retrieved by cues different from their literal content.

## Decision

Add `来源覆盖回执` in the result summary. It should summarize the visible source distribution, say whether the current visible set is concentrated in one source or spans multiple sources, and state that this is a local summary of returned results, not a connector refresh, feedback write, source sync, or fact confirmation.
