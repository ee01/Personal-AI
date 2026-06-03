# Meeting Pilot Experience Workflow

Evaluate whether Meeting Pilot memory references, live cues, and action suggestions are useful in the meeting context.

V1 stores the workflow and registry entry only. Add cases when a meeting memory, cue, or action item is judged misleading or especially useful.

Expected case inputs:

- meeting title and attendee snapshot
- transcript or synthetic transcript segment
- expected memory/action anchors
- must-not-return topics
- expected behavior: `show`, `downgrade`, `hide`, or `ask_for_more_context`

Report requirements:

- Show the meeting title, attendee snapshot, and transcript/cue segment used by the eval.
- Show expected memory/action anchors and must-not-return topics.
- Show the actual memory references, live cues, action suggestions, or hide/downgrade decision.
- Show score, user-facing verdict, and concrete suggestions for improving meeting relevance.
