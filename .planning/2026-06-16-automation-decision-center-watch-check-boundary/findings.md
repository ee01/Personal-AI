# Decision Center Watch Check Boundary Findings

## Repository Findings

- Random selection from `docs/index.md`: `决策中心`, capability `Memory Service`, source doc `docs/memory_system.md`.
- `docs/progressing/to-verify.md` currently says `暂无。`.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; no visible `Personal AI` list.
- Current UI already separates `需你拍板`, `稍后决策`, and `待观察`, has review-package copy, deep-link highlighting, partial queue failure handling, and post-action receipts.
- `GET /confirm-requests` supports queue/state filtering. `POST /confirm-requests/:id/state` lets watch items create/reuse a read-only OpenClaw verification action on `state=pending`.
- UX gap: the watch card says `立即查证会创建一条只读 OpenClaw 查证动作，用于补证据`, but a user can still read the button as immediate evidence confirmation. The post-action receipt should also name that Action Queue is the truth surface for OpenClaw configuration, execution, or failure state.

## External Reference Findings

- Zapier Human in the Loop pauses a Zap so a human can review before the workflow continues, and its data-collection action can notify reviewers by email, Slack, or another Zap: https://help.zapier.com/hc/en-us/articles/38731264910733-Collect-data-for-your-workflow-with-Human-in-the-Loop
- Microsoft Copilot Studio RFI frames human review as pausing execution, collecting reviewer input, and using that input in later flow steps; it also documents channel/tenant constraints and first-response behavior: https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information
- GitHub Copilot agent responsible-use docs emphasize transparency about agent capabilities, limitations, safety mitigations, and user/deployer choices: https://docs.github.com/en/copilot/responsible-use/agents
- Automation-bias research warns that AI-assisted decisions can encourage over-reliance and systematic acceptance of flawed suggestions; Decision Center should keep evidence-checking and final decision authority visibly separate from automated follow-up actions: https://link.springer.com/article/10.1007/s00146-025-02422-7 and https://hdsr.mitpress.mit.edu/pub/nrcn4h7d/release/2

## Implementation Notes

- Do not add another confirmation modal. The problem is not missing permission; it is ambiguous execution semantics.
- Keep copy compact because the card already has several visible boundary lines.
- Update E2E assertions around the watch lane so this boundary does not regress.
