import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MeetingPilotParticipant,
  MeetingPilotASRTier,
  MeetingPilotSessionSnapshot,
  MeetingPilotSpeakerSource,
  MeetingPilotTranscriptChunk,
  MeetingPilotTranscriptTurn,
} from './protocol';

interface SpeechTabProps {
  session: MeetingPilotSessionSnapshot;
  refresh: () => Promise<void>;
}

const SOURCE_LABEL: Record<MeetingPilotSpeakerSource, string> = {
  transcript: 'Speaker',
  caption: 'Caption',
  dom: 'DOM',
  roster: 'Roster',
  continuity: '沿用',
  ai: 'AI',
  user: '用户',
};

const TRANSCRIPT_SOURCE_LABEL: Record<
  NonNullable<MeetingPilotTranscriptChunk['source']>,
  string
> = {
  ringcentral_transcript: 'RC Transcript',
  web_speech: 'On-Device',
  desktop_whisper: 'Local ASR',
  cloud: 'Cloud',
  whisper: 'Whisper',
  test: 'Test',
};

const ASR_SOURCE_LABEL: Record<MeetingPilotASRTier | 'whisper', string> = {
  ringcentral_transcript: 'RingCentral Transcript',
  web_speech: 'Chrome On-Device',
  desktop_whisper: 'Local ASR',
  cloud: 'Cloud',
  whisper: 'Whisper',
};

const ASR_BADGE_LABEL: Record<
  NonNullable<MeetingPilotSessionSnapshot['tier']>['badge'],
  string
> = {
  Probing: '检测中',
  'RC Transcript': 'RingCentral Transcript',
  'On-Device': 'Chrome On-Device',
  'Local ASR': 'Local ASR',
  'Local Whisper': 'Local ASR',
  Cloud: 'Cloud',
  'No ASR': 'No ASR',
};

const ASR_RECEIPT_TIER_LABEL: Record<
  MeetingPilotASRTier | 'whisper',
  string
> = {
  ringcentral_transcript: 'RC 转写',
  web_speech: '本机 Web Speech',
  desktop_whisper: '本地 ASR / Whisper',
  cloud: '云端 ASR',
  whisper: 'Whisper',
};

const ASR_RECEIPT_BADGE_LABEL: Record<
  NonNullable<MeetingPilotSessionSnapshot['tier']>['badge'],
  string
> = {
  Probing: '检测中',
  'RC Transcript': 'RC 转写',
  'On-Device': '本机 Web Speech',
  'Local ASR': '本地 ASR / Whisper',
  'Local Whisper': '本地 ASR / Whisper',
  Cloud: '云端 ASR',
  'No ASR': '无转写',
};

const ASR_MODE_LABEL: Record<
  NonNullable<MeetingPilotSessionSnapshot['tier']>['mode'],
  string
> = {
  auto: '自动 · 本地优先',
  'local-only': '仅本地',
  'cloud-only': '仅云端',
};

const ASR_MODE_DETAIL: Record<
  NonNullable<MeetingPilotSessionSnapshot['tier']>['mode'],
  string
> = {
  auto: '先尝试会议页转写和本地 ASR，失败后才回退云端。',
  'local-only': '只用本机或会议页已有转写，不调用云端 ASR。',
  'cloud-only': '只用配置的云端 ASR，音频片段会发送到转写 API。',
};

const LIVE_TRANSCRIPT_STALE_MS = 120_000;

interface ASRChainReceiptRow {
  label: string;
  value: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}

interface LocalASRReceiptDetail {
  statusLabel: string;
  currentLayerLabel: string;
  nextStep: string;
  tone: ASRChainReceiptRow['tone'];
}

interface WebSpeechReceiptDetail {
  statusLabel: string;
  currentLayerLabel: string;
  freshnessText: string;
  nextStep: string;
}

interface CloudASRReceiptDetail {
  statusLabel: string;
  currentLayerLabel: string;
  endpointLabel: string;
  modelLabel: string;
  languageLabel: string;
  uploadBoundary: string;
  nextStep: string;
}

interface LocalASRProbeIssue {
  summary: string;
  nextStep: string;
  tone: ASRChainReceiptRow['tone'];
}

interface LocalASRStreamWarningDetail {
  statusLabel: string;
  currentLayerLabel: string;
  receiptLine: string;
  nextStep: string;
  tone: ASRChainReceiptRow['tone'];
}

function humanizeLocalASRReason(value: string | undefined): string {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\+/g, ' / ')
    .trim();
}

function getLocalASRStreamWarningDetail(
  reason: string | undefined,
): LocalASRStreamWarningDetail | null {
  const value = String(reason || '').trim();
  const warningMatch = /^Local ASR stream warning \((\d+)\/(\d+)\):\s*(.+)$/i.exec(
    value,
  );
  if (!warningMatch) return null;

  const attempt = Math.max(0, Number(warningMatch[1]) || 0);
  const maxAttempts = Math.max(0, Number(warningMatch[2]) || 0);
  const remainingAttempts = Math.max(0, maxAttempts - attempt);
  const reasonText = truncateUiText(warningMatch[3], 90);
  const retryBoundary = remainingAttempts
    ? `距离 fatal fallback 还剩 ${remainingAttempts} 次失败`
    : '已达到 fatal fallback 门槛';
  const fallbackBoundary = remainingAttempts
    ? '继续失败才会按当前模式切到下一层'
    : '下一层会按当前模式接管';
  const receiptLine =
    `chunk stream 重试 ${attempt}/${maxAttempts}；${retryBoundary}。` +
    `live partial preview 可能暂停，已收到的 final / 历史 transcript 会保留；` +
    `当前音频仍只发给本机 Desktop App，${fallbackBoundary}。原因：${reasonText}`;

  return {
    statusLabel: `本地 ASR 流暂不稳定（${attempt}/${maxAttempts}）`,
    currentLayerLabel: `本地 ASR · 流暂不稳定（${attempt}/${maxAttempts}）`,
    receiptLine,
    nextStep:
      `本地 chunk stream 正在重试；${retryBoundary}。` +
      `实时 partial preview 可能短暂停住，已收到的 final / 历史 transcript 会保留；` +
      `当前音频仍只发给本机 Desktop App，${fallbackBoundary}。原因：${reasonText}`,
    tone: 'warning',
  };
}

function getLocalASRProbeIssue(
  reason: string | undefined,
): LocalASRProbeIssue | null {
  const value = String(reason || '').trim();
  if (!value) return null;

  const downloadingMatch =
    /^asr_model_downloading(?:\s+(\d{1,3})%)?(?:\s+(.+))?$/i.exec(value);
  if (downloadingMatch) {
    const progress = downloadingMatch[1] ? `${downloadingMatch[1]}%` : '';
    const target = humanizeLocalASRReason(downloadingMatch[2]);
    return {
      summary:
        `本机 ASR 模型下载中${progress ? `（${progress}）` : ''}` +
        `${target ? ` · ${target}` : ''}；完成前 Local ASR 不会产出 final transcript。`,
      nextStep:
        '保持 Personal AI Desktop App 开启并等待模型下载完成；如果当前会议急用，请切换到 Auto / Cloud 模式，或到 Options → Desktop ASR 查看下载状态。',
      tone: 'warning',
    };
  }

  const modelFailedMatch = /^asr_model_install_failed\s+(.+)$/i.exec(value);
  if (modelFailedMatch) {
    return {
      summary: `本机 ASR 模型安装失败：${truncateUiText(
        humanizeLocalASRReason(modelFailedMatch[1]),
        90,
      )}。`,
      nextStep:
        '打开 Options → Desktop ASR 查看失败原因并重试模型安装；如果需要继续会议转写，请切换到 Auto / Cloud 模式。',
      tone: 'danger',
    };
  }

  const whisperInstallingMatch =
    /^whisper_binary_installing(?:\s+(\d{1,3})%)?/i.exec(value);
  if (whisperInstallingMatch) {
    const progress = whisperInstallingMatch[1]
      ? `（${whisperInstallingMatch[1]}%）`
      : '';
    return {
      summary: `Whisper fallback binary 正在安装${progress}；安装完成前 final-only 兜底还不可用。`,
      nextStep:
        '保持 Personal AI Desktop App 开启；安装完成后重新开始 Capture，或临时切到 Auto / Cloud 模式。',
      tone: 'warning',
    };
  }

  const whisperFailedMatch =
    /^whisper_binary_install_failed\s+(.+)$/i.exec(value);
  if (whisperFailedMatch) {
    return {
      summary: `Whisper fallback binary 安装失败：${truncateUiText(
        humanizeLocalASRReason(whisperFailedMatch[1]),
        90,
      )}。`,
      nextStep:
        '打开 Options → Desktop ASR 重新安装 Whisper fallback；在修复前不要把 Local ASR final-only 当成可用。',
      tone: 'danger',
    };
  }

  if (/^whisper_binary_missing$/i.test(value)) {
    return {
      summary:
        'Whisper fallback 模型已找到，但本地 binary 还不可用；final-only 兜底暂时不能产出转写。',
      nextStep:
        '保持 Desktop App 开启等待 Whisper binary 安装完成，或到 Options → Desktop ASR 手动检查安装状态。',
      tone: 'warning',
    };
  }

  const finalModelMatch = /^final_model_not_ready(?:\s+(.+))?$/i.exec(value);
  if (finalModelMatch) {
    const reasonDetail = humanizeLocalASRReason(finalModelMatch[1]);
    return {
      summary:
        '本地 final engine 未就绪；FunASR 或 Whisper fallback 至少一个 ready 后才会产出 final transcript。' +
        `${reasonDetail ? ` 原因：${truncateUiText(reasonDetail, 80)}。` : ''}`,
      nextStep:
        '打开 Options → Desktop ASR，等待 FunASR 或 Whisper fallback ready；没有 final engine 时不要把空 transcript 当成无人发言。',
      tone: 'warning',
    };
  }

  const liveReadyFinalModelMatch =
    /^live_ready_final_not_ready(?:\s+(.+))?$/i.exec(value);
  if (liveReadyFinalModelMatch) {
    const reasonDetail = humanizeLocalASRReason(liveReadyFinalModelMatch[1]);
    return {
      summary:
        '本地实时引擎已就绪，但 Local ASR session 仍需要 FunASR 或 Whisper fallback 作为 final transcript 兜底；当前本地层还不会启动。' +
        `${reasonDetail ? ` 原因：${truncateUiText(reasonDetail, 80)}。` : ''}`,
      nextStep:
        '保持 Desktop App 开启并等待 FunASR 或 Whisper fallback ready；local-only 不会调用云端，急用时可切到 Auto / Cloud。',
      tone: 'warning',
    };
  }

  if (/^desktop_app_not_running|desktop_asr_bridge_unavailable/i.test(value)) {
    return {
      summary: 'Personal AI Desktop App 未连接；Local ASR 没有本机音频接收端。',
      nextStep:
        '启动 Personal AI Desktop App 并保持 localhost/native bridge 可用；如果急用，请切换到 Auto / Cloud 模式。',
      tone: 'danger',
    };
  }

  if (/^platform_unsupported/i.test(value)) {
    return {
      summary: '当前平台不支持 Local ASR；local-only 模式会停在 No ASR。',
      nextStep:
        '在 macOS 上使用 Desktop Local ASR，或把当前会议转写模式切到 Auto / Cloud。',
      tone: 'warning',
    };
  }

  return null;
}

function localLiveEngineLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'apple') return 'Apple Speech 实时预览';
  if (normalized === 'sherpa') return 'sherpa 实时预览';
  if (normalized === 'no live') return '无实时预览';
  return value.trim() || '未知实时预览';
}

function localFinalEngineLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'funasr') return 'FunASR final';
  if (normalized === 'whisper') return 'Whisper final';
  if (normalized === 'no final') return '无 final engine';
  return value.trim() || '未知 final engine';
}

function getWebSpeechReceiptDetail(
  detail: string | undefined,
): WebSpeechReceiptDetail | null {
  const value = String(detail || '').trim();
  if (!/Chrome On-Device waiting for first transcript/i.test(value)) {
    return null;
  }
  const secondsMatch = /fallback watchdog\s+(\d+)s/i.exec(value);
  const timeoutLabel = secondsMatch ? `${secondsMatch[1]}s` : '短时间';
  return {
    statusLabel: 'Chrome On-Device · 等待首条转写',
    currentLayerLabel: `本机 Web Speech · 等待首条转写（${timeoutLabel} 无文本将 fallback）`,
    freshnessText:
      `Chrome Web Speech 已启动但还没有收到首条转写；${timeoutLabel} 内仍无文本会按当前模式切到下一层。` +
      '不要把空 transcript 当成会议无人发言，可能只是浏览器还没有消费扩展/offscreen 音频轨。',
    nextStep:
      `等待首条转写；${timeoutLabel} 内仍无文本会按当前模式 fallback。` +
      '如果反复发生，请检查会议音频、浏览器 SpeechRecognition 支持，或改用 Desktop App / Cloud ASR。',
  };
}

function getLocalASRReceiptDetail(
  reason: string | undefined,
): LocalASRReceiptDetail | null {
  const value = String(reason || '').trim();
  const chainMatch = /^Local ASR\s*·\s*([^→]+)\s*→\s*(.+)$/i.exec(value);
  if (chainMatch) {
    const liveLabel = localLiveEngineLabel(chainMatch[1]);
    const finalLabel = localFinalEngineLabel(chainMatch[2]);
    const finalOnly = /无实时预览/.test(liveLabel);
    return {
      statusLabel: `本地 ASR · ${liveLabel} → ${finalLabel}`,
      currentLayerLabel: `本地 ASR · ${liveLabel} → ${finalLabel}`,
      nextStep: finalOnly
        ? '当前只有 final transcript；实时预览可能延迟到静音或停止后出现，音频仍只发往本机 Desktop App。'
        : '本机实时预览和 final transcript 可用；异常时会记录原因并按模式 fallback。',
      tone: finalOnly ? 'warning' : 'success',
    };
  }

  const streamWarning = getLocalASRStreamWarningDetail(value);
  if (streamWarning) {
    return {
      statusLabel: streamWarning.statusLabel,
      currentLayerLabel: streamWarning.currentLayerLabel,
      nextStep: streamWarning.nextStep,
      tone: streamWarning.tone,
    };
  }

  return null;
}

function cloudEndpointShortLabel(endpointLabel: string): string {
  if (/chat\/completions|input_audio/i.test(endpointLabel)) {
    return 'Chat Completions + input_audio';
  }
  if (/audio\/transcriptions/i.test(endpointLabel)) {
    return 'Audio Transcriptions';
  }
  return endpointLabel;
}

function getCloudASRReceiptDetail(
  detail: string | undefined,
): CloudASRReceiptDetail | null {
  const value = String(detail || '').trim();
  const match =
    /^Cloud ASR\s*·\s*(.+?)\s*·\s*(OpenAI .+?)\s*·\s*model\s+(.+?)\s*·\s*language\s+(.+?)(?:\s*·\s*segment\s+(.+))?$/i.exec(
      value,
    ) ||
    /^Cloud ASR\s*·\s*(.+?)\s*·\s*model\s+(.+?)\s*·\s*language\s+(.+?)(?:\s*·\s*segment\s+(.+))?$/i.exec(
      value,
    );
  if (!match) return null;

  const hasStyleLabel = match.length >= 6 && /^OpenAI /i.test(match[2] || '');
  const endpointLabel = match[1].trim();
  const styleLabel = hasStyleLabel ? match[2].trim() : cloudEndpointShortLabel(endpointLabel);
  const modelLabel = (hasStyleLabel ? match[3] : match[2]).trim();
  const languageLabel = (hasStyleLabel ? match[4] : match[3]).trim();
  const segmentLabel = (hasStyleLabel ? match[5] : match[4])?.trim() || '5s';
  const shortEndpoint = cloudEndpointShortLabel(endpointLabel);
  const isChatAudio = /chat\/completions|input_audio/i.test(
    `${endpointLabel} ${styleLabel}`,
  );

  return {
    statusLabel: `Cloud ASR · ${shortEndpoint}`,
    currentLayerLabel: `云端 ASR · ${shortEndpoint}`,
    endpointLabel: `${endpointLabel} · ${styleLabel}`,
    modelLabel,
    languageLabel,
    uploadBoundary: isChatAudio
      ? `每段约 ${segmentLabel} 音频会转成 WAV 后以内联 input_audio 发送；单片超过 7.5MB 会拒绝。`
      : `每段约 ${segmentLabel} 音频会转成 WAV 后作为 multipart file 上传到 /v1/audio/transcriptions。`,
    nextStep: isChatAudio
      ? '失败时先检查 API Style 与模型是否匹配；DashScope Qwen-ASR 通常需要 chat + input_audio 路径。'
      : '失败时先检查模型是否支持 /v1/audio/transcriptions；不兼容时切换到 chat + input_audio。'
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

function formatRange(start: number, end: number): string {
  const left = formatTime(start);
  if (end - start < 60_000) return left;
  return `${left}-${formatTime(end)}`;
}

function timeSinceLabel(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s 前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m 前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h 前`;
}

function asrStatus(session: MeetingPilotSessionSnapshot): {
  configured: boolean;
  label: string;
  successCount: number;
  lastSuccessTs?: number;
  lastError?: string;
} {
  const asrChunks = session.transcript.filter((c) =>
    Boolean(c.source && c.source !== 'test'),
  );
  const successCount = asrChunks.length;
  const lastSuccess = [...session.transcript]
    .reverse()
    .find((c) => c.source && c.source !== 'test');
  const activeTier = session.tier?.activeTier || null;
  const tierBadge = session.tier?.badge;
  const activeLabel = activeTier ? ASR_SOURCE_LABEL[activeTier] : undefined;
  const badgeLabel = tierBadge ? ASR_BADGE_LABEL[tierBadge] : undefined;
  const lastSourceLabel =
    lastSuccess?.source && lastSuccess.source !== 'test'
      ? ASR_SOURCE_LABEL[lastSuccess.source]
      : undefined;
  const localASRDetail =
    activeLabel === 'Local ASR'
      ? getLocalASRReceiptDetail(
          session.tier?.lastStatusDetail || session.tier?.lastTransitionReason,
        )
      : null;
  const webSpeechDetail =
    activeLabel === 'Chrome On-Device'
      ? getWebSpeechReceiptDetail(
          session.tier?.lastStatusDetail || session.tier?.lastTransitionReason,
        )
      : null;
  const cloudASRDetail =
    activeLabel === 'Cloud'
      ? getCloudASRReceiptDetail(
          session.tier?.lastStatusDetail || session.tier?.lastTransitionReason,
        )
      : null;
  const dependencyReady =
    session.readiness?.dependencies?.transcription?.status === 'ready';
  const configured =
    successCount > 0 ||
    Boolean(activeTier) ||
    dependencyReady ||
    tierBadge === 'Cloud' ||
    tierBadge === 'RC Transcript' ||
    tierBadge === 'Local ASR' ||
    tierBadge === 'Local Whisper' ||
    tierBadge === 'On-Device' ||
    tierBadge === 'No ASR';
  const tierIsStillTrying = Boolean(activeTier) || tierBadge === 'Probing';
  const tierHasFailed = tierBadge === 'No ASR';
  const localASRIssue = tierHasFailed
    ? getLatestLocalASRProbeIssue(session)
    : null;
  const readinessError =
    successCount === 0 &&
    !tierIsStillTrying &&
    session.readiness?.dependencies?.transcription?.status !== 'ready'
      ? session.readiness?.dependencies?.transcription?.message
      : undefined;
  const lastError =
    session.capture?.lastError ||
    (tierHasFailed
      ? localASRIssue?.summary || session.tier?.lastTransitionReason
      : undefined) ||
    readinessError;
  return {
    configured,
    label:
      (activeLabel === 'Local ASR' && localASRDetail
        ? localASRDetail.statusLabel
        : activeLabel === 'Chrome On-Device' && webSpeechDetail
          ? webSpeechDetail.statusLabel
        : activeLabel === 'Cloud' && cloudASRDetail
          ? cloudASRDetail.statusLabel
        : activeLabel) ||
      lastSourceLabel ||
      badgeLabel ||
      (configured ? 'ASR Ready' : '未配置'),
    successCount,
    lastSuccessTs: lastSuccess?.ts,
    lastError,
  };
}

function getLatestASRTranscriptSource(
  session: MeetingPilotSessionSnapshot,
): Exclude<NonNullable<MeetingPilotTranscriptChunk['source']>, 'test'> | undefined {
  const lastSuccess = [...session.transcript]
    .reverse()
    .find((chunk) => chunk.source && chunk.source !== 'test');
  return lastSuccess?.source && lastSuccess.source !== 'test'
    ? lastSuccess.source
    : undefined;
}

function getASRUploadBoundary(
  session: MeetingPilotSessionSnapshot,
): { value: string; tone: ASRChainReceiptRow['tone'] } {
  const activeTier = session.tier?.activeTier || null;
  const badge = session.tier?.badge;
  const mode = session.tier?.mode || 'auto';
  const latestSource = getLatestASRTranscriptSource(session);
  const effectiveTier = activeTier || latestSource || null;
  const cloudASRDetail = getCloudASRReceiptDetail(
    session.tier?.lastStatusDetail || session.tier?.lastTransitionReason,
  );
  if (effectiveTier === 'ringcentral_transcript' || badge === 'RC Transcript') {
    return {
      value: '读取会议页已有转写，不额外上传音频。',
      tone: 'success',
    };
  }
  if (effectiveTier === 'web_speech' || badge === 'On-Device') {
    return {
      value: 'Chrome 本机识别；仍需保留降级原因以便恢复。',
      tone: 'success',
    };
  }
  if (
    effectiveTier === 'desktop_whisper' ||
    latestSource === 'whisper' ||
    badge === 'Local ASR' ||
    badge === 'Local Whisper'
  ) {
    return {
      value: '音频片段只发给本机 Desktop App；当前不上传云端。',
      tone: 'success',
    };
  }
  if (effectiveTier === 'cloud' || badge === 'Cloud' || mode === 'cloud-only') {
    return {
      value:
        cloudASRDetail?.uploadBoundary ||
        '音频片段会发送到配置的云端 ASR 服务。',
      tone: 'warning',
    };
  }
  if (badge === 'No ASR') {
    return {
      value: '当前没有可用转写层级，不会继续发送音频转写。',
      tone: 'danger',
    };
  }
  if (mode === 'local-only') {
    return {
      value: '仅允许本地/会议页转写；云端 fallback 被禁用。',
      tone: 'success',
    };
  }
  return {
    value: '仍在探测；只有切到云端层级时才会调用云端 ASR。',
    tone: 'info',
  };
}

function summarizeASRTransitionReason(reason: string): string {
  const trimmed = truncateUiText(reason, 120);
  if (/fallback/i.test(reason)) {
    return `已按当前模式切换下一层；原始原因：${trimmed}`;
  }
  if (/start failed|failed/i.test(reason)) {
    return `上一层启动失败；原始原因：${trimmed}`;
  }
  if (/unavailable|not ready/i.test(reason)) {
    return `上一层不可用；原始原因：${trimmed}`;
  }
  return trimmed;
}

function formatASRProbeTrailItem(
  item: NonNullable<
    NonNullable<MeetingPilotSessionSnapshot['tier']>['probeTrail']
  >[number],
): string {
  const tierLabel = ASR_RECEIPT_TIER_LABEL[item.tier];
  const localIssue =
    item.tier === 'desktop_whisper'
      ? getLocalASRProbeIssue(item.reason)
      : null;
  const reason = localIssue
    ? `：${localIssue.summary}`
    : item.reason
      ? `：${truncateUiText(item.reason, 54)}`
      : '';
  switch (item.state) {
    case 'unavailable':
      return `${tierLabel} 不可用${reason}`;
    case 'selected':
      return `${tierLabel} 已选中`;
    case 'running':
      return `${tierLabel} 已运行`;
    case 'start_failed':
      return `${tierLabel} 启动失败${reason}`;
    case 'fatal_error':
      return `${tierLabel} 致命错误${reason}`;
    case 'watchdog_timeout':
      return `${tierLabel} 首条转写超时${reason}`;
    default:
      return tierLabel;
  }
}

function getLatestLocalASRProbeIssue(
  session: MeetingPilotSessionSnapshot,
): LocalASRProbeIssue | null {
  const trail = session.tier?.probeTrail || [];
  for (const item of [...trail].reverse()) {
    if (
      item.tier !== 'desktop_whisper' ||
      !['unavailable', 'start_failed', 'fatal_error'].includes(item.state)
    ) {
      continue;
    }
    const issue = getLocalASRProbeIssue(item.reason);
    if (issue) return issue;
  }

  const reason = session.tier?.lastTransitionReason;
  if (
    reason &&
    /desktop_whisper|Local ASR|desktop_app|desktop_asr|asr_model|final_model|live_ready_final|whisper_binary/i.test(
      reason,
    )
  ) {
    return getLocalASRProbeIssue(reason);
  }
  return null;
}

function getASRProbeTrailRow(
  session: MeetingPilotSessionSnapshot,
): ASRChainReceiptRow | null {
  const trail = session.tier?.probeTrail?.filter(Boolean) || [];
  if (!trail.length) return null;
  const visibleTrail = trail.slice(-5);
  const hasCloudSelection = visibleTrail.some(
    (item) =>
      item.tier === 'cloud' &&
      (item.state === 'selected' || item.state === 'running'),
  );
  const hasFailure = visibleTrail.some((item) =>
    ['unavailable', 'start_failed', 'fatal_error', 'watchdog_timeout'].includes(
      item.state,
    ),
  );
  return {
    label: '探测路径',
    value: visibleTrail.map(formatASRProbeTrailItem).join(' → '),
    tone:
      session.tier?.badge === 'No ASR'
        ? 'danger'
        : hasCloudSelection || hasFailure
          ? 'warning'
          : 'info',
  };
}

function getLocalASRIssueRow(
  session: MeetingPilotSessionSnapshot,
): ASRChainReceiptRow | null {
  const activeTier = session.tier?.activeTier || null;
  const badge = session.tier?.badge;
  if (
    activeTier === 'desktop_whisper' ||
    badge === 'Local ASR' ||
    badge === 'Local Whisper'
  ) {
    return null;
  }
  const issue = getLatestLocalASRProbeIssue(session);
  if (!issue) return null;
  return {
    label: '本地准备',
    value: issue.summary,
    tone: issue.tone,
  };
}

function getLocalASRStreamWarningRow(
  session: MeetingPilotSessionSnapshot,
): ASRChainReceiptRow | null {
  const activeTier = session.tier?.activeTier || null;
  const badge = session.tier?.badge;
  if (
    activeTier !== 'desktop_whisper' &&
    badge !== 'Local ASR' &&
    badge !== 'Local Whisper'
  ) {
    return null;
  }
  const warning = getLocalASRStreamWarningDetail(
    session.tier?.lastStatusDetail || session.tier?.lastTransitionReason,
  );
  if (!warning) return null;
  return {
    label: '本地流状态',
    value: warning.receiptLine,
    tone: warning.tone,
  };
}

function getRingCentralTranscriptBoundaryRow(
  session: MeetingPilotSessionSnapshot,
): ASRChainReceiptRow | null {
  const activeTier = session.tier?.activeTier || null;
  const badge = session.tier?.badge;
  if (activeTier !== 'ringcentral_transcript' && badge !== 'RC Transcript') {
    return null;
  }
  return {
    label: '平台转写',
    value:
      '只读取当前会议页已经显示的 RingCentral caption/transcript；Local / Cloud ASR 已跳过。' +
      '已读文本会进入本场实时摘要、行动项、时间线和归档草稿，但不会请求 RingCentral 保存/下载完整 transcript、发送通知、开启录制或额外上传音频。',
    tone: 'info',
  };
}

function getASRNextStep(session: MeetingPilotSessionSnapshot): string {
  const badge = session.tier?.badge;
  const mode = session.tier?.mode || 'auto';
  const transitionReason = session.tier?.lastTransitionReason;
  const statusDetail = session.tier?.lastStatusDetail || transitionReason;
  const localASRIssue = getLatestLocalASRProbeIssue(session);
  const localASRDetail =
    badge === 'Local ASR' || badge === 'Local Whisper'
      ? getLocalASRReceiptDetail(statusDetail)
      : null;
  const webSpeechDetail =
    badge === 'On-Device'
      ? getWebSpeechReceiptDetail(statusDetail)
      : null;
  const cloudASRDetail =
    badge === 'Cloud' ? getCloudASRReceiptDetail(statusDetail) : null;
  if (localASRDetail) {
    return localASRDetail.nextStep;
  }
  if (webSpeechDetail) {
    return webSpeechDetail.nextStep;
  }
  if (cloudASRDetail) {
    const localFallbackPrefix =
      localASRIssue &&
      transitionReason &&
      /Local ASR|desktop_whisper|desktop_app|desktop_asr|asr_model|final_model|live_ready_final|whisper_binary/i.test(
        transitionReason,
      )
        ? `本地层未用：${localASRIssue.summary.replace(/[。；\s]+$/g, '')}；`
        : '';
    const prefix =
      localFallbackPrefix ||
      (transitionReason &&
      /fallback|failed|unavailable|not ready|不可用/i.test(transitionReason)
        ? `${summarizeASRTransitionReason(transitionReason)}；`
        : '');
    return `${prefix}${cloudASRDetail.nextStep}`;
  }
  if (badge === 'No ASR') {
    if (localASRIssue) {
      return localASRIssue.nextStep;
    }
    if (mode === 'local-only') {
      return '启动 Desktop App 或切换到自动/云端模式。';
    }
    if (mode === 'cloud-only') {
      return '检查 Meeting Provider Base URL、API Key 和转写模型。';
    }
    return '安装/启动 Desktop App，或配置云端 ASR API Key。';
  }
  if (transitionReason && /fallback|failed|unavailable|not ready|不可用/i.test(transitionReason)) {
    return summarizeASRTransitionReason(transitionReason);
  }
  if (badge === 'Probing') {
    return '等待首条转写；若长时间没有文本，会继续按模式尝试下一层。';
  }
  return '保持当前层级；异常时会记录原因并按模式 fallback。';
}

function getASRFreshnessRow(
  session: MeetingPilotSessionSnapshot,
  status: ReturnType<typeof asrStatus>,
  now: number,
): ASRChainReceiptRow | null {
  const tier = session.tier;
  const badge = tier?.badge;
  const activeTier = tier?.activeTier || null;
  const activeTierLabel =
    activeTier
      ? ASR_RECEIPT_TIER_LABEL[activeTier]
      : badge
        ? ASR_RECEIPT_BADGE_LABEL[badge]
        : '当前层';
  const tierIsActive =
    Boolean(activeTier) ||
    badge === 'RC Transcript' ||
    badge === 'On-Device' ||
    badge === 'Local ASR' ||
    badge === 'Local Whisper' ||
    badge === 'Cloud';

  if (!status.lastSuccessTs) {
    const webSpeechDetail =
      (activeTier === 'web_speech' || badge === 'On-Device') &&
      getWebSpeechReceiptDetail(
        tier?.lastStatusDetail || tier?.lastTransitionReason,
      );
    if (webSpeechDetail) {
      return {
        label: '新鲜度',
        value: webSpeechDetail.freshnessText,
        tone: 'warning',
      };
    }
    if (tierIsActive || badge === 'Probing') {
      return {
        label: '新鲜度',
        value:
          '还没有首条转写；首条到达前不要把空 transcript 当成会议无人发言。',
        tone: badge === 'No ASR' ? 'danger' : 'info',
      };
    }
    return null;
  }

  const ageMs = Math.max(0, now - status.lastSuccessTs);
  const ageLabel = timeSinceLabel(status.lastSuccessTs, now);
  if (tierIsActive && ageMs >= LIVE_TRANSCRIPT_STALE_MS) {
    return {
      label: '新鲜度',
      value:
        `${activeTierLabel} 仍标记为运行，但上次转写是 ${ageLabel}；` +
        '旧转写不代表当前仍在收到音频。请检查会议是否静音、语言设置、Desktop App 或云端网络。',
      tone: 'warning',
    };
  }

  return {
    label: '新鲜度',
    value: `最近 ${ageLabel} 收到转写；当前结果仍可作为 live context 使用。`,
    tone: 'success',
  };
}

function getASRRealtimeStateRow(
  session: MeetingPilotSessionSnapshot,
  status: ReturnType<typeof asrStatus>,
  now: number,
): ASRChainReceiptRow {
  const tier = session.tier;
  const badge = tier?.badge;
  const activeTier = tier?.activeTier || null;
  const statusDetail = tier?.lastStatusDetail || tier?.lastTransitionReason;
  const localASRDetail =
    activeTier === 'desktop_whisper' ||
    badge === 'Local ASR' ||
    badge === 'Local Whisper'
      ? getLocalASRReceiptDetail(statusDetail)
      : null;
  const webSpeechDetail =
    activeTier === 'web_speech' || badge === 'On-Device'
      ? getWebSpeechReceiptDetail(statusDetail)
      : null;
  const latestSource = getLatestASRTranscriptSource(session);

  if (badge === 'No ASR') {
    return {
      label: '实时状态',
      value: '当前没有可用 live preview 或 final transcript 层级；按恢复动作修复后再判断会议是否有发言。',
      tone: 'danger',
    };
  }

  if (webSpeechDetail && !status.successCount) {
    return {
      label: '实时状态',
      value:
        '正在等浏览器给出第一条 live transcript；空白不是会议无人发言，也不是已保存 transcript。',
      tone: 'warning',
    };
  }

  if (localASRDetail?.currentLayerLabel.includes('无实时预览')) {
    return {
      label: '实时状态',
      value:
        '当前没有 live partial preview；final transcript 可能在静音、句末或停止后出现，不代表本地 ASR 已坏。',
      tone: 'warning',
    };
  }

  if (/流暂不稳定/.test(localASRDetail?.currentLayerLabel || '')) {
    return {
      label: '实时状态',
      value:
        '本地 live partial preview 正在重试；已有 final / 历史 transcript 保留，连续失败后才会切层。',
      tone: 'warning',
    };
  }

  if (activeTier === 'desktop_whisper' || badge === 'Local ASR') {
    return {
      label: '实时状态',
      value: '本机 live preview 与 final transcript 链路可用；final 仍可能比 partial 稍晚出现。',
      tone: 'success',
    };
  }

  if (activeTier === 'ringcentral_transcript' || badge === 'RC Transcript') {
    return {
      label: '实时状态',
      value: '正在读取会议页已有 transcript；是否保存或下载仍由会议平台控制。',
      tone: 'success',
    };
  }

  if (activeTier === 'cloud' || badge === 'Cloud') {
    return {
      label: '实时状态',
      value:
        latestSource === 'cloud' && status.lastSuccessTs
          ? `云端分片最近 ${timeSinceLabel(status.lastSuccessTs, now)} 返回；超过新鲜度阈值会标记为旧转写。`
          : '云端分片转写已启动；等待第一段上传片段返回前不要把空白当成无人发言。',
      tone: latestSource === 'cloud' ? 'success' : 'warning',
    };
  }

  if (activeTier === 'web_speech' || badge === 'On-Device') {
    return {
      label: '实时状态',
      value:
        latestSource === 'web_speech' && status.lastSuccessTs
          ? `浏览器最近 ${timeSinceLabel(status.lastSuccessTs, now)} 给出 live transcript。`
          : '浏览器 Web Speech 已启动；等待首条转写或后续 fallback。',
      tone: latestSource === 'web_speech' ? 'success' : 'warning',
    };
  }

  return {
    label: '实时状态',
    value: '正在探测可用转写层级；未切到云端前不会上传 ASR 音频。',
    tone: 'info',
  };
}

function getASRStatusSummaryLine(
  session: MeetingPilotSessionSnapshot,
  status: ReturnType<typeof asrStatus>,
  now: number,
): string {
  if (status.successCount > 0) {
    return (
      `已转写 ${status.successCount} 条` +
      (status.lastSuccessTs ? ` · 最近 ${timeSinceLabel(status.lastSuccessTs, now)}` : '')
    );
  }

  const tier = session.tier;
  const statusDetail = tier?.lastStatusDetail || tier?.lastTransitionReason;
  const localASRDetail =
    tier?.activeTier === 'desktop_whisper' ||
    tier?.badge === 'Local ASR' ||
    tier?.badge === 'Local Whisper'
      ? getLocalASRReceiptDetail(statusDetail)
      : null;
  if (localASRDetail?.currentLayerLabel.includes('无实时预览')) {
    return '等待 final transcript · 当前无 live preview';
  }
  if (
    (tier?.activeTier === 'web_speech' || tier?.badge === 'On-Device') &&
    getWebSpeechReceiptDetail(statusDetail)
  ) {
    return '等待首条转写 · 空 transcript 不代表无人发言';
  }
  if (tier?.badge === 'No ASR') {
    return '没有可用转写层级';
  }
  return '等待首条转写';
}

function buildASRChainReceipt(
  session: MeetingPilotSessionSnapshot,
  status: ReturnType<typeof asrStatus>,
  now: number,
): ASRChainReceiptRow[] {
  const tier = session.tier;
  const mode = tier?.mode || 'auto';
  const activeTier = tier?.activeTier || null;
  const latestSource = getLatestASRTranscriptSource(session);
  const statusDetail = tier?.lastStatusDetail || tier?.lastTransitionReason;
  const localASRDetail =
    activeTier === 'desktop_whisper' ||
    tier?.badge === 'Local ASR' ||
    tier?.badge === 'Local Whisper'
      ? getLocalASRReceiptDetail(statusDetail)
      : null;
  const webSpeechDetail =
    activeTier === 'web_speech' || tier?.badge === 'On-Device'
      ? getWebSpeechReceiptDetail(statusDetail)
      : null;
  const cloudASRDetail =
    activeTier === 'cloud' || tier?.badge === 'Cloud'
      ? getCloudASRReceiptDetail(statusDetail)
      : null;
  const currentLayer = activeTier
    ? activeTier === 'desktop_whisper' && localASRDetail
      ? localASRDetail.currentLayerLabel
      : activeTier === 'web_speech' && webSpeechDetail
        ? webSpeechDetail.currentLayerLabel
      : activeTier === 'cloud' && cloudASRDetail
        ? cloudASRDetail.currentLayerLabel
      : ASR_RECEIPT_TIER_LABEL[activeTier]
    : latestSource && (!tier?.badge || tier.badge === 'Probing')
      ? `${ASR_RECEIPT_TIER_LABEL[latestSource]}（最近结果）`
    : tier?.badge
      ? ASR_RECEIPT_BADGE_LABEL[tier.badge]
      : status.configured
        ? status.label
        : '未配置';
  const uploadBoundary = getASRUploadBoundary(session);
  const freshnessRow = getASRFreshnessRow(session, status, now);
  const realtimeStateRow = getASRRealtimeStateRow(session, status, now);
  const probeTrailRow = getASRProbeTrailRow(session);
  const localASRIssueRow = getLocalASRIssueRow(session);
  const localASRStreamWarningRow = getLocalASRStreamWarningRow(session);
  const ringCentralTranscriptBoundaryRow =
    getRingCentralTranscriptBoundaryRow(session);

  const rows: ASRChainReceiptRow[] = [
    {
      label: '模式',
      value: `${ASR_MODE_LABEL[mode]}：${ASR_MODE_DETAIL[mode]}`,
      tone: mode === 'cloud-only' ? 'warning' : 'info',
    },
    {
      label: '当前层',
      value:
        tier?.lastTransitionAt && tier.badge !== 'Probing'
          ? `${currentLayer} · ${timeSinceLabel(tier.lastTransitionAt, now)}切换`
          : currentLayer,
      tone:
        tier?.badge === 'No ASR'
          ? 'danger'
          : localASRDetail?.tone
            ? localASRDetail.tone
          : activeTier || tier?.badge === 'RC Transcript'
            ? 'success'
            : 'info',
    },
    ...(localASRStreamWarningRow ? [localASRStreamWarningRow] : []),
    ...(probeTrailRow ? [probeTrailRow] : []),
    ...(localASRIssueRow ? [localASRIssueRow] : []),
    {
      label: '上传边界',
      value: uploadBoundary.value,
      tone: uploadBoundary.tone,
    },
    ...(ringCentralTranscriptBoundaryRow
      ? [ringCentralTranscriptBoundaryRow]
      : []),
    realtimeStateRow,
    {
      label: latestSource ? '最近结果' : '转写结果',
      value: latestSource
        ? `${ASR_RECEIPT_TIER_LABEL[latestSource]} · ${status.successCount} 条 · 最近 ${
            status.lastSuccessTs
              ? timeSinceLabel(status.lastSuccessTs, now)
              : '刚刚'
          }`
        : status.successCount > 0
          ? `已转写 ${status.successCount} 条`
          : '还没有收到首条转写。',
      tone: status.successCount > 0 ? 'success' : 'info',
    },
    ...(freshnessRow ? [freshnessRow] : []),
    {
      label: tier?.badge === 'No ASR' ? '恢复动作' : '切层说明',
      value: getASRNextStep(session),
      tone:
        tier?.badge === 'No ASR'
          ? 'danger'
          : localASRDetail?.tone || 'info',
    },
  ];

  if (cloudASRDetail) {
    rows.splice(3, 0, {
      label: '云端接口',
      value: `${cloudASRDetail.endpointLabel} · 模型 ${cloudASRDetail.modelLabel} · 语言 ${cloudASRDetail.languageLabel}`,
      tone: 'warning',
    });
  }

  if (status.lastError) {
    rows.push({
      label: '最近错误',
      value: truncateUiText(status.lastError, 140),
      tone: 'danger',
    });
  }

  return rows;
}

function getASRReceiptRowValue(
  rows: ASRChainReceiptRow[],
  label: string,
): string | undefined {
  return rows.find((row) => row.label === label)?.value;
}

function buildASRReceiptBoundaryLabel(
  rows: ASRChainReceiptRow[],
): string {
  const currentLayer = getASRReceiptRowValue(rows, '当前层');
  const uploadBoundary = getASRReceiptRowValue(rows, '上传边界');
  const latestResult =
    getASRReceiptRowValue(rows, '最近结果') ||
    getASRReceiptRowValue(rows, '转写结果');
  const freshness = getASRReceiptRowValue(rows, '新鲜度');
  const nextStep =
    getASRReceiptRowValue(rows, '恢复动作') ||
    getASRReceiptRowValue(rows, '切层说明');
  const summaryParts = [
    currentLayer ? `当前层：${truncateUiText(currentLayer, 90)}` : undefined,
    uploadBoundary
      ? `上传边界：${truncateUiText(uploadBoundary, 120)}`
      : undefined,
    latestResult ? `结果：${truncateUiText(latestResult, 90)}` : undefined,
    freshness ? `新鲜度：${truncateUiText(freshness, 120)}` : undefined,
    nextStep ? `下一步：${truncateUiText(nextStep, 120)}` : undefined,
  ].filter(Boolean);
  return (
    `ASR 链路回执：${summaryParts.join('；')}。` +
    '这只是当前会议 session 的转写状态快照；查看它不会开始/停止 Capture、不会切换 ASR 模式、不会额外上传音频、不会请求 RingCentral 保存/下载完整 transcript、不会发送会议纪要或创建外部任务。'
  );
}

function truncateUiText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function speechSuggestionSourceLabel(
  source: NonNullable<MeetingPilotSessionSnapshot['speechSuggestion']>['source'],
): string {
  switch (source) {
    case 'memory':
      return '基于记忆';
    case 'transcript_memory':
      return '基于最近讨论 + 记忆';
    case 'profile':
      return '基于身份记忆';
    case 'session_context':
      return '基于本场上下文';
    case 'transcript':
      return '基于最近讨论';
    default:
      return '建议';
  }
}

function emptySpeechSuggestionText(
  session: MeetingPilotSessionSnapshot,
): string {
  const recentText = session.transcript
    .slice(-4)
    .map((chunk) => chunk.text)
    .join(' ');
  return /[A-Za-z]{2,}/.test(recentText) && !/[\u3400-\u9fff]/.test(recentText)
    ? 'Nothing to add yet.'
    : '先听一下，暂时不用插话。';
}

function SpeechSuggestionPanel(props: {
  session: MeetingPilotSessionSnapshot;
  refresh: () => Promise<void>;
  now: number;
}) {
  const { session, refresh, now } = props;
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const suggestion = session.speechSuggestion;
  const isStale = Boolean(suggestion?.expiresAt && suggestion.expiresAt < now);
  const displayText = suggestion?.text || emptySpeechSuggestionText(session);
  const context = session.speechGuidanceContext;
  const sessionNotes = context?.sessionNotes || [];
  const evidenceCount = suggestion?.evidenceRefs?.length || 0;
  const metaParts = [
    suggestion ? speechSuggestionSourceLabel(suggestion.source) : '等待上下文',
    suggestion?.confidence !== undefined
      ? `置信度 ${Math.round(suggestion.confidence * 100)}%`
      : undefined,
    evidenceCount ? `${evidenceCount} 条依据` : undefined,
    isStale ? '可能已过时' : undefined,
  ].filter(Boolean);

  const clearStatus = () => {
    setMessage('');
    setError('');
  };

  const copySuggestion = async () => {
    clearStatus();
    try {
      await navigator.clipboard.writeText(displayText);
      setMessage('已复制');
    } catch {
      setError('复制失败');
    }
  };

  const forceRefresh = async () => {
    clearStatus();
    setRefreshing(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_REFRESH_SPEECH_SUGGESTION',
        tabId: session.tabId,
        meetingId: session.meetingId,
      })) as { success?: boolean; error?: string };
      if (!response?.success) {
        throw new Error(response?.error || '刷新失败');
      }
      setMessage('已刷新');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const saveContext = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    clearStatus();
    setSaving(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_UPSERT_SPEECH_CONTEXT',
        tabId: session.tabId,
        meetingId: session.meetingId,
        text,
      })) as { success?: boolean; message?: string; error?: string };
      if (!response?.success) {
        throw new Error(response?.message || response?.error || '保存失败');
      }
      setDraft('');
      setMessage(response.message || '已用于本次会议');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const clearNote = async (noteId: string) => {
    clearStatus();
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_CLEAR_SPEECH_CONTEXT_NOTE',
        tabId: session.tabId,
        meetingId: session.meetingId,
        noteId,
      })) as { success?: boolean; error?: string };
      if (!response?.success) {
        throw new Error(response?.error || '移除失败');
      }
      setMessage('已移除');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除失败');
    }
  };

  return (
    <div className={`speech-suggestion-card${isStale ? ' stale' : ''}`}>
      <div className="speech-suggestion-kicker">我现在可以说</div>
      <div className="speech-suggestion-main">
        <div className="speech-suggestion-text">{displayText}</div>
        <div className="speech-suggestion-actions">
          <button
            type="button"
            className="speech-suggestion-icon-btn"
            onClick={() => void copySuggestion()}
            title="复制话术"
          >
            复制
          </button>
          <button
            type="button"
            className="speech-suggestion-icon-btn"
            onClick={() => void forceRefresh()}
            disabled={refreshing}
            title="重新生成"
          >
            {refreshing ? '刷新中' : '刷新'}
          </button>
        </div>
      </div>
      <div className="speech-suggestion-meta">
        {metaParts.join(' · ')}
      </div>
      <div className="speech-context-row">
        <button
          type="button"
          className="speech-context-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起身份/上下文' : '补充身份/上下文'}
        </button>
        {sessionNotes.length ? (
          <span className="speech-meta">本场已补充 {sessionNotes.length} 条</span>
        ) : null}
        {message ? <span className="speech-context-message">{message}</span> : null}
        {error ? <span className="speech-context-error">{error}</span> : null}
      </div>
      {expanded ? (
        <div className="speech-context-editor">
          <textarea
            className="speech-context-input"
            rows={3}
            value={draft}
            placeholder="例如：我是 mobile 项目的 tech lead；或：本次会议需要提醒 mobile 项目的风险。"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="speech-context-editor-actions">
            <button
              type="button"
              className="speech-context-save"
              disabled={!draft.trim() || saving}
              onClick={() => void saveContext()}
            >
              {saving ? '判断中...' : '保存并刷新建议'}
            </button>
          </div>
          {sessionNotes.length ? (
            <div className="speech-context-note-list">
              {sessionNotes.map((note) => (
                <span key={note.id} className="speech-context-note">
                  <span>{truncateUiText(note.text, 58)}</span>
                  <button
                    type="button"
                    onClick={() => void clearNote(note.id)}
                    title="移除本场上下文"
                  >
                    移除
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AnimatedTranscriptText(props: { text: string; stableId?: string }) {
  const previousTextByIdRef = useRef(new Map<string, string>());
  const stableId = props.stableId || '__default__';
  const previousText = previousTextByIdRef.current.get(stableId) || '';
  const animatedFromIndex = props.text.startsWith(previousText)
    ? previousText.length
    : 0;

  useEffect(() => {
    previousTextByIdRef.current.set(stableId, props.text);
  }, [props.text, stableId]);

  const chars = useMemo(() => Array.from(props.text), [props.text]);
  return (
    <span className="speech-fade-text" aria-label={props.text}>
      {chars.map((char, index) => {
        const shouldAnimate = index >= animatedFromIndex;
        const delayMs = shouldAnimate
          ? Math.min((index - animatedFromIndex) * 18, 1200)
          : 0;
        return (
          <span
            aria-hidden="true"
            className={`speech-fade-char${shouldAnimate ? '' : ' visible'}`}
            key={`${stableId}-${index}-${char}`}
            style={
              shouldAnimate ? { animationDelay: `${delayMs}ms` } : undefined
            }
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        );
      })}
    </span>
  );
}

function TurnTranscriptText(props: {
  turn: MeetingPilotTranscriptTurn;
  chunkById: Map<string, MeetingPilotTranscriptChunk>;
}) {
  const chunks = props.turn.chunkIds
    .map((id) => props.chunkById.get(id))
    .filter((chunk): chunk is MeetingPilotTranscriptChunk => Boolean(chunk));

  if (!chunks.length) {
    return (
      <AnimatedTranscriptText
        stableId={props.turn.id}
        text={props.turn.text}
      />
    );
  }

  return (
    <>
      {chunks.map((chunk, index) => (
        <React.Fragment key={chunk.id}>
          {index > 0 ? <span className="speech-chunk-gap"> </span> : null}
          <span className="speech-chunk" data-source={chunk.source || 'unknown'}>
            <AnimatedTranscriptText stableId={chunk.id} text={chunk.text} />
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

function getTurnTranscriptSources(
  turn: MeetingPilotTranscriptTurn,
  chunkById: Map<string, MeetingPilotTranscriptChunk>,
): NonNullable<MeetingPilotTranscriptChunk['source']>[] {
  const sources = new Set<NonNullable<MeetingPilotTranscriptChunk['source']>>();
  turn.chunkIds.forEach((id) => {
    const source = chunkById.get(id)?.source;
    if (source) sources.add(source);
  });
  return Array.from(sources);
}

interface RenameInputProps {
  initial: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

function RenameInput(props: RenameInputProps) {
  const [value, setValue] = useState(props.initial);
  return (
    <span className="speech-rename-row">
      <input
        autoFocus
        className="speech-rename-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            props.onSubmit(value.trim());
          } else if (e.key === 'Escape') {
            props.onCancel();
          }
        }}
      />
      <button
        className="speech-rename-confirm"
        onClick={() => props.onSubmit(value.trim())}
      >
        确认
      </button>
      <button className="speech-rename-cancel" onClick={props.onCancel}>
        取消
      </button>
    </span>
  );
}

function ParticipantStancePanel(props: {
  participant: MeetingPilotParticipant;
}) {
  const { participant } = props;
  const stances = participant.stances || [];
  return (
    <div className="speech-stance-panel">
      <div className="speech-stance-header">
        <strong>{participant.name}</strong>
        <span className="speech-meta">
          发言占比 {Math.max(0, Math.min(100, participant.speakingPct || 0))}%
        </span>
        {participant.resolutionState ? (
          <span className="speech-meta">{participant.resolutionState}</span>
        ) : null}
      </div>
      {stances.length ? (
        <ul className="speech-stance-list">
          {stances.map((stance, idx) => (
            <li key={`${stance.topic}-${idx}`} className="speech-stance-item">
              <span className={`speech-stance-tag stance-${stance.stance}`}>
                {stance.stance}
              </span>
              <span className="speech-stance-topic">{stance.topic}</span>
              <span className="speech-stance-quote">「{stance.keyQuote}」</span>
              {stance.timeRange ? (
                <span className="speech-meta">{stance.timeRange}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">尚未识别到该参会人的明确立场。</div>
      )}
    </div>
  );
}

export function SpeechTab(props: SpeechTabProps) {
  const { session, refresh } = props;
  const [now, setNow] = useState(() => Date.now());
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const turns = useMemo(
    () => [...session.transcriptTurns].sort((a, b) => b.startTs - a.startTs),
    [session.transcriptTurns],
  );

  const participantById = useMemo(() => {
    const map = new Map<string, MeetingPilotParticipant>();
    session.participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [session.participants]);

  const chunkById = useMemo(() => {
    const map = new Map<string, MeetingPilotTranscriptChunk>();
    session.transcript.forEach((chunk) => map.set(chunk.id, chunk));
    return map;
  }, [session.transcript]);

  const status = asrStatus(session);
  const asrReceiptRows = buildASRChainReceipt(session, status, now);
  const asrReceiptBoundaryLabel =
    buildASRReceiptBoundaryLabel(asrReceiptRows);
  const statusSummaryLine = getASRStatusSummaryLine(session, status, now);

  const sendRename = async (participantId: string, newName: string) => {
    if (!newName) {
      setRenamingId(null);
      return;
    }
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_RENAME_PARTICIPANT',
      tabId: session.tabId,
      meetingId: session.meetingId,
      participantId,
      newName,
    });
    setRenamingId(null);
    await refresh();
  };

  const onSpeakerClick = async (participantId: string) => {
    setActiveParticipantId(
      activeParticipantId === participantId ? null : participantId,
    );
    try {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_FOCUS_PARTICIPANT',
        tabId: session.tabId,
        meetingId: session.meetingId,
        participantId,
      });
    } catch {
      // best effort
    }
  };

  const activeParticipant = activeParticipantId
    ? participantById.get(activeParticipantId)
    : undefined;

  return (
    <div className="speech-tab">
      <SpeechSuggestionPanel session={session} refresh={refresh} now={now} />

      <div className="speech-status-card">
        <div>
          <strong>ASR:</strong>{' '}
          {status.configured ? status.label : '未配置'}
        </div>
        <div>{statusSummaryLine}</div>
        {status.lastError ? (
          <div className="speech-error">最近错误: {status.lastError}</div>
        ) : null}
        <div
          className="speech-asr-receipt"
          role="group"
          title={asrReceiptBoundaryLabel}
          aria-label={asrReceiptBoundaryLabel}
        >
          <div className="speech-asr-receipt-title">ASR 链路回执</div>
          {asrReceiptRows.map((row) => (
            <div
              key={row.label}
              className="speech-asr-receipt-row"
              data-tone={row.tone || 'info'}
            >
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {turns.length ? (
        <div className="speech-turn-list">
          {turns.map((turn) => {
            const participant = participantById.get(turn.participantId);
            const displayName =
              participant?.name || turn.speakerNameSnapshot || '说话人';
            const isRenaming = renamingId === turn.participantId;
            const isActive = activeParticipantId === turn.participantId;
            const transcriptSources = getTurnTranscriptSources(
              turn,
              chunkById,
            );
            return (
              <div
                key={turn.id}
                className={`speech-turn-card${isActive ? ' active' : ''}`}
              >
                <div className="speech-turn-header">
                  {isRenaming ? (
                    <RenameInput
                      initial={displayName}
                      onCancel={() => setRenamingId(null)}
                      onSubmit={(value) =>
                        sendRename(turn.participantId, value)
                      }
                    />
                  ) : (
                    <button
                      className="speech-speaker-btn"
                      onClick={() => onSpeakerClick(turn.participantId)}
                      title="点击查看立场详情"
                    >
                      {displayName}
                    </button>
                  )}
                  <SourceBadges
                    sources={turn.resolutionSources}
                    transcriptSources={transcriptSources}
                  />
                  <span className="speech-meta">
                    {formatRange(turn.startTs, turn.endTs)}
                  </span>
                  {turn.lowConfidence ? (
                    <span className="speech-meta speech-lowconf" title="低置信度">
                      ●
                    </span>
                  ) : null}
                  {!isRenaming ? (
                    <button
                      className="speech-rename-btn"
                      onClick={() => setRenamingId(turn.participantId)}
                      title="重命名发言人"
                    >
                      重命名
                    </button>
                  ) : null}
                </div>
                <div className="speech-turn-body">
                  <TurnTranscriptText turn={turn} chunkById={chunkById} />
                </div>
                {isActive && participant ? (
                  <ParticipantStancePanel participant={participant} />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          当前还没有发言记录。开启录制后，按发言人聚合的 turn 会出现在这里。
        </div>
      )}

      {activeParticipant && !turns.some((t) => activeParticipantId === t.participantId) ? (
        <ParticipantStancePanel participant={activeParticipant} />
      ) : null}
    </div>
  );
}

function SourceBadges(props: {
  sources: MeetingPilotSpeakerSource[];
  transcriptSources: NonNullable<MeetingPilotTranscriptChunk['source']>[];
}) {
  const speakerSources = props.sources.filter((src) => src !== 'transcript');
  if (!props.transcriptSources?.length && !speakerSources.length) return null;
  return (
    <span className="speech-source-badges">
      {props.transcriptSources.map((src) => (
        <span key={src} className={`speech-source-badge src-${src}`}>
          {TRANSCRIPT_SOURCE_LABEL[src] || src}
        </span>
      ))}
      {speakerSources.map((src) => (
        <span key={src} className={`speech-source-badge src-${src}`}>
          {SOURCE_LABEL[src] || src}
        </span>
      ))}
    </span>
  );
}

export default SpeechTab;
