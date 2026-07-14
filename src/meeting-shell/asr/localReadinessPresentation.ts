export type MeetingTranscriptionMode = 'auto' | 'local-only' | 'cloud-only';
export type MeetingReadinessKind = 'ready' | 'degraded' | 'blocked';

export interface LocalASRStatusPayload {
  ok?: boolean;
  error?: string;
  ready?: boolean;
  liveReady?: boolean;
  finalReady?: boolean;
  engines?: {
    appleSpeech?: { ready?: boolean; reason?: string };
    sherpaStreaming?: { modelReady?: boolean; reason?: string };
    funasrFinal?: { modelReady?: boolean; reason?: string };
    whisperFallback?: {
      ready?: boolean;
      modelReady?: boolean;
      whisperBinaryAvailable?: boolean;
      whisperBinaryInstallInProgress?: boolean;
      whisperBinaryInstallProgress?: number;
      whisperBinaryInstallError?: string;
    };
  };
  downloadInProgress?: boolean;
  downloadProgress?: number;
  downloadTarget?: string;
  lastDownloadError?: string;
}

export interface LocalASRPreflightPresentation {
  connected: boolean;
  available: boolean;
  fullReady: boolean;
  liveReady: boolean;
  finalReady: boolean;
  summary: string;
  nextStep: string;
  issueToken?: string;
}

interface TranscriptionReadinessInput {
  mode: MeetingTranscriptionMode;
  local: LocalASRPreflightPresentation;
  cloudStatus: MeetingReadinessKind;
  cloudMessage: string;
}

export interface TranscriptionReadinessPresentation {
  status: MeetingReadinessKind;
  message: string;
}

function formatPercent(value: unknown): string {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return '';
  const bounded = Math.max(0, Math.min(100, Math.round(progress)));
  return `${bounded}%`;
}

function humanizeReasonToken(value: unknown): string {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\+/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactReasonToken(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, '_')
    .replace(/[^\w:./-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
}

function truncateUiText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function localASRIssueFromStatus(status: LocalASRStatusPayload): {
  summary: string;
  nextStep: string;
  token: string;
} {
  if (status.lastDownloadError) {
    const detail = truncateUiText(
      humanizeReasonToken(status.lastDownloadError),
      90,
    );
    return {
      summary: `本机 ASR 模型安装失败${detail ? `：${detail}` : ''}。`,
      nextStep: '打开 Options -> Desktop ASR 查看失败原因并重试模型安装。',
      token: `asr_model_install_failed ${compactReasonToken(
        status.lastDownloadError,
      )}`.trim(),
    };
  }

  if (status.downloadInProgress) {
    const progress = formatPercent(status.downloadProgress);
    const target = humanizeReasonToken(status.downloadTarget);
    return {
      summary:
        `本机 ASR 模型下载中${progress ? `（${progress}）` : ''}` +
        `${target ? ` · ${target}` : ''}；完成前 Local ASR 不会产出 final transcript。`,
      nextStep:
        '保持 Personal AI Desktop App 开启并等待模型下载完成，或到 Options -> Desktop ASR 查看下载状态。',
      token:
        `asr_model_downloading${progress ? ` ${progress}` : ''}${
          status.downloadTarget ? ` ${compactReasonToken(status.downloadTarget)}` : ''
        }`.trim(),
    };
  }

  const whisper = status.engines?.whisperFallback;
  if (whisper?.whisperBinaryInstallError) {
    const detail = truncateUiText(
      humanizeReasonToken(whisper.whisperBinaryInstallError),
      90,
    );
    return {
      summary: `Whisper fallback binary 安装失败${detail ? `：${detail}` : ''}。`,
      nextStep: '打开 Options -> Desktop ASR 重新安装 Whisper fallback。',
      token: `whisper_binary_install_failed ${compactReasonToken(
        whisper.whisperBinaryInstallError,
      )}`.trim(),
    };
  }

  if (whisper?.whisperBinaryInstallInProgress) {
    const progress = formatPercent(whisper.whisperBinaryInstallProgress);
    return {
      summary: `Whisper fallback binary 正在安装${progress ? `（${progress}）` : ''}；安装完成前 final-only 兜底不可用。`,
      nextStep:
        '保持 Personal AI Desktop App 开启；安装完成后重新开始 Capture，或临时切到 Auto / Cloud 模式。',
      token: `whisper_binary_installing${progress ? ` ${progress}` : ''}`.trim(),
    };
  }

  if (whisper?.modelReady && !whisper.whisperBinaryAvailable) {
    return {
      summary:
        'Whisper fallback 模型已找到，但本地 binary 还不可用；final-only 兜底暂时不能产出转写。',
      nextStep:
        '保持 Desktop App 开启等待 Whisper binary 安装完成，或到 Options -> Desktop ASR 手动检查安装状态。',
      token: 'whisper_binary_missing',
    };
  }

  const finalReasons = [
    status.engines?.funasrFinal?.reason,
    whisper?.modelReady === false ? 'whisper_model_not_ready' : undefined,
    whisper?.whisperBinaryAvailable === false
      ? 'whisper_binary_missing'
      : undefined,
  ]
    .map(compactReasonToken)
    .filter(Boolean);
  const reasonDetail = finalReasons.length
    ? ` 原因：${truncateUiText(humanizeReasonToken(finalReasons.join('+')), 90)}。`
    : '';

  if (status.liveReady) {
    return {
      summary:
        '本地实时引擎已就绪，但 Local ASR session 仍需要 FunASR 或 Whisper fallback 作为 final transcript 兜底；当前本地层还不会启动。' +
        reasonDetail,
      nextStep:
        '保持 Desktop App 开启并等待 FunASR 或 Whisper fallback ready；local-only 不会调用云端。',
      token: `live_ready_final_not_ready${
        finalReasons.length ? ` ${finalReasons.join('+')}` : ''
      }`.trim(),
    };
  }

  return {
    summary:
      '本地 final engine 未就绪；FunASR 或 Whisper fallback 至少一个 ready 后才会产出 final transcript。' +
      reasonDetail,
    nextStep:
      '打开 Options -> Desktop ASR，等待 FunASR 或 Whisper fallback ready；没有 final engine 时不要把空 transcript 当成无人发言。',
    token: `final_model_not_ready${
      finalReasons.length ? ` ${finalReasons.join('+')}` : ''
    }`.trim(),
  };
}

export function describeLocalASRPreflightStatus(
  status: LocalASRStatusPayload | null | undefined,
): LocalASRPreflightPresentation {
  if (!status) {
    return {
      connected: false,
      available: false,
      fullReady: false,
      liveReady: false,
      finalReady: false,
      summary: 'Personal AI Desktop App 未连接；Local ASR 没有本机音频接收端。',
      nextStep:
        '启动 Personal AI Desktop App 并保持 localhost/native bridge 可用；如果急用，请切换到 Auto / Cloud 模式。',
      issueToken: 'desktop_app_not_running',
    };
  }

  if (status.ok === false) {
    const detail = truncateUiText(humanizeReasonToken(status.error), 90);
    return {
      connected: true,
      available: false,
      fullReady: false,
      liveReady: false,
      finalReady: false,
      summary: `Desktop App ASR 状态不可用${detail ? `：${detail}` : ''}。`,
      nextStep:
        '打开 Options -> Desktop ASR 查看状态，或重启 Personal AI Desktop App。',
      issueToken: status.error
        ? compactReasonToken(status.error)
        : 'desktop_app_unavailable',
    };
  }

  const liveReady = Boolean(status.liveReady);
  const finalReady = Boolean(status.finalReady);
  const fullReady = Boolean(status.ready ?? (liveReady && finalReady));
  if (finalReady) {
    return {
      connected: true,
      available: true,
      fullReady,
      liveReady,
      finalReady,
      summary: liveReady
        ? 'Local ASR 可用：live preview 与 final transcript 均已就绪。'
        : 'Local ASR final transcript 可用；live partial preview 尚未就绪，文本可能延迟到静音或停止后出现。',
      nextStep: liveReady
        ? '可以开启 Capture；本机链路异常时才会按当前模式继续 fallback。'
        : '可以开启 Capture，但不要把短时间空白误认为无人发言；需要实时预览时到 Options -> Desktop ASR 检查 live engine。',
    };
  }

  const issue = localASRIssueFromStatus(status);
  return {
    connected: true,
    available: false,
    fullReady,
    liveReady,
    finalReady,
    summary: issue.summary,
    nextStep: issue.nextStep,
    issueToken: issue.token,
  };
}

export function buildMeetingTranscriptionReadiness(
  input: TranscriptionReadinessInput,
): TranscriptionReadinessPresentation {
  if (input.mode === 'cloud-only') {
    return {
      status: input.cloudStatus,
      message: input.cloudMessage,
    };
  }

  if (input.mode === 'local-only') {
    if (input.local.available) {
      return {
        status: 'ready',
        message: `${input.local.summary} local-only 不会调用云端 ASR。`,
      };
    }
    return {
      status: 'degraded',
      message: `${input.local.summary} ${input.local.nextStep} local-only 不会调用云端 ASR。`,
    };
  }

  if (input.local.available) {
    return {
      status: 'ready',
      message: `${input.local.summary} Auto 会优先使用本机/会议页转写；只有运行时切到 Cloud 层才上传音频。`,
    };
  }

  if (input.cloudStatus === 'ready') {
    return {
      status: 'degraded',
      message: `${input.local.summary} Auto 仍可用 Cloud ASR fallback；只有实际切到 Cloud 层时才上传音频。${input.local.nextStep}`,
    };
  }

  return {
    status: 'degraded',
    message: `No transcription available. ${input.local.summary} ${input.local.nextStep} Cloud ASR 也未就绪：${input.cloudMessage}`,
  };
}
