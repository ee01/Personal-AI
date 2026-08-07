# Compose Assist Draft Boundary Findings

## Initial Findings

- Randomly selected feature from `docs/index.md`: `回复助手草稿辅助`.
- Capability: Compose Assist.
- Source document: `docs/features/assist.md`.
- Local Reminders list scan returned `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; no visible `Personal AI` list exists.
- The worktree is already broadly dirty from earlier automation runs. Treat existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- Current Compose Assist UI already hides Memory Lens-style source cards in hover preview and requires review for `previewRequired`, high-risk, and Rehearsal-backed suggestions.
- Hover/locked preview names the source type and can show review evidence, but it does not provide a concise user-facing boundary receipt that says this is draft insertion only, not send/submit, and why a second click may be required.
- A compact receipt can use existing response/session data (`suggestionType`, `riskLevel`, `previewRequired`, `evidence`, `contextType`, `surface`) without backend schema changes.

## External Reference Findings

- Gmail Smart Compose keeps assistance inline, user-accepted, editable, and optionally personalized.
- Microsoft Outlook Copilot drafting exposes editable prompts, length/tone controls, and review-before-use behavior.
- Microsoft Sales Copilot documentation explicitly frames AI-generated email text as a suggestion.
- Smart Compose research emphasizes low-latency, low-interruption assisted writing.
- GhostWriter and recent writing-assistance agency research argue for personalization plus user control, while overreliance research supports interface cues that prevent blind adoption.
