/**
 * OneAPI / 部分 OpenAI 兼容网关在 /v1/audio/transcriptions 上对 WebM 用简化 EBML 算时长，
 * 会 500（count_token_failed）。浏览器内将 MediaRecorder 的 webm 分片解码为 PCM
 * 再封成更轻的 16k/mono WAV，可绕开该问题，也更适合多数 ASR provider。
 */

function writeString(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}

function toMono(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < numChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i += 1) {
      mono[i] += data[i] || 0;
    }
  }
  if (numChannels > 1) {
    for (let i = 0; i < mono.length; i += 1) {
      mono[i] /= numChannels;
    }
  }
  return mono;
}

function resampleLinear(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }
  const outputLength = Math.max(
    1,
    Math.round((input.length * outputSampleRate) / inputSampleRate),
  );
  const output = new Float32Array(outputLength);
  const ratio = inputSampleRate / outputSampleRate;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const weight = position - left;
    output[i] = input[left] * (1 - weight) + input[right] * weight;
  }
  return output;
}

function toDb(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return -100;
  }
  return 20 * Math.log10(value);
}

export interface MeetingAudioSignalAnalysis {
  durationSec: number;
  overallRms: number;
  overallRmsDb: number;
  peakAbs: number;
  peakDb: number;
  activeFrames: number;
  totalFrames: number;
  activeFrameRatio: number;
  likelyHasSpeech: boolean;
}

function analyzeMonoSignal(
  monoData: Float32Array,
  sampleRate: number,
): MeetingAudioSignalAnalysis {
  const frameSize = Math.max(1, Math.round(sampleRate * 0.02));
  let sumSquares = 0;
  let peakAbs = 0;
  let activeFrames = 0;
  let totalFrames = 0;

  for (let start = 0; start < monoData.length; start += frameSize) {
    const end = Math.min(monoData.length, start + frameSize);
    let frameSumSquares = 0;
    let framePeak = 0;
    for (let i = start; i < end; i += 1) {
      const sample = Math.abs(monoData[i] ?? 0);
      frameSumSquares += sample * sample;
      if (sample > framePeak) {
        framePeak = sample;
      }
    }
    const frameLength = Math.max(1, end - start);
    const frameRms = Math.sqrt(frameSumSquares / frameLength);
    sumSquares += frameSumSquares;
    peakAbs = Math.max(peakAbs, framePeak);
    totalFrames += 1;

    // Conservative gate: only skip when audio is effectively silent.
    if (frameRms >= 0.003 || framePeak >= 0.015) {
      activeFrames += 1;
    }
  }

  const overallRms = Math.sqrt(sumSquares / Math.max(1, monoData.length));
  const activeFrameRatio =
    totalFrames > 0 ? activeFrames / totalFrames : 0;
  const durationSec = monoData.length / Math.max(1, sampleRate);
  const likelyHasSpeech =
    peakAbs >= 0.008 ||
    overallRms >= 0.0015 ||
    activeFrames >= 8 ||
    activeFrameRatio >= 0.02;

  return {
    durationSec,
    overallRms,
    overallRmsDb: toDb(overallRms),
    peakAbs,
    peakDb: toDb(peakAbs),
    activeFrames,
    totalFrames,
    activeFrameRatio,
    likelyHasSpeech,
  };
}

export function audioBufferToWavPcm16(
  buffer: AudioBuffer,
  targetSampleRate = 16_000,
): ArrayBuffer {
  const monoData = resampleLinear(
    toMono(buffer),
    buffer.sampleRate,
    targetSampleRate,
  );
  const numChannels = 1;
  const sampleRate = targetSampleRate;
  const numFrames = monoData.length;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const out = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(out);
  const format = 1; // PCM

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * blockAlign) >>> 0, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let pos = headerSize;
  for (let i = 0; i < numFrames; i += 1) {
    const s = Math.max(-1, Math.min(1, monoData[i] ?? 0));
    const v =
      s < 0
        ? Math.max(-32768, Math.floor(s * 0x8000))
        : Math.min(32767, Math.floor(s * 0x7fff));
    view.setInt16(pos, v, true);
    pos += 2;
  }
  return out;
}

let sharedDecodeContext: AudioContext | null = null;

async function getDecodeContext(): Promise<AudioContext> {
  if (sharedDecodeContext && sharedDecodeContext.state !== 'closed') {
    return sharedDecodeContext;
  }
  sharedDecodeContext = new AudioContext();
  return sharedDecodeContext;
}

export async function decodeMediaBlobToAudioBuffer(
  input: Blob,
): Promise<AudioBuffer> {
  const ab = await input.arrayBuffer();
  const ctx = await getDecodeContext();
  return ctx.decodeAudioData(ab.slice(0));
}

export function analyzeAudioBufferForSpeechPresence(
  buffer: AudioBuffer,
  targetSampleRate = 16_000,
): MeetingAudioSignalAnalysis {
  const monoData = resampleLinear(
    toMono(buffer),
    buffer.sampleRate,
    targetSampleRate,
  );
  return analyzeMonoSignal(monoData, targetSampleRate);
}

export async function prepareMediaBlobForTranscription(
  input: Blob,
): Promise<{
  wavBlob: Blob;
  signal: MeetingAudioSignalAnalysis;
}> {
  const audioBuffer = await decodeMediaBlobToAudioBuffer(input);
  const signal = analyzeAudioBufferForSpeechPresence(audioBuffer);
  const wavBlob = new Blob([audioBufferToWavPcm16(audioBuffer)], {
    type: 'audio/wav',
  });
  return { wavBlob, signal };
}

/**
 * 将录制的 WebM/Opus（或其它 decodeAudioData 能解的格式）转为更轻的 16k/mono WAV。
 * @returns null 表示本段无法转码，应放弃本次请求或记录错误。
 */
export async function transcodeMediaBlobToWavForWhisper(
  input: Blob,
): Promise<Blob> {
  const prepared = await prepareMediaBlobForTranscription(input);
  return prepared.wavBlob;
}

export function releaseWhisperTranscodeContext(): void {
  if (sharedDecodeContext) {
    void sharedDecodeContext.close();
    sharedDecodeContext = null;
  }
}
