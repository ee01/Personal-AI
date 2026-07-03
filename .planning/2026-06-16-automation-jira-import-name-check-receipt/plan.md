# Jira Automation Import name-check receipt plan

## Context

- Selected from `docs/features/index.md`: `Jira 自动化规则导入` / `Jira Automation Import`.
- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is readable, but there is no visible `Personal AI` list; no Reminder item is incorporated or completed.
- External scan: Atlassian import/export docs emphasize version compatibility and import review; Atlassian Data Center KB notes bulk imported automation rules start disabled; trigger-action programming research highlights debugging and rule-difference comprehension issues.

## Plan

1. Add a structured name-collision check receipt for existing-rule lookup states: confirmed, unknown, and failed.
2. Surface the receipt in preview details, boundary receipt, copied review packet, imported Jira description, and warnings.
3. Keep actual rule creation disabled by default and avoid creating a numbered-name guarantee when target rule lookup did not complete.
4. Verify with transform tests, dev webpack compile, Jira Automation Import E2E, and scoped whitespace checks.
