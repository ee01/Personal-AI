# Quick Ask 语音输入控制边界改进计划

## 目标功能

- 随机选中：`Quick Ask 语音输入`
- 所在文档：`docs/features/doubao_bridge.md`
- 主要代码：`desktop-app/app/quick-ask.js`、`desktop-app/app/i18n.js`
- 主要验证：`desktop-app/scripts/quick-ask-status-card-check.mjs`

## 当前判断

- 文档描述基本是最新的：Quick Ask 语音输入已经使用 macOS 本机 Speech / AVFoundation helper，transcript 先进入草稿，用户确认后才发起 Ask，并保留权限恢复、空转写、识别中断和不保存原始音频边界。
- 代码主回执已经覆盖这些状态，但 `voice-orb`、返回文本、发送、权限恢复按钮仍使用静态 `aria-label`。读屏、hover 或只扫按钮的用户难以在点击前分辨当前点击会停止监听、重新开始、只把草稿带回文本框、打开权限设置，还是按当前范围提交转写文本。
- Reminder：EventKit 读到本机 `Personal AI` 列表，未完成项为 0；没有可并入的用户反馈。

## 外部参照

- Raycast Dictation 把 review / insert mode、push-to-talk、波形、权限和隐私说明作为同一路径里的核心控制点：https://manual.raycast.com/ai/dictation
- Apple Speech 授权是运行时状态，用户之后仍可在系统设置中更改 Speech Recognition 访问权限：https://developer.apple.com/documentation/speech/asking-permission-to-use-speech-recognition
- Apple macOS 支持逐 app 管理 Speech Recognition 权限，所以恢复入口需要直达且说明影响范围：https://support.apple.com/guide/mac-help/control-access-to-speech-recognition-on-mac-mchl48fbbd25/mac
- Microsoft Research 的 Voice Typing 研究强调实时转写和即时修正能降低纠错负担：https://www.microsoft.com/en-us/research/publication/voice-typing-new-speech-interaction-model-dictation-touchscreen-devices-2/
- Mondegreen / voice search correction 研究说明 ASR 错误会伤害查询结果，支持发送前复核草稿而不是自动提交：https://arxiv.org/abs/2105.09930

## 实施步骤

1. 在 `quick-ask.js` 增加语音按钮边界生成函数，按当前 voice phase、草稿、错误、scope 和 locale 生成动态 `title` / `aria-label`。
2. 在 `renderVoiceSheet()` 中同步更新 `voice-orb`、`voice-cancel`、`voice-send`、`voice-recovery` 的按钮级边界。
3. 扩展 Quick Ask 现有 E2E，覆盖 listening、stopped empty、speech permission recovery、interrupted draft、stopped draft 和 send draft 的按钮属性。
4. 更新 `docs/features/doubao_bridge.md` 与 `docs/index.md`，保持文档简洁描述当前真实行为。
5. 验证：`node --check desktop-app/app/quick-ask.js`、`node --check desktop-app/scripts/quick-ask-status-card-check.mjs`、`npm start` 首次成功编译、`node desktop-app/scripts/quick-ask-status-card-check.mjs`、scoped `git diff --check`。
