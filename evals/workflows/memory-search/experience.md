# Memory Search Experience Workflow

Evaluate whether memory search results match the user's real query intent and present enough title/summary context to choose a result.

V1 stores the workflow and registry entry only. Add cases for real search queries where the top result is noisy, title-only, or missing the expected evidence.

Expected case inputs:

- query text
- optional scope
- expected anchor terms
- banned topics
- expected top result behavior

Report requirements:

- Show the query, scope, and expected intent anchors.
- Show the returned search results with title, summary, source, and evidence snippets.
- Show whether the top result satisfies the user intent and whether noisy/banned topics were returned.
- Show score, user-facing verdict, and concrete suggestions for search ranking or title/summary quality.
