# Findings

- Dify returns a successful workflow run while exposing downstream failure in `data.outputs`, including `accepted=false`, `queueStatus=failed`, `error=authentication_required`, and `statusCode=401`.
- The current Jira AgentTask branch ignores that output and unconditionally calls `confirmBotMessageTriggered` with `success=true&stage=confirmed`.
- The existing AppScript failure callback already writes `Exec_Log`, `Agent_Last_Status`, `Agent_Last_Error`, and a failed Logs row, so no new Sheet endpoint is required.
- The existing regression test checks only callback presence and currently assumes all AgentTask/API confirmation callbacks use `stage=confirmed`.
