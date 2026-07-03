import type {
  ReflectionResearchAttempt,
  ReflectionThread,
  RuntimeAction,
} from '../services/MemoryServiceClient';

export type ReflectionHandoffTone =
  | 'ready'
  | 'waiting'
  | 'attention'
  | 'paused'
  | 'closed';

export interface ReflectionHandoffReceipt {
  title: string;
  summary: string;
  nextStep: string;
  boundary: string;
  recovery: string;
  tone: ReflectionHandoffTone;
  chips: string[];
}

export interface ReflectionOperationScopeReceipt {
  title: string;
  summary: string;
  runScope: string;
  stateScope: string;
  boundary: string;
  recovery: string;
  tone: ReflectionHandoffTone;
  chips: string[];
}

interface BuildReflectionHandoffReceiptInput {
  thread: ReflectionThread;
  actions?: RuntimeAction[];
  researchAttempts?: ReflectionResearchAttempt[];
  outreachLoadError?: string;
  outreachSessionCount?: number;
  nowMs?: number;
}

type BuildReflectionOperationScopeReceiptInput = BuildReflectionHandoffReceiptInput;

const WAITING_REASON_LABELS: Record<
  string,
  { title: string; nextStep: string; boundary: string; recovery: string }
> = {
  waiting_for_delegation: {
    title: '等待外部委派回流',
    nextStep: '等 OpenClaw 或外部工具返回结构化结果后再进入下一轮反思。',
    boundary: '不会把未校验的外部过程当成已完成结论。',
    recovery: '在动作队列里查看委派结果，失败时先重试或改为手动处理。',
  },
  waiting_for_confirm_request: {
    title: '等待用户确认',
    nextStep: '需要先在决策中心确认关键问题，反思才会继续推进。',
    boundary: '不会自行越过需要用户判断的高责任边界。',
    recovery: '打开决策中心处理确认项；处理后可回到这里立即自我反思。',
  },
  waiting_for_outreach: {
    title: '等待主动询问回复',
    nextStep: '等关联主动询问拿到回复，或手动重试/取消后再继续。',
    boundary: '不会编造外部联系人的答案，也不会替用户发送新追问。',
    recovery: '在关联主动询问里查看会话状态；失败或无回复时可手动恢复。',
  },
  waiting_for_manual_action: {
    title: '等待手动动作',
    nextStep: '需要先处理动作队列中的手动动作，再继续自我反思。',
    boundary: '不会自动执行需要用户负责的动作。',
    recovery: '在动作队列执行、取消或重试手动动作。',
  },
};

export function buildReflectionHandoffReceipt(
  input: BuildReflectionHandoffReceiptInput,
): ReflectionHandoffReceipt {
  const nowMs = input.nowMs ?? Date.now();
  const thread = input.thread;
  const actions = input.actions ?? [];
  const researchAttempts = input.researchAttempts ?? [];
  const failedActions = actions.filter((action) =>
    ['failed', 'dead_letter'].includes(action.queueStatus),
  ).length;
  const pendingActions = actions.filter((action) =>
    ['queued', 'running'].includes(action.queueStatus),
  ).length;
  const failedResearch = researchAttempts.filter(
    (attempt) => attempt.status === 'failed',
  ).length;
  const hitResearch = researchAttempts.filter(
    (attempt) => attempt.status === 'hit',
  ).length;
  const skippedResearch = researchAttempts.filter(
    (attempt) => attempt.status === 'skipped',
  ).length;
  const waiting = thread.continueReason
    ? WAITING_REASON_LABELS[thread.continueReason]
    : undefined;

  const chips = compactStrings([
    `状态 ${statusLabel(thread.status)}`,
    thread.reflectionCount > 0 ? `运行 ${thread.reflectionCount}` : '尚未运行',
    thread.openQuestions.length > 0
      ? `开放问题 ${thread.openQuestions.length}`
      : undefined,
    thread.nextReflectionAt
      ? `下次 ${relativeTime(thread.nextReflectionAt, nowMs)}`
      : undefined,
    pendingActions > 0 ? `待处理动作 ${pendingActions}` : undefined,
    failedActions > 0 ? `失败动作 ${failedActions}` : undefined,
    researchAttempts.length > 0 ? `研究 trace ${researchAttempts.length}` : undefined,
    hitResearch > 0 ? `研究命中 ${hitResearch}` : undefined,
    skippedResearch > 0 ? `未补查 ${skippedResearch}` : undefined,
    failedResearch > 0 ? `研究失败 ${failedResearch}` : undefined,
    input.outreachSessionCount && input.outreachSessionCount > 0
      ? `主动询问 ${input.outreachSessionCount}`
      : undefined,
  ]);

  if (thread.status === 'closed') {
    return {
      title: '反思已关闭',
      summary: thread.closureReason || '这条长期复盘已经停止自动推进。',
      nextStep: '只有恢复线程或新证据重新触发时才会继续。',
      boundary: '关闭状态不会再自动生成动作、通知或场景预演。',
      recovery: '如果仍需跟进，点击恢复后再立即自我反思。',
      tone: 'closed',
      chips,
    };
  }

  if (thread.status === 'paused') {
    return {
      title: '反思已暂停',
      summary: '系统会保留证据和历史，但暂时不自动进入下一轮。',
      nextStep: '用户恢复后，线程才会重新进入 heartbeat 推进。',
      boundary: '暂停期间不会自动生成动作、通知或场景预演。',
      recovery: '点击恢复；如要立刻补查，可恢复后再点立即自我反思。',
      tone: 'paused',
      chips,
    };
  }

  if (failedActions > 0 || input.outreachLoadError) {
    return {
      title: '推进需要修复',
      summary: failedActions > 0
        ? `有 ${failedActions} 个动作失败或进入 dead letter，反思不会把它当成已完成。`
        : '关联主动询问状态暂时读不到，主反思仍可查看。',
      nextStep: failedActions > 0
        ? '先处理动作队列里的失败动作，再决定是否重新反思。'
        : '先重试关联主动询问区块，确认外部等待状态。',
      boundary: '失败和子链路读取错误会暴露出来，不会伪装成暂无结果。',
      recovery: failedActions > 0
        ? '在动作队列重试、取消或改为手动处理失败项。'
        : '点击关联主动询问区块的重试；必要时稍后刷新详情页。',
      tone: 'attention',
      chips,
    };
  }

  if (waiting) {
    return {
      title: waiting.title,
      summary: thread.latestSummary || '线程正在等待下一步输入。',
      nextStep: waiting.nextStep,
      boundary: waiting.boundary,
      recovery: waiting.recovery,
      tone: 'waiting',
      chips,
    };
  }

  if (pendingActions > 0) {
    return {
      title: '动作队列待处理',
      summary: `有 ${pendingActions} 个动作正在排队或执行，反思会等动作状态稳定后继续。`,
      nextStep: '先观察动作队列状态；运行完成后可回到这里复核结果。',
      boundary: '动作结果回流前不会提前沉淀为新结论。',
      recovery: '动作卡住时可在动作队列执行、重试或取消。',
      tone: 'waiting',
      chips,
    };
  }

  if (failedResearch > 0) {
    return {
      title: '本地研究有失败',
      summary: `最近研究补查有 ${failedResearch} 条查询失败，结论可能缺少部分证据。`,
      nextStep: '查看研究补查过程，必要时立即自我反思重新查询。',
      boundary: '研究失败会保留为失败 trace，不会被算作没有结果。',
      recovery: '修复召回/索引后点击立即自我反思。',
      tone: 'attention',
      chips,
    };
  }

  const nextReflectionMs = normalizeTimestamp(thread.nextReflectionAt);
  if (nextReflectionMs && nextReflectionMs > nowMs) {
    return {
      title: '已排下一轮反思',
      summary: '当前线程会在计划时间由 heartbeat 自动推进。',
      nextStep: `下一轮预计 ${relativeTime(thread.nextReflectionAt, nowMs)}。`,
      boundary: '计划推进只会读取本地可见证据；高责任动作仍走确认或动作队列。',
      recovery: '需要提前处理时，可点击立即自我反思。',
      tone: 'ready',
      chips,
    };
  }

  return {
    title: '可以继续反思',
    summary: thread.latestSummary || '线程已有可复核上下文，等待下一轮处理。',
    nextStep: nextReflectionMs
      ? '这条线程已经到达计划时间，可由 heartbeat 或手动按钮继续。'
      : '等待新证据进入，或由用户手动触发补查。',
    boundary: '反思只沉淀本地记忆和候选动作，不会直接代表用户对外发送。',
    recovery: '点击立即自我反思可马上补查本地证据。',
    tone: 'ready',
    chips,
  };
}

export function buildReflectionOperationScopeReceipt(
  input: BuildReflectionOperationScopeReceiptInput,
): ReflectionOperationScopeReceipt {
  const thread = input.thread;
  const actions = input.actions ?? [];
  const researchAttempts = input.researchAttempts ?? [];
  const failedActions = actions.filter((action) =>
    ['failed', 'dead_letter'].includes(action.queueStatus),
  ).length;
  const pendingActions = actions.filter((action) =>
    ['queued', 'running'].includes(action.queueStatus),
  ).length;
  const failedResearch = researchAttempts.filter(
    (attempt) => attempt.status === 'failed',
  ).length;
  const hitResearch = researchAttempts.filter(
    (attempt) => attempt.status === 'hit',
  ).length;
  const skippedResearch = researchAttempts.filter(
    (attempt) => attempt.status === 'skipped',
  ).length;
  const waiting = thread.continueReason
    ? WAITING_REASON_LABELS[thread.continueReason]
    : undefined;

  const chips = compactStrings([
    `线程 ${statusLabel(thread.status)}`,
    thread.reflectionCount > 0 ? `已有运行 ${thread.reflectionCount}` : '尚未运行',
    pendingActions > 0 ? `待处理动作 ${pendingActions}` : undefined,
    failedActions > 0 ? `失败动作 ${failedActions}` : undefined,
    researchAttempts.length > 0 ? `研究 trace ${researchAttempts.length}` : undefined,
    hitResearch > 0 ? `研究命中 ${hitResearch}` : undefined,
    skippedResearch > 0 ? `未补查 ${skippedResearch}` : undefined,
    failedResearch > 0 ? `研究失败 ${failedResearch}` : undefined,
    input.outreachLoadError ? '主动询问读取失败' : undefined,
    waiting ? waiting.title : undefined,
  ]);

  const runScope =
    thread.status === 'active'
      ? '立即自我反思会读取本地可见证据，写入一条 manual_revisit 运行、研究 trace 和可能的候选动作。'
      : '立即自我反思仍只是一次手动 run；它不会把 paused/closed 状态自动改回 active。';
  const boundary =
    '本次点击本身不会发送消息、确认决策、执行 OpenClaw、写 confirmed profile 或删除原始证据。';
  const recovery =
    failedActions > 0
      ? '先在动作队列重试、取消或改为手动处理失败动作，再决定是否重新反思。'
      : input.outreachLoadError
        ? '先重试关联主动询问区块，确认等待状态后再继续推进。'
        : '如果操作失败，页面会保留错误；可重试、刷新详情或回到线程列表。';

  if (thread.status === 'closed') {
    return {
      title: '关闭线程的操作范围',
      summary: '这条线程已停止自动推进；历史、证据、运行记录和动作结果仍可复核。',
      runScope,
      stateScope:
        '恢复只把线程设回 active 并排到现在；关闭不会删除证据或撤销已发生的外部副作用。',
      boundary,
      recovery,
      tone: 'closed',
      chips,
    };
  }

  if (thread.status === 'paused') {
    return {
      title: '暂停线程的操作范围',
      summary: '暂停期间 heartbeat 不会自动推进，但用户仍可手动复核或恢复线程。',
      runScope,
      stateScope:
        '恢复只把线程设回 active 并排到现在；关闭只停止后续推进，不删除历史证据。',
      boundary,
      recovery,
      tone: 'paused',
      chips,
    };
  }

  if (failedActions > 0 || input.outreachLoadError || failedResearch > 0) {
    return {
      title: '推进前先看阻塞范围',
      summary:
        '这条线程仍可手动反思，但当前存在失败动作、研究失败或关联状态读取失败。',
      runScope,
      stateScope:
        '暂停会停止自动推进；关闭会停止后续推进；两者都不清空动作队列、主动询问或研究记录。',
      boundary,
      recovery,
      tone: 'attention',
      chips,
    };
  }

  if (waiting || pendingActions > 0) {
    return {
      title: '等待中的操作范围',
      summary:
        '这条线程正在等待外部回复、确认项或动作结果；手动推进不会替这些子链路补结果。',
      runScope,
      stateScope:
        '暂停只停止自动推进；关闭停止后续推进；恢复入口只在 paused/closed 状态出现。',
      boundary,
      recovery,
      tone: 'waiting',
      chips,
    };
  }

  return {
    title: '可推进线程的操作范围',
    summary: '当前线程可由 heartbeat 或用户手动进入下一轮本地反思。',
    runScope,
    stateScope:
      '暂停只把线程改为 paused；关闭只把线程改为 closed；都不改写已有运行和证据。',
    boundary,
    recovery,
    tone: 'ready',
    chips,
  };
}

function compactStrings(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function statusLabel(status: ReflectionThread['status']) {
  if (status === 'active') return '进行中';
  if (status === 'paused') return '已暂停';
  return '已关闭';
}

function normalizeTimestamp(ts?: number): number | undefined {
  if (!ts) return undefined;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function relativeTime(ts: number | undefined, nowMs: number) {
  const normalized = normalizeTimestamp(ts);
  if (!normalized) return '未知';
  const diff = normalized - nowMs;
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60000);
  if (minutes < 1) return diff >= 0 ? '即将' : '刚刚';
  if (minutes < 60) return diff >= 0 ? `${minutes}分钟后` : `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `${hours}小时后` : `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `${days}天后` : `${days}天前`;
}
