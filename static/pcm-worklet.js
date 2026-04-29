class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSamples = 0;
    this._targetSamples = Math.round(sampleRate * 0.2);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || !input[0].length) return true;

    const inputChannel = input[0];
    const inputLen = inputChannel.length;
    const ratio = sampleRate / 16000;

    const outputLen = Math.floor(inputLen / ratio);
    if (outputLen < 1) return true;

    const downsampled = new Float32Array(outputLen);
    for (let i = 0; i < outputLen; i++) {
      downsampled[i] = inputChannel[Math.floor(i * ratio)];
    }

    const int16 = new Int16Array(outputLen);
    for (let i = 0; i < outputLen; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this._buffer.push(int16);
    this._bufferSamples += outputLen;

    if (this._bufferSamples >= this._targetSamples) {
      const merged = new Int16Array(this._bufferSamples);
      let offset = 0;
      for (const chunk of this._buffer) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this._buffer = [];
      this._bufferSamples = 0;
      this.port.postMessage(
        { type: 'pcm', buffer: merged.buffer, sampleCount: merged.length },
        [merged.buffer],
      );
    }

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
