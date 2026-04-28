class SpikeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this._frameCount++;
      if (this._frameCount <= 10 || this._frameCount % 100 === 0) {
        const samples = input[0];
        const maxVal = Math.max(...samples.map(Math.abs));
        this.port.postMessage({
          type: 'pcm_frame',
          frameIndex: this._frameCount,
          sampleCount: samples.length,
          maxAmplitude: maxVal,
          sampleRate: sampleRate,
          nonZero: maxVal > 0.0001,
        });
      }
    }
    return true;
  }
}

registerProcessor('spike-processor', SpikeProcessor);
