declare module 'sherpa-onnx-node' {
  export interface Waveform {
    sampleRate: number;
    samples: Float32Array;
  }

  export interface OnlineRecognizerResult {
    text?: string;
    tokens?: string[];
    is_final?: boolean;
    is_eof?: boolean;
  }

  export interface OfflineRecognizerResult {
    text?: string;
    tokens?: string[];
    lang?: string;
  }

  export class OnlineStream {
    acceptWaveform(obj: Waveform): void;
    inputFinished(): void;
  }

  export class OnlineRecognizer {
    constructor(config: Record<string, unknown>);
    createStream(): OnlineStream;
    isReady(stream: OnlineStream): boolean;
    decode(stream: OnlineStream): void;
    isEndpoint(stream: OnlineStream): boolean;
    reset(stream: OnlineStream): void;
    getResult(stream: OnlineStream): OnlineRecognizerResult;
  }

  export class OfflineStream {
    acceptWaveform(obj: Waveform): void;
    setOption(key: string, value: string): void;
  }

  export class OfflineRecognizer {
    constructor(config: Record<string, unknown>);
    static createAsync(
      config: Record<string, unknown>,
    ): Promise<OfflineRecognizer>;
    createStream(): OfflineStream;
    decode(stream: OfflineStream): void;
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>;
    getResult(stream: OfflineStream): OfflineRecognizerResult;
  }

  export function readWave(path: string): Waveform;
}
