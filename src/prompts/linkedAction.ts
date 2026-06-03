/**
 * 联动操作建议相关 Prompt 模板
 *
 * 用于根据消息上下文和已有样例/历史，生成一条可编辑的联动操作建议。
 */

export function buildLinkedActionSuggestionPrompt(params: {
  seedPrompt: string;
  sourceType: 'history' | 'sample';
  sourceLabel: string;
  contextLine: string;
  configSignalLine?: string;
}): string {
  const { seedPrompt, sourceType, sourceLabel, contextLine, configSignalLine } =
    params;

  return `你在帮用户为一条聊天消息生成“联动操作”建议。这条建议会直接写入记忆入口规则，命中后由系统规划成 RuntimeAction，并在需要时委派给 OpenClaw 或其他执行器。

请基于下面的参考，生成一条自然语言联动操作描述：

参考来源类型：${sourceType === 'history' ? '用户历史规则' : '内置样例'}
参考来源：${sourceLabel}
参考内容：
${seedPrompt}

当前消息：
${contextLine}
${configSignalLine ? `\n${configSignalLine}` : ''}

要求：
1. 输出中文，1-3 句，直接给出建议文本，不要解释、不要标题、不要编号。
2. 尽量提取消息中的对象、时间、目标系统和执行条件。
3. 优先写成明确、可执行的自然语言任务；如果 Memory Service 能内部判断就让它内部规划，否则系统会带消息上下文委派 OpenClaw 判断能力并执行，不要因为不在样例动作族里就强行改写。
4. 如果关键信息缺失，要在建议里写出“识别不到则不执行 / 转为待确认”这类保护条件。
5. 不要把建议写成泛泛而谈的“后续处理一下”；要写成可执行动作。
6. 不要输出代码块，不要输出 JSON。`;
}
