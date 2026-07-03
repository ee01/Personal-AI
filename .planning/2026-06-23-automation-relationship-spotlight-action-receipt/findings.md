# Relationship Radar Spotlight Action Receipt Findings

## Context

- Random target: `人脉关系人物雷达`.
- Current doc already describes the hybrid projection model, `dataQuality` / `projectionSource`, radar route receipt, context-card privacy defaults, meeting-brief identity checks, assistant-draft safety review, and Review Queue write boundary.
- Current UI already has a top `雷达路线回执`, but the clickable spotlight card itself only shows a headline, summary, meta chips, and three buttons. A user can still wonder whether `查看完整 brief`, `强制刷新此人`, or `复制给 AI` is only review/navigation or could write profile facts or external actions.
- Existing E2E covers the route receipt, selected-person stability, sensitive context failure fallback, non-spotlight copy, meeting brief identity boundaries, and Review Queue write gating.

## Reminders

- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No list named `Personal AI` exists, so no Reminder items were inspected or completed.

## External References

- Microsoft Dynamics 365 relationship intelligence exposes relationship health, KPIs, and who-knows-whom, while its documentation warns about monitoring/consent and responsible use around communications data.
- Affinity relationship intelligence highlights recency/frequency-based relationship strength, strongest connection paths, and follow-up triggers.
- Salesforce Einstein Relationship Insights describes recommended relationships and evidence documents as input for sales teams to inspect.
- Hancock et al. define AI-mediated communication as an agent modifying, augmenting, or generating messages for communication goals, making agency and disclosure central design questions.
- Mieczkowski et al. found AI-generated communication suggestions can alter language and may undermine some interpersonal perceptions, supporting explicit user review and boundary text before relationship-aware drafting/copying.

## Chosen Slice

- Add a compact `行动前回执` to the spotlight card.
- The receipt should be colocated with the primary buttons, summarize the current recommended person, first action, evidence/data quality, review queue need, and non-effect boundary.
- Keep ranking and backend APIs unchanged.
- Extend the existing Relationship Radar E2E to assert the new receipt.
