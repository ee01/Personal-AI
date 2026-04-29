type PcmChunkHandler = (
  buffer: ArrayBuffer,
  timing: { startedAt: number; endedAt: number },
) => void;

export interface PcmStreamer {
  start(): Promise<void>;
  stop(): void;
  onChunk(handler: PcmChunkHandler): () => void;
}

export function createPcmStreamer(track: MediaStreamTrack): PcmStreamer {
  let audioCtx: AudioContext | undefined;
  let workletNode: AudioWorkletNode | undefined;
  let sourceNode: MediaStreamAudioSourceNode | undefined;
  let clonedTrack: MediaStreamTrack | undefined;
  const handlers = new Set<PcmChunkHandler>();

  return {
    async start() {
      if (audioCtx || workletNode || sourceNode || clonedTrack) {
        this.stop();
      }
      audioCtx = new AudioContext();
      await audioCtx.audioWorklet.addModule(
        chrome.runtime.getURL('pcm-worklet.js'),
      );
      clonedTrack = track.clone();
      const stream = new MediaStream([clonedTrack]);
      sourceNode = audioCtx.createMediaStreamSource(stream);
      workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
      workletNode.port.onmessage = (event) => {
        if (event.data?.type === 'pcm' && event.data.buffer) {
          const endedAt = Date.now();
          const sampleCount =
            typeof event.data.sampleCount === 'number'
              ? event.data.sampleCount
              : event.data.buffer.byteLength / 2;
          const durationMs = Math.round((sampleCount / 16000) * 1000);
          handlers.forEach((h) =>
            h(event.data.buffer, {
              startedAt: endedAt - durationMs,
              endedAt,
            }),
          );
        }
      };
      sourceNode.connect(workletNode);
    },

    stop() {
      if (workletNode) {
        workletNode.disconnect();
        workletNode.port.onmessage = null;
        workletNode = undefined;
      }
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = undefined;
      }
      if (audioCtx) {
        void audioCtx.close();
        audioCtx = undefined;
      }
      if (clonedTrack) {
        clonedTrack.stop();
        clonedTrack = undefined;
      }
    },

    onChunk(handler: PcmChunkHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
