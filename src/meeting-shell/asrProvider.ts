import {
  getMeetingTranscribeLanguageCode,
  normalizeMeetingTranscribeLanguage,
  type EnvConfigType,
  type MeetingTranscribeLanguage,
} from '../utils';

export type MeetingTranscribeApiStyle =
  | 'openai_audio_transcriptions'
  | 'openai_chat_completions';

export interface MeetingTranscriptionResult {
  ok: boolean;
  status?: number;
  text?: string;
  endpointLabel: string;
  errorMessage?: string;
}

export function normalizeMeetingTranscribeApiStyle(
  value: string | undefined | null,
): MeetingTranscribeApiStyle {
  return value === 'openai_chat_completions'
    ? 'openai_chat_completions'
    : 'openai_audio_transcriptions';
}

export function getMeetingTranscribeApiStyleLabel(
  value: string | undefined | null,
): string {
  const style = normalizeMeetingTranscribeApiStyle(value);
  return style === 'openai_chat_completions'
    ? 'OpenAI Chat Completions + input_audio'
    : 'OpenAI Audio Transcriptions';
}

export function doesProviderExposeTranscribeModel(
  requestedModel: string,
  availableModels: Set<string> | null,
): boolean {
  const requested = String(requestedModel || '').trim();
  if (!requested || !availableModels || availableModels.size === 0) {
    return true;
  }
  if (availableModels.has(requested)) {
    return true;
  }

  const normalizedRequested = requested.toLowerCase();
  for (const modelId of availableModels) {
    const normalizedModelId = String(modelId || '')
      .trim()
      .toLowerCase();
    if (!normalizedModelId) {
      continue;
    }
    if (
      normalizedModelId === normalizedRequested ||
      normalizedModelId.startsWith(`${normalizedRequested}-`)
    ) {
      return true;
    }
  }
  return false;
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function trimTrailingSlash(url: string): string {
  return String(url || '').replace(/\/+$/, '');
}

function joinVersionedPath(baseUrl: string, path: string): string {
  const trimmedBase = trimTrailingSlash(baseUrl);
  if (!trimmedBase) {
    return path;
  }

  if (path.startsWith('/v1/') && trimmedBase.endsWith('/v1')) {
    return `${trimmedBase}${path.slice('/v1'.length)}`;
  }
  if (path.startsWith('/api/v1/') && trimmedBase.endsWith('/api/v1')) {
    return `${trimmedBase}${path.slice('/api/v1'.length)}`;
  }
  return `${trimmedBase}${path}`;
}

async function readJsonSafely(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function extractErrorMessage(payload: any, fallback: string): string {
  return String(
    payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      payload?.rawText ||
      fallback,
  );
}

function extractChatCompletionText(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item?.text === 'string') {
          return item.text;
        }
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function getLanguageInstruction(language: MeetingTranscribeLanguage): string {
  if (language === 'zh-CN') {
    return 'Transcribe the audio verbatim in Chinese. Do not translate it to English.';
  }
  if (language === 'en-US') {
    return 'Transcribe the audio verbatim in English. Do not translate it.';
  }
  return 'Transcribe the audio verbatim, preserving each utterance in its original spoken language. Chinese and English may be mixed. Do not translate.';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('invalid_data_url'));
    };
    reader.readAsDataURL(blob);
  });
}

export function getMeetingTranscribeCompatibilityIssue(
  envConfig: Pick<
    EnvConfigType,
    | 'MEETING_PROVIDER_BASE_URL'
    | 'MEETING_TRANSCRIBE_MODEL'
    | 'MEETING_TRANSCRIBE_API_STYLE'
  >,
): string | null {
  const style = normalizeMeetingTranscribeApiStyle(
    envConfig.MEETING_TRANSCRIBE_API_STYLE,
  );
  const model = String(envConfig.MEETING_TRANSCRIBE_MODEL || '').trim();
  const baseUrl = String(envConfig.MEETING_PROVIDER_BASE_URL || '').trim();
  const normalizedModel = model.toLowerCase();
  const normalizedBaseUrl = baseUrl.toLowerCase();

  if (/^fun-asr/.test(normalizedModel)) {
    return (
      'DashScope Fun-ASR / FunAudio-ASR 不走 OpenAI 风格转写接口。' +
      '录音文件模式需要调用 DashScope 原生 `/api/v1/services/audio/asr/transcription` ' +
      '并提供公网文件 URL（官方也要求前端通过后端中转）；实时模式则需使用 WebSocket ' +
      '`wss://dashscope.aliyuncs.com/api-ws/v1/inference`。'
    );
  }

  if (
    style === 'openai_audio_transcriptions' &&
    /^qwen\d+(\.\d+)?-asr/.test(normalizedModel)
  ) {
    return (
      `${model} 不应通过 /v1/audio/transcriptions 调用。` +
      'DashScope 的 Qwen-ASR OpenAI 兼容方式使用 `chat/completions + input_audio`。'
    );
  }

  if (style === 'openai_chat_completions' && /whisper/.test(normalizedModel)) {
    return `${model} 更适合通过 /v1/audio/transcriptions 调用，而不是 chat/completions。`;
  }

  if (
    style === 'openai_audio_transcriptions' &&
    normalizedBaseUrl.includes('dashscope.aliyuncs.com/compatible-mode')
  ) {
    return (
      'DashScope `compatible-mode` 下的 ASR 若使用 Qwen-ASR，应选择 ' +
      '`OpenAI Chat Completions + input_audio`；`/v1/audio/transcriptions` 并不是通用 DashScope ASR 入口。'
    );
  }

  return null;
}

export async function probeMeetingTranscribeProvider(
  envConfig: Pick<
    EnvConfigType,
    | 'MEETING_PROVIDER_BASE_URL'
    | 'MEETING_PROVIDER_API_KEY'
    | 'MEETING_TRANSCRIBE_MODEL'
    | 'MEETING_TRANSCRIBE_API_STYLE'
  >,
): Promise<{
  reachable: boolean;
  models: Set<string> | null;
  compatibilityIssue: string | null;
}> {
  const baseUrl = String(envConfig.MEETING_PROVIDER_BASE_URL || '').trim();
  const apiKey = String(envConfig.MEETING_PROVIDER_API_KEY || '').trim();
  const compatibilityIssue = getMeetingTranscribeCompatibilityIssue(envConfig);
  if (!baseUrl || !apiKey) {
    return { reachable: false, models: null, compatibilityIssue };
  }
  if (compatibilityIssue) {
    return { reachable: true, models: null, compatibilityIssue };
  }

  try {
    const response = await fetch(joinVersionedPath(baseUrl, '/v1/models'), {
      method: 'GET',
      signal: withTimeoutSignal(6000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const reachable = response.ok || response.status < 500;
    if (!response.ok) {
      return { reachable, models: null, compatibilityIssue };
    }
    const payload = await readJsonSafely(response);
    const models = Array.isArray(payload?.data)
      ? new Set(
          payload.data
            .map((item: { id?: string }) => String(item?.id || '').trim())
            .filter(Boolean),
        )
      : null;
    return { reachable, models, compatibilityIssue };
  } catch {
    return { reachable: false, models: null, compatibilityIssue };
  }
}

export async function requestMeetingTranscription(args: {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiStyle: MeetingTranscribeApiStyle;
  audioBlob: Blob;
  language?: MeetingTranscribeLanguage | string;
  timeoutMs?: number;
}): Promise<MeetingTranscriptionResult> {
  const language = normalizeMeetingTranscribeLanguage(args.language);
  const languageCode = getMeetingTranscribeLanguageCode(language);
  if (args.apiStyle === 'openai_chat_completions') {
    const maxRawAudioBytes = 7.5 * 1024 * 1024;
    if (args.audioBlob.size > maxRawAudioBytes) {
      return {
        ok: false,
        endpointLabel: 'POST /v1/chat/completions',
        errorMessage:
          '音频过大，无法作为 Data URL 发送到 chat/completions。请缩短单次转写窗口，或改用支持文件转写的 ASR 接口。',
      };
    }

    const endpoint = joinVersionedPath(args.baseUrl, '/v1/chat/completions');
    const dataUrl = await blobToDataUrl(args.audioBlob);
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: withTimeoutSignal(args.timeoutMs ?? 30000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          {
            role: 'system',
            content: getLanguageInstruction(language),
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: dataUrl,
                },
              },
            ],
          },
        ],
        stream: false,
        asr_options: {
          enable_itn: false,
          ...(languageCode ? { language: languageCode } : {}),
        },
      }),
    });
    const payload = await readJsonSafely(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        endpointLabel: 'POST /v1/chat/completions',
        errorMessage: extractErrorMessage(payload, String(response.status)),
      };
    }
    return {
      ok: true,
      status: response.status,
      endpointLabel: 'POST /v1/chat/completions',
      text: extractChatCompletionText(payload),
    };
  }

  const endpoint = joinVersionedPath(args.baseUrl, '/v1/audio/transcriptions');
  const formData = new FormData();
  formData.append(
    'file',
    args.audioBlob,
    `meeting-cumulative-${Date.now()}.wav`,
  );
  formData.append('model', args.model);
  if (languageCode) {
    formData.append('language', languageCode);
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: withTimeoutSignal(args.timeoutMs ?? 30000),
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: formData,
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      endpointLabel: 'POST /v1/audio/transcriptions',
      errorMessage: extractErrorMessage(payload, String(response.status)),
    };
  }
  return {
    ok: true,
    status: response.status,
    endpointLabel: 'POST /v1/audio/transcriptions',
    text: String(payload?.text || '').trim(),
  };
}
