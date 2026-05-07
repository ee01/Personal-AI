export type MeetingPilotASRTier =
  | 'ringcentral_transcript'
  | 'web_speech'
  | 'desktop_whisper'
  | 'cloud';

export interface ASRTranscriptEvent {
  kind: 'interim' | 'final';
  text: string;
  tier: MeetingPilotASRTier;
  ts: number;
  utteranceId?: string;
}

export interface ASRErrorEvent {
  tier: MeetingPilotASRTier;
  code: 'network' | 'audio' | 'unavailable' | 'aborted' | 'unknown';
  message: string;
  ts: number;
  fatal: boolean;
}

export interface ASRStatusEvent {
  tier: MeetingPilotASRTier;
  state: 'starting' | 'running' | 'stopped';
  ts: number;
  detail?: string;
}

export type ASREventMap = {
  transcript: ASRTranscriptEvent;
  error: ASRErrorEvent;
  status: ASRStatusEvent;
};

export interface ASRProvider {
  readonly tier: MeetingPilotASRTier;
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  start(audio: MediaStreamTrack | MediaStream): Promise<void>;
  stop(): Promise<void>;
  on<K extends keyof ASREventMap>(
    event: K,
    handler: (e: ASREventMap[K]) => void,
  ): () => void;
}

type Listener<T> = (e: T) => void;

type AnyASREvent = ASREventMap[keyof ASREventMap];

export function createASREventEmitter(): {
  emit<K extends keyof ASREventMap>(event: K, data: ASREventMap[K]): void;
  on<K extends keyof ASREventMap>(
    event: K,
    handler: Listener<ASREventMap[K]>,
  ): () => void;
} {
  const listeners = new Map<keyof ASREventMap, Set<Listener<AnyASREvent>>>();

  return {
    emit<K extends keyof ASREventMap>(event: K, data: ASREventMap[K]) {
      const set = listeners.get(event);
      if (set) {
        set.forEach((fn) => fn(data));
      }
    },
    on<K extends keyof ASREventMap>(
      event: K,
      handler: Listener<ASREventMap[K]>,
    ) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set<Listener<AnyASREvent>>();
        listeners.set(event, set);
      }
      const wrappedHandler = handler as unknown as Listener<AnyASREvent>;
      set.add(wrappedHandler);
      return () => {
        set?.delete(wrappedHandler);
      };
    },
  };
}
