import type {
  OfflineRecognizer,
  OfflineStream,
  OnlineRecognizer,
  OnlineStream,
} from 'sherpa-onnx-node';

import {
  getFunAsrNanoModelPaths,
  getSherpaStreamingModelPaths,
} from './modelManager.js';
import { sanitizeWhisperTranscriptText } from '../whisper/transcriptFilter.js';

export type LiveEngineName = 'apple_speech' | 'sherpa_streaming' | 'none';
export type FinalEngineName = 'funasr_nano' | 'whisper_cpp' | 'none';

type SherpaModule = typeof import('sherpa-onnx-node');

let sherpaModulePromise: Promise<SherpaModule> | undefined;
let streamingRecognizer: OnlineRecognizer | undefined;
let funAsrRecognizerPromise: Promise<OfflineRecognizer> | undefined;
let funAsrLoadedAt: number | undefined;
let funAsrLastError: string | undefined;

export interface SherpaEngineState {
  sherpaModuleLoaded: boolean;
  streamingLoaded: boolean;
  funAsrLoaded: boolean;
  funAsrLoadedAt?: number;
  funAsrLastError?: string;
}

export class SherpaStreamingSession {
  private recognizer: OnlineRecognizer;
  private stream: OnlineStream;
  private lastPartial = '';

  constructor(recognizer: OnlineRecognizer) {
    this.recognizer = recognizer;
    this.stream = recognizer.createStream();
  }

  acceptPcm16(pcm16: Buffer): {
    partial?: string;
    endpoint: boolean;
  } {
    if (!pcm16.length) return { endpoint: false };
    this.stream.acceptWaveform({
      sampleRate: 16000,
      samples: pcm16ToFloat32(pcm16),
    });
    let decodeCount = 0;
    while (this.recognizer.isReady(this.stream) && decodeCount < 20) {
      this.recognizer.decode(this.stream);
      decodeCount += 1;
    }

    const raw = String(this.recognizer.getResult(this.stream)?.text || '');
    const text = sanitizeWhisperTranscriptText(raw);
    const partial = text && text !== this.lastPartial ? text : undefined;
    if (partial) this.lastPartial = partial;
    return {
      partial,
      endpoint: this.recognizer.isEndpoint(this.stream),
    };
  }

  reset(): void {
    this.recognizer.reset(this.stream);
    this.lastPartial = '';
  }
}

export async function createSherpaStreamingSession(): Promise<SherpaStreamingSession> {
  const recognizer = await getStreamingRecognizer();
  return new SherpaStreamingSession(recognizer);
}

export async function transcribeWithFunAsrNano(
  pcm16: Buffer,
  opts?: { language?: string; maxNewTokens?: number },
): Promise<{ text: string; engine: 'funasr_nano' }> {
  const recognizer = await getFunAsrRecognizer(opts?.maxNewTokens);
  const stream = recognizer.createStream();
  const language = normalizeFunAsrLanguage(opts?.language);
  if (language) {
    try {
      stream.setOption('language', language);
    } catch {
      // Older sherpa builds ignore stream options for FunASR Nano.
    }
  }
  stream.acceptWaveform({
    sampleRate: 16000,
    samples: pcm16ToFloat32(pcm16),
  });
  const result = await recognizer.decodeAsync(stream);
  return {
    text: sanitizeWhisperTranscriptText(result?.text),
    engine: 'funasr_nano',
  };
}

export function getSherpaEngineState(): SherpaEngineState {
  return {
    sherpaModuleLoaded: Boolean(sherpaModulePromise),
    streamingLoaded: Boolean(streamingRecognizer),
    funAsrLoaded: Boolean(funAsrLoadedAt),
    funAsrLoadedAt,
    funAsrLastError,
  };
}

function normalizeFunAsrLanguage(language: string | undefined): string | undefined {
  const normalized = String(language || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return undefined;
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('en')) return 'en';
  return undefined;
}

async function getSherpaModule(): Promise<SherpaModule> {
  if (!sherpaModulePromise) {
    sherpaModulePromise = import('sherpa-onnx-node').then((module) => {
      const candidate =
        (module as SherpaModule & { default?: SherpaModule }).default
          ?.OfflineRecognizer
          ? (module as SherpaModule & { default?: SherpaModule }).default
          : module;
      if (!candidate?.OnlineRecognizer || !candidate?.OfflineRecognizer) {
        throw new Error('sherpa-onnx-node did not expose recognizer classes');
      }
      return candidate;
    });
  }
  return sherpaModulePromise;
}

async function getStreamingRecognizer(): Promise<OnlineRecognizer> {
  if (streamingRecognizer) return streamingRecognizer;
  const sherpa = await getSherpaModule();
  const paths = getSherpaStreamingModelPaths();
  streamingRecognizer = new sherpa.OnlineRecognizer({
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      paraformer: {
        encoder: paths.encoder,
        decoder: paths.decoder,
      },
      tokens: paths.tokens,
      numThreads: 2,
      provider: 'cpu',
      debug: 0,
    },
    decodingMethod: 'greedy_search',
    enableEndpoint: true,
    rule1MinTrailingSilence: 1.0,
    rule2MinTrailingSilence: 0.8,
    rule3MinUtteranceLength: 20,
  });
  return streamingRecognizer;
}

async function getFunAsrRecognizer(
  maxNewTokens = 96,
): Promise<OfflineRecognizer> {
  if (!funAsrRecognizerPromise) {
    funAsrRecognizerPromise = createFunAsrRecognizer(maxNewTokens).catch(
      (error) => {
        funAsrLastError = String((error as Error)?.message || error);
        funAsrRecognizerPromise = undefined;
        funAsrLoadedAt = undefined;
        throw error;
      },
    );
  }
  return funAsrRecognizerPromise;
}

async function createFunAsrRecognizer(
  maxNewTokens: number,
): Promise<OfflineRecognizer> {
  const sherpa = await getSherpaModule();
  const paths = getFunAsrNanoModelPaths();
  const recognizer = await sherpa.OfflineRecognizer.createAsync({
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      funasrNano: {
        encoderAdaptor: paths.encoderAdaptor,
        llm: paths.llm,
        embedding: paths.embedding,
        tokenizer: paths.tokenizer,
        maxNewTokens,
      },
      tokens: '',
      numThreads: 4,
      provider: 'cpu',
      debug: 0,
    },
  });
  funAsrLoadedAt = Date.now();
  funAsrLastError = undefined;
  return recognizer;
}

function pcm16ToFloat32(pcm16: Buffer): Float32Array {
  const sampleCount = Math.floor(pcm16.length / 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = pcm16.readInt16LE(index * 2) / 32768;
  }
  return samples;
}
