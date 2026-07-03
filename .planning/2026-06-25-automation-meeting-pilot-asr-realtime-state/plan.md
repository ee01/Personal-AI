# Meeting Pilot 分层 ASR 实时状态计划

## 目标

随机目标：`Meeting Pilot / 分层 ASR`。

真实用户问题：Speech 面板已经能说明 ASR 层级、上传边界、首条 transcript watchdog 和旧转写新鲜度，但本地 ASR final-only 场景仍容易被读成“ASR 坏了”或“会议没人说话”。本次只做展示层增强，让用户在第一眼看到当前是 live partial preview 可用、等待 final transcript、等待首条浏览器转写，还是确实没有可用转写层。

## 外部参考

- Microsoft Teams live captions 明确区分实时 captions 与可下载 transcript；captions 不会保存，保存 transcript 需要单独开启 transcription。
- Zoom automated captions 由主持人在会中显式启用，参与者可打开 transcript panel；平台把 captions / transcript / host 控制分开呈现。
- Live caption stability 研究指出 caption 文本稳定性会显著影响阅读体验，说明用户需要知道当前 live 文本是否稳定，而不只是“ASR 正在运行”。
- ASR confidence / error detection 研究提示单一置信分或“已识别”状态不能充分解释错误，产品层需要更清晰的状态和恢复路径。

## 实施步骤

1. 在 `SpeechTab.tsx` 的 ASR 链路回执中增加 `实时状态` 行。
2. 对 Local ASR final-only 状态，把摘要从通用“等待首条转写”改为“等待 final transcript · 当前无 live preview”。
3. 保持 ASR provider 和 orchestrator 切层逻辑不变，只改用户可见解释。
4. 扩展 `meeting-pilot-scene2-runtime-check.mjs`，覆盖 Web Speech 等待、Local ASR final-only 和 Local ASR stream warning 的新实时状态。
5. 更新 `docs/features/meeting_pilot.md`，补充 `实时状态` 行和 final-only 排障说明。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/asr/__tests__/orchestrator.test.ts src/meeting-shell/asr/__tests__/desktopLocalAsrProvider.test.ts`
- `npm start` 等首次 webpack dev compile 成功后停止。
- `npm --prefix desktop-app run test:meeting-pilot-scene2`
- Scoped `git diff --check`。
