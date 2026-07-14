# Jira Automation Import provider-token redaction

## Target

- Feature: `secret value 脱敏`
- Capability: Jira Automation Import
- Source doc: `docs/features/jira_automation_import.md`

## Research signal

- Atlassian import/export guidance says imported rules start disabled and hidden values must be re-entered manually.
- Atlassian masked-secret guidance treats web request headers and webhook URLs as secret-backed configuration, not portable working values.
- Recent Atlassian sensitive-data guidance explicitly says automation exports are not a reliable backup for hidden field values.
- Trigger-action programming security research supports visible review gates for copied automation because chained actions can create privacy or privilege side effects.

## Improvement Plan

1. Extend shared Jira Automation import redaction for provider credential shapes:
   - JWT / id token / client assertion keys.
   - URL query credentials where a generic `key` carries an API-key-looking value.
   - OpenAI / Anthropic / Gemini / Google-style provider tokens and `X-API-Key` header values.
2. Keep behavior scoped to redaction, review receipts, and disabled-copy payload creation.
3. Add transform regression coverage for review findings, secret re-entry map, review note, packet, and create payload.
4. Add E2E fixture coverage so the built extension preview and create path cannot leak these provider credentials.
5. Update the canonical feature doc and run targeted verification plus extension build/E2E.
