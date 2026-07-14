# Findings

- The toolbar settings popup already says toggles are local display switches and do not cancel queued or saved work.
- The missing user-facing state is the effect of the current checkbox combination before pressing Save. A user can uncheck all four entries but only learns after saving that the whole local toolbar disappeared.
- A compact dynamic `保存后` row is sufficient because the existing backend contract is already correct.

## External references

- Gmail Help: hover actions can be disabled from Gmail settings.
- Slack Help: saved messages/reminders remain visible to the user in one Later place.
- Microsoft Teams Support: tasks/workflows are launched from message actions and then require details or prompts.
- Microsoft CHI 2019 Human-AI Interaction guidelines: AI-infused systems should communicate status, support control, and allow recovery.
