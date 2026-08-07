# Agent Workflow control-boundary sweep

## Target

- Feature: `Agent Workflow 运行诊断`
- Canonical doc: `docs/features/message_analysis.md`
- Index row: `Agent Workflow 运行诊断`
- Primary surface: Options `Agent Workflow` / `关注项测试`

## Current State

- `docs/progressing/to-verify.md` is empty.
- Recent automation runs covered Jira Design Links, Rehearsal, Project Dashboard, Quick Ask, Notification Center, Meeting Pilot, User Profile, Scheduled Messages, Ask, Native Join, and related surfaces; this run avoids those freshest targets.
- AppleScript did not list `Personal AI`; EventKit did find the list with 4 total items and 0 incomplete items, so there is no live Reminder feedback to include or mark done.

## External Scan

- OpenAI Agents SDK exposes sessions, human-in-the-loop, tracing, and debugging for agentic workflows: https://openai.github.io/openai-agents-python/
- LangGraph persistence/time-travel separates replay, checkpoint, and re-execution semantics: https://docs.langchain.com/oss/python/langgraph/persistence and https://docs.langchain.com/oss/python/langgraph/use-time-travel
- OpenTelemetry GenAI conventions model workflow/tool operations as structured telemetry, not raw private context dumps: https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- Zapier Agents separates testing from publishing/trigger activation: https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents
- Structural coverage research for agentic workflows argues that agent/tool/delegation coverage is a useful adequacy layer, separate from final-response quality: https://arxiv.org/abs/2605.26521

## Plan

1. Add shared `title` / `aria-label` boundaries to the Agent Workflow diagnostic controls:
   - run current test
   - fill/run built-in scenario
   - fill/run/refresh recent replay sample
   - save/fill/run/delete saved sample
   - run saved-sample regression
   - update a single baseline
   - export regression report
   - accept changed/no-baseline regression results
   - copy single-run evidence packet
2. Keep behavior unchanged: these controls should still perform only their existing local test, local storage, download, clipboard, or read-only replay actions.
3. Extend `tools/verify-agent-workflow-options-e2e.mjs` to assert the control-level boundaries before clicks.
4. Update `docs/features/message_analysis.md` and `docs/index.md` with the concise current behavior.
5. Verify with:
   - `npm run verify:agent-workflow`
   - `npm start -- --progress` until first successful compile, then stop
   - `node tools/verify-agent-workflow-options-e2e.mjs`
   - scoped `git diff --check`
