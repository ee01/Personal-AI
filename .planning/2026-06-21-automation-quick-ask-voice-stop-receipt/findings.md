# Quick Ask Voice Stop Receipt Findings

## Initial Findings

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent exact targets in Memory Service, Message Reaction Watch, Agent Workflow, Topic Messages, Relationship Radar, Scheduled Messages, Project Dashboard, Jira Design Links, and Message Analysis. This run accepted `Quick Ask 语音输入` because the exact voice sheet was not in the latest automation-memory tail.
- The Reminders app returned lists including `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, and `Tasks`; no visible `Personal AI` list exists.
- Current docs already cover native Speech/AVFoundation helper, editable draft, permission recovery, and post-submit raw-audio boundary.
- Current code has a clear listening receipt, ready receipt, error receipt, permission recovery buttons, and a post-submit user-message receipt.
- UX gap: when the user stops listening with no transcript, the sheet falls into generic ready-empty copy and does not explicitly say listening stopped, nothing was sent, no audio was stored, and no Ask was started. With a transcript, the ready state also does not distinguish final recognition from an explicit manual stop/review moment.

## External Reference Findings

- Raycast Dictation exposes language, finish/cancel shortcuts, permission setup, local transcript/statistics handling, and review/insert-mode choices; this supports making the stop/review boundary visible.
- ChatGPT desktop positions voice as a lightweight desktop input mode alongside keyboard launcher flows; this supports keeping Quick Ask voice inside the same compact launcher rather than moving it to a heavier page.
- Apple's current SpeechAnalyzer/SpeechTranscriber guidance emphasizes live transcription and text output that can be displayed, searched, transmitted, or passed to an LLM; this supports explicitly separating transcript submission from raw audio retention.
- Voice Typing research argues real-time visible transcription and correction reduce cognitive demand and corrections versus traditional post-hoc dictation; this supports a stopped-review receipt before submission.

