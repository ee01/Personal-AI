# Install Playwright + webpage-mcp in OpenCode Global Config

## TL;DR

> **Quick Summary**: Safely add two local MCP server definitions to the user's macOS-wide OpenCode config, preserving existing global settings and validating both servers through OpenCode CLI before considering the work complete.
>
> **Deliverables**:
>
> - Global OpenCode config updated at `~/.config/opencode/opencode.jsonc`
> - `playwright` MCP definition added and validated
> - `webpage-mcp` definition added only after command/protocol validation
> - Evidence bundle captured under `.sisyphus/evidence/`
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves + final verification
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 6

---

## Context

### Original Request

用户想把两个 MCP server 安装到 **本机全局 OpenCode 配置** 中：

- Playwright MCP
- webpage-mcp

### Interview Summary

**Key Discussions**:

- 目标宿主明确为 OpenCode / 当前助手环境
- 作用域明确为“本机全局配置”，不是项目级配置
- 本次范围仅包含这两个 MCP server，不扩展到其他客户端

**Research Findings**:

- 官方全局配置路径为 `~/.config/opencode/opencode.json` / `.jsonc`
- 当前机器实际已存在 `~/.config/opencode/opencode.jsonc`
- 当前全局配置暂无 MCP 条目，适合增量接入
- OpenCode 支持本地 MCP schema：`type: "local"` + `command: [...]`
- OpenCode CLI 可用 `opencode mcp list` / `opencode mcp debug <name>` 做验证
- `@playwright/mcp` 看起来符合预期；`webpage-mcp-stdio` 存在兼容性风险，需先验证是否真为标准 stdio MCP

### Metis Review

**Identified Gaps** (addressed):

- 不能假设 `webpage-mcp-stdio` 一定能被 OpenCode 当作标准 stdio MCP 接入 → 已单独拆成前置验证任务
- 不能假设应写入 `opencode.json` 还是 `opencode.jsonc` → 已以现存 `.jsonc` 为目标文件
- 不能假设可安全覆盖全局配置 → 已增加备份与增量合并 guardrail

---

## Work Objectives

### Core Objective

在不破坏现有 OpenCode 全局设置的前提下，把 `playwright` 与 `webpage-mcp` 以本地 MCP server 形式接入到用户的全局 OpenCode 配置，并通过 CLI 完成可重复验证。

### Concrete Deliverables

- `~/.config/opencode/opencode.jsonc` 中存在 `mcp.playwright`
- `~/.config/opencode/opencode.jsonc` 中存在 `mcp.webpage-mcp`（仅在命令/protocol 验证通过后启用）
- 备份文件存在且可回滚
- `.sisyphus/evidence/` 中存在各任务验证证据

### Definition of Done

- [ ] `opencode mcp list` 能列出 `playwright`
- [ ] `opencode mcp debug playwright` 成功启动并返回非错误状态
- [ ] `webpage-mcp-stdio` 已通过独立协议/可执行性验证
- [ ] `opencode mcp list` 能列出 `webpage-mcp`
- [ ] 未覆盖或删除现有全局配置中的无关键

### Must Have

- 增量修改现有全局配置，不覆盖 unrelated providers/plugins/settings
- 对真实配置文件先做备份再改动
- 所有命令使用非交互方式（例如 `npx -y`）
- 对 `webpage-mcp` 做前置兼容性验证后再进入最终启用态

### Must NOT Have (Guardrails)

- 不得改写项目级 `opencode.json` / `opencode.jsonc`
- 不得清空或重建整个全局配置文件
- 不得静默替换 `webpage-mcp` 为其他包名或替代服务
- 不得把验证失败的 MCP 留在“启用且不可用”的状态
- 不得依赖人工手动点点看作为唯一验收方式

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision

- **Infrastructure exists**: NO dedicated automated test framework for this user-level config task
- **Automated tests**: None
- **Framework**: none
- **Agent-Executed QA**: ALWAYS

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Config / CLI validation**: Use Bash
- **Interactive/TUI checks**: Use interactive_bash only if direct `opencode` interaction is needed
- **No browser automation required** for the installation itself

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by separating discovery from config mutation and final validation.

```text
Wave 1 (Start Immediately - discovery + safety):
├── Task 1: Snapshot existing global config and choose target file [quick]
├── Task 2: Validate Playwright MCP launch command non-interactively [quick]
└── Task 3: Validate webpage-mcp stdio/protocol compatibility [unspecified-high]

Wave 2 (After Wave 1 - write config + validate):
├── Task 4: Add playwright MCP entry to global config (depends: 1, 2) [quick]
├── Task 5: Add webpage-mcp entry with safe enablement rules (depends: 1, 3) [unspecified-high]
└── Task 6: Run OpenCode CLI validation, capture evidence, and confirm rollback path (depends: 4, 5) [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Configuration quality review (unspecified-high)
├── Task F3: Real manual QA execution of all CLI scenarios (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: 1 → 3 → 5 → 6 → F1-F4 → user okay
Parallel Speedup: ~40% faster than strict sequential
Max Concurrent: 3
```

### Dependency Matrix

- **1**: - → 4, 5
- **2**: - → 4
- **3**: - → 5
- **4**: 1, 2 → 6
- **5**: 1, 3 → 6
- **6**: 4, 5 → F1, F2, F3, F4

### Agent Dispatch Summary

- **Wave 1**: **3** - T1 → `quick`, T2 → `quick`, T3 → `unspecified-high`
- **Wave 2**: **3** - T4 → `quick`, T5 → `unspecified-high`, T6 → `quick`
- **FINAL**: **4** - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Snapshot existing global config and select the authoritative target file

  **What to do**:
  - Inspect `~/.config/opencode/` and confirm the real target file (`opencode.jsonc` if that is the existing active file)
  - Create a timestamped backup of the target file before any edits
  - Record the before-state: file path, size, timestamp, and top-level keys present

  **Must NOT do**:
  - Overwrite the config without a backup
  - Change from `.jsonc` to `.json` unless no JSONC file exists
  - Touch any project-level `opencode.json` / `opencode.jsonc`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward filesystem inspection and backup work
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction required
    - `git-master`: No git work is involved

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: 4, 5
  - **Blocked By**: None

  **References**:
  - `~/.config/opencode/opencode.jsonc` - Existing global config file to preserve and extend
  - `https://open-code.ai/en/docs/config#global` - Official global config location and precedence
  - `https://open-code.ai/en/docs/config#precedence-order` - Why this must be edited globally, not in the project root

  **Acceptance Criteria**:
  - [ ] Exactly one authoritative global config target is selected
  - [ ] A backup copy of that file exists before mutation
  - [ ] Evidence captures the pre-change state and confirms no project-level config was created

  **QA Scenarios**:

  ```text
  Scenario: Backed-up target file exists before mutation
    Tool: Bash
    Preconditions: User's OpenCode global config directory exists
    Steps:
      1. Run `ls -l ~/.config/opencode > .sisyphus/evidence/task-1-config-dir.txt`
      2. Run `ls -l ~/.config/opencode/opencode.jsonc* >> .sisyphus/evidence/task-1-config-dir.txt`
      3. Assert the evidence file shows both the active config and a backup copy
    Expected Result: One active target file and at least one backup file are visible
    Failure Indicators: No backup file exists; a new project-level config was created instead
    Evidence: .sisyphus/evidence/task-1-config-dir.txt

  Scenario: Project-level config was NOT touched
    Tool: Bash
    Preconditions: Run from the repository root
    Steps:
      1. Run `python - <<'PY'\nfrom pathlib import Path\nroot=Path.cwd()\nprint((root/'opencode.json').exists())\nprint((root/'opencode.jsonc').exists())\nPY > .sisyphus/evidence/task-1-project-config-check.txt`
      2. Assert both printed lines are `False`
    Expected Result: Neither `opencode.json` nor `opencode.jsonc` exists in the project root
    Failure Indicators: Either line is `True`
    Evidence: .sisyphus/evidence/task-1-project-config-check.txt
  ```

  **Evidence to Capture:**
  - [ ] `.sisyphus/evidence/task-1-config-dir.txt`
  - [ ] `.sisyphus/evidence/task-1-project-config-check.txt`

  **Commit**: NO

- [x] 2. Validate the Playwright MCP launch command in non-interactive mode

  **What to do**:
  - Confirm the final command array uses `npx -y @playwright/mcp@latest`
  - Smoke-test the package outside OpenCode to prove it launches cleanly
  - Record whether any browser runtime remediation is needed

  **Must NOT do**:
  - Use interactive `npx` prompts
  - Assume browser binaries exist without evidence

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-command validation with clear pass/fail output
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: The MCP package is being installed, not used for browser automation yet

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: 4
  - **Blocked By**: None

  **References**:
  - User-provided command intent: `npx @playwright/mcp@latest`
  - `https://open-code.ai/en/docs/mcp-servers#local` - Local MCP command-array format for OpenCode
  - `https://opencode.ai/config.json` - Official config schema for local MCP entries

  **Acceptance Criteria**:
  - [ ] Chosen command array is `['npx', '-y', '@playwright/mcp@latest']`
  - [ ] Smoke test exits successfully or produces conclusive remediation evidence
  - [ ] Evidence captures stdout/stderr from the smoke test

  **QA Scenarios**:

  ```text
  Scenario: Playwright MCP package starts successfully
    Tool: Bash
    Preconditions: Node and npx are available in PATH
    Steps:
      1. Run `npx -y @playwright/mcp@latest --help > .sisyphus/evidence/task-2-playwright-help.txt 2>&1`
      2. Capture exit code with `printf '%s\n' $? > .sisyphus/evidence/task-2-playwright-exit.txt`
      3. Assert exit code is `0` and the help file is non-empty
    Expected Result: Package launches non-interactively and prints help/usage output
    Failure Indicators: Non-zero exit code; empty output; prompt requiring manual confirmation
    Evidence: .sisyphus/evidence/task-2-playwright-help.txt

  Scenario: Error path is captured for an invalid package name
    Tool: Bash
    Preconditions: Network access is available for npm resolution
    Steps:
      1. Run `npx -y @playwright/not-a-real-package --help > .sisyphus/evidence/task-2-invalid-package.txt 2>&1; printf '%s\n' $? > .sisyphus/evidence/task-2-invalid-package-exit.txt`
      2. Assert the exit code is non-zero
    Expected Result: Failure is explicit and captured in evidence rather than hanging interactively
    Failure Indicators: Command hangs or exits `0`
    Evidence: .sisyphus/evidence/task-2-invalid-package.txt
  ```

  **Evidence to Capture:**
  - [ ] `.sisyphus/evidence/task-2-playwright-help.txt`
  - [ ] `.sisyphus/evidence/task-2-playwright-exit.txt`
  - [ ] `.sisyphus/evidence/task-2-invalid-package.txt`

  **Commit**: NO

- [x] 3. Validate whether `webpage-mcp-stdio` behaves like a standard stdio MCP server

  **What to do**:
  - Probe `npx -y -p webpage-mcp@latest webpage-mcp-stdio` outside OpenCode
  - Determine whether it stays alive as a stdio process or fails immediately
  - Capture a written compatibility conclusion that Task 5 will follow exactly

  **Must NOT do**:
  - Assume compatibility based only on package name
  - Enable the server in final config without evidence
  - Substitute another package if this one fails

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: The package behavior is ambiguous and needs careful protocol-oriented validation
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Unrelated to this server

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: 5
  - **Blocked By**: None

  **References**:
  - User-provided command: `npx -y -p webpage-mcp@latest webpage-mcp-stdio`
  - `https://open-code.ai/en/docs/mcp-servers#local` - What OpenCode expects from a local MCP command
  - `https://modelcontextprotocol.io/` - Baseline expectation for stdio MCP server behavior

  **Acceptance Criteria**:
  - [ ] Evidence clearly states whether `webpage-mcp-stdio` is compatible or incompatible
  - [ ] Evidence includes stdout/stderr and exit behavior from the probe
  - [ ] Task 5 has an explicit enablement rule based on this result

  **QA Scenarios**:

  ```text
  Scenario: webpage-mcp stdio probe produces a conclusive launch result
    Tool: Bash
    Preconditions: Node and npx are available in PATH
    Steps:
      1. Run `python - <<'PY'\nimport subprocess, time, os\ncmd=['npx','-y','-p','webpage-mcp@latest','webpage-mcp-stdio']\nout=open('.sisyphus/evidence/task-3-webpage-probe.txt','w')\nproc=subprocess.Popen(cmd, stdout=out, stderr=subprocess.STDOUT, text=True)\ntime.sleep(3)\nstatus='running' if proc.poll() is None else f'exited:{proc.returncode}'\nopen('.sisyphus/evidence/task-3-webpage-status.txt','w').write(status)\nif proc.poll() is None: proc.terminate()\nPY`
      2. Assert the status file contains either `running` or an explicit exit code
    Expected Result: The agent has conclusive evidence about whether the process behaves like a persistent stdio server
    Failure Indicators: No status file; no output captured; ambiguous result
    Evidence: .sisyphus/evidence/task-3-webpage-status.txt

  Scenario: Help/usage behavior is captured if the server does not behave like stdio
    Tool: Bash
    Preconditions: Same environment as above
    Steps:
      1. Run `npx -y -p webpage-mcp@latest webpage-mcp-stdio --help > .sisyphus/evidence/task-3-webpage-help.txt 2>&1; printf '%s\n' $? > .sisyphus/evidence/task-3-webpage-help-exit.txt`
      2. Assert both files exist even if output is empty or exit code is non-zero
    Expected Result: Failure/ambiguity is documented, not guessed
    Failure Indicators: No evidence for the probe outcome
    Evidence: .sisyphus/evidence/task-3-webpage-help.txt
  ```

  **Evidence to Capture:**
  - [ ] `.sisyphus/evidence/task-3-webpage-probe.txt`
  - [ ] `.sisyphus/evidence/task-3-webpage-status.txt`
  - [ ] `.sisyphus/evidence/task-3-webpage-help.txt`

  **Commit**: NO

---

- [x] 4. Add the `playwright` MCP entry to the global OpenCode config

  **What to do**:
  - Merge a `mcp.playwright` entry into `~/.config/opencode/opencode.jsonc`
  - Use the command array `['npx', '-y', '@playwright/mcp@latest']`
  - Set `type: 'local'`, `enabled: true`, and a non-fragile timeout (recommend `10000` ms)

  **Must NOT do**:
  - Reformat or rewrite unrelated config sections
  - Drop existing providers/plugins/theme settings
  - Use a string command instead of the documented command array

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused config edit with a single deterministic entry
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Installing the MCP server does not require browser automation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: 6
  - **Blocked By**: 1, 2

  **References**:
  - `~/.config/opencode/opencode.jsonc` - Actual file to edit
  - `https://open-code.ai/en/docs/mcp-servers#local` - Canonical local MCP config structure
  - `https://opencode.ai/config.json` - Official schema validating `type`, `command`, `enabled`, and `timeout`

  **Acceptance Criteria**:
  - [ ] `mcp.playwright` exists in the global config
  - [ ] The command array exactly matches `['npx', '-y', '@playwright/mcp@latest']`
  - [ ] Unrelated top-level config keys remain present after the edit

  **QA Scenarios**:

  ```text
  Scenario: Playwright entry exists with the expected fields
    Tool: Bash
    Preconditions: Task 4 completed
    Steps:
      1. Run `python - <<'PY'\nfrom pathlib import Path\ntext=Path.home().joinpath('.config/opencode/opencode.jsonc').read_text()\nchecks=['"playwright"','"type": "local"','"@playwright/mcp@latest"','"enabled": true','"timeout": 10000']\nfor item in checks: print(item, item in text)\nPY > .sisyphus/evidence/task-4-playwright-config-check.txt`
      2. Assert every printed check ends with `True`
    Expected Result: The config text contains the expected Playwright MCP fields
    Failure Indicators: Missing key, missing `-y`, missing timeout, or disabled entry
    Evidence: .sisyphus/evidence/task-4-playwright-config-check.txt

  Scenario: Unrelated global settings are still present
    Tool: Bash
    Preconditions: Backup from Task 1 exists
    Steps:
      1. Run `python - <<'PY'\nfrom pathlib import Path\ntext=Path.home().joinpath('.config/opencode/opencode.jsonc').read_text()\nfor key in ['providers','plugins']:\n    print(key, key in text)\nPY > .sisyphus/evidence/task-4-global-keys-check.txt`
      2. Assert expected pre-existing keys are still present
    Expected Result: Existing unrelated config sections remain intact
    Failure Indicators: Any previously existing top-level section disappears
    Evidence: .sisyphus/evidence/task-4-global-keys-check.txt
  ```

  **Evidence to Capture:**
  - [ ] `.sisyphus/evidence/task-4-playwright-config-check.txt`
  - [ ] `.sisyphus/evidence/task-4-global-keys-check.txt`

  **Commit**: NO

- [x] 5. Add the `webpage-mcp` entry using the compatibility result from Task 3

  **What to do**:
  - Merge a `mcp.webpage-mcp` entry into the same global config
  - Use the command array `['npx', '-y', '-p', 'webpage-mcp@latest', 'webpage-mcp-stdio']`
  - If Task 3 proved compatibility, set `enabled: true`; otherwise keep it disabled and document the blocker explicitly

  **Must NOT do**:
  - Enable the entry when Task 3 produced inconclusive or failing evidence
  - Replace `webpage-mcp` with another package
  - Hide the blocker by writing a broken enabled config

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: The config edit is simple, but the enablement logic depends on ambiguous protocol behavior
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: No overlap with this server

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: 6
  - **Blocked By**: 1, 3

  **References**:
  - `~/.config/opencode/opencode.jsonc` - Actual file to edit
  - Task 3 evidence files - Sole source of truth for enable/disable decision
  - `https://open-code.ai/en/docs/mcp-servers#local` - Expected local MCP server shape

  **Acceptance Criteria**:
  - [ ] `mcp.webpage-mcp` exists in the global config
  - [ ] The command array exactly matches `['npx', '-y', '-p', 'webpage-mcp@latest', 'webpage-mcp-stdio']`
  - [ ] `enabled` reflects Task 3's evidence rather than guesswork

  **QA Scenarios**:

  ```text
  Scenario: webpage-mcp entry exists with the expected command array
    Tool: Bash
    Preconditions: Task 5 completed
    Steps:
      1. Run `python - <<'PY'\nfrom pathlib import Path\ntext=Path.home().joinpath('.config/opencode/opencode.jsonc').read_text()\nchecks=['"webpage-mcp"','"webpage-mcp@latest"','"webpage-mcp-stdio"']\nfor item in checks: print(item, item in text)\nPY > .sisyphus/evidence/task-5-webpage-config-check.txt`
      2. Assert every printed check ends with `True`
    Expected Result: The config text contains the webpage-mcp entry and command components
    Failure Indicators: Missing key or missing package/command parts
    Evidence: .sisyphus/evidence/task-5-webpage-config-check.txt

  Scenario: `enabled` matches Task 3 evidence
    Tool: Bash
    Preconditions: Task 3 evidence and Task 5 config edit both exist
    Steps:
      1. Run `python - <<'PY'\nfrom pathlib import Path\nstatus=Path('.sisyphus/evidence/task-3-webpage-status.txt').read_text().strip()\ntext=Path.home().joinpath('.config/opencode/opencode.jsonc').read_text()\nexpected='"enabled": true' if status=='running' else '"enabled": false'\nprint(status)\nprint(expected)\nprint(expected in text)\nPY > .sisyphus/evidence/task-5-webpage-enabled-check.txt`
      2. Assert the last printed line is `True`
    Expected Result: Enablement state is evidence-driven
    Failure Indicators: Config enablement contradicts Task 3 evidence
    Evidence: .sisyphus/evidence/task-5-webpage-enabled-check.txt
  ```

  **Evidence to Capture:**
  - [ ] `.sisyphus/evidence/task-5-webpage-config-check.txt`
  - [ ] `.sisyphus/evidence/task-5-webpage-enabled-check.txt`

  **Commit**: NO

- [x] 6. Validate both MCP definitions through OpenCode CLI and confirm rollback readiness

  **What to do**:
  - Run `opencode mcp list` and ensure the configured servers are recognized
  - Run `opencode mcp debug playwright`
  - Run `opencode mcp debug webpage-mcp` if Task 5 left it enabled; otherwise confirm the disabled state is intentional and documented
  - Reconfirm that the backup can be restored if validation fails

  **Must NOT do**:
  - Mark the work complete without CLI evidence
  - Treat a disabled `webpage-mcp` entry as a successful installation
  - Delete the backup before final verification passes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Deterministic CLI checks and evidence capture
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Validation is via OpenCode CLI, not browser automation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: 4, 5

  **References**:
  - `https://open-code.ai/en/docs/mcp-servers#authenticating` - OpenCode MCP CLI entry points
  - Task 4 + Task 5 evidence files - Expected configuration state before validation
  - Backup created in Task 1 - Rollback target if validation fails

  **Acceptance Criteria**:
  - [ ] `opencode mcp list` output is captured in evidence
  - [ ] `opencode mcp debug playwright` succeeds
  - [ ] If `webpage-mcp` is enabled, `opencode mcp debug webpage-mcp` succeeds; otherwise the task is blocked and not marked complete
  - [ ] Backup path remains available for rollback

  **QA Scenarios**:

  ```text
  Scenario: OpenCode recognizes the configured MCP servers
    Tool: Bash
    Preconditions: Tasks 4 and 5 completed
    Steps:
      1. Run `opencode mcp list > .sisyphus/evidence/task-6-mcp-list.txt 2>&1`
      2. Assert the output contains `playwright`
      3. If Task 5 enabled webpage-mcp, also assert the output contains `webpage-mcp`
    Expected Result: OpenCode lists the configured server names
    Failure Indicators: Missing server names or CLI error output
    Evidence: .sisyphus/evidence/task-6-mcp-list.txt

  Scenario: OpenCode debug succeeds for enabled servers
    Tool: Bash
    Preconditions: `opencode mcp list` already succeeded
    Steps:
      1. Run `opencode mcp debug playwright > .sisyphus/evidence/task-6-playwright-debug.txt 2>&1; printf '%s\n' $? > .sisyphus/evidence/task-6-playwright-debug-exit.txt`
      2. If webpage-mcp is enabled, run `opencode mcp debug webpage-mcp > .sisyphus/evidence/task-6-webpage-debug.txt 2>&1; printf '%s\n' $? > .sisyphus/evidence/task-6-webpage-debug-exit.txt`
      3. Assert each enabled server has exit code `0`
    Expected Result: Every enabled MCP server debugs successfully through OpenCode
    Failure Indicators: Non-zero debug exit code; timeout; protocol error; missing backup for rollback
    Evidence: .sisyphus/evidence/task-6-playwright-debug.txt
  ```

  **Evidence to Capture:**
  - [ ] `.sisyphus/evidence/task-6-mcp-list.txt`
  - [ ] `.sisyphus/evidence/task-6-playwright-debug.txt`
  - [ ] `.sisyphus/evidence/task-6-playwright-debug-exit.txt`
  - [ ] `.sisyphus/evidence/task-6-webpage-debug.txt` (if enabled)
  - [ ] `.sisyphus/evidence/task-6-webpage-debug-exit.txt` (if enabled)

  **Commit**: NO

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
      Verify that the final state matches this plan exactly: backup exists, `mcp.playwright` exists, `mcp.webpage-mcp` exists only under the plan's enablement rules, and evidence files are present. Reject if unrelated global config keys were modified or removed.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Configuration Quality Review** — `unspecified-high`
      Validate JSONC syntax, confirm command arrays are non-interactive, verify no duplicate/conflicting MCP keys exist, and ensure timeout/enabled settings are intentional.
      Output: `Config Parse [PASS/FAIL] | Commands [PASS/FAIL] | Keys [PASS/FAIL] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
      Re-run every CLI QA scenario from Tasks 1-6 from a clean shell, store stdout/stderr, and verify `opencode` recognizes both configured MCP definitions.
      Output: `Scenarios [N/N pass] | CLI Checks [N/N] | Evidence [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
      Compare original request vs final changes. Confirm only the global OpenCode config and evidence artifacts were touched. Reject any extra package substitution, project-config edits, or unrelated config churn.
      Output: `Tasks [N/N compliant] | Scope Creep [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **No git commit planned**
  - Reason: This work targets user-level machine config outside the repository
  - If any helper notes/scripts are temporarily created during execution, they must be deleted before final verification

---

## Success Criteria

### Verification Commands

```bash
opencode mcp list
opencode mcp debug playwright
opencode mcp debug webpage-mcp
```

### Final Checklist

- [ ] Existing global config preserved
- [ ] Backup exists and is restorable
- [ ] Playwright MCP visible and debuggable in OpenCode
- [ ] webpage-mcp visible and debuggable in OpenCode
- [ ] No project-level config touched
- [ ] Evidence bundle complete under `.sisyphus/evidence/`
