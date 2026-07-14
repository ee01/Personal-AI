import assert from 'node:assert/strict';

import {
  buildMeetingTranscriptionReadiness,
  describeLocalASRPreflightStatus,
} from '../src/meeting-shell/asr/localReadinessPresentation.ts';

const downloading = describeLocalASRPreflightStatus({
  ok: true,
  liveReady: false,
  finalReady: false,
  downloadInProgress: true,
  downloadProgress: 42,
  downloadTarget: 'funasr_nano',
  engines: {
    appleSpeech: { ready: false, reason: 'not_authorized' },
    sherpaStreaming: { modelReady: false, reason: 'missing_model' },
    funasrFinal: { modelReady: false, reason: 'missing_model' },
    whisperFallback: {
      ready: false,
      modelReady: false,
      whisperBinaryAvailable: true,
    },
  },
});

assert.equal(downloading.available, false);
assert.match(downloading.summary, /本机 ASR 模型下载中（42%） · funasr nano/);
assert.match(downloading.nextStep, /保持 Personal AI Desktop App 开启/);
assert.equal(downloading.issueToken, 'asr_model_downloading 42% funasr_nano');

const localOnlyDownloading = buildMeetingTranscriptionReadiness({
  mode: 'local-only',
  local: downloading,
  cloudStatus: 'ready',
  cloudMessage: 'Audio transcription is available.',
});

assert.equal(localOnlyDownloading.status, 'degraded');
assert.match(localOnlyDownloading.message, /本机 ASR 模型下载中（42%）/);
assert.match(localOnlyDownloading.message, /local-only 不会调用云端 ASR/);
assert.doesNotMatch(localOnlyDownloading.message, /asr_model_downloading/);

const autoCloudFallback = buildMeetingTranscriptionReadiness({
  mode: 'auto',
  local: downloading,
  cloudStatus: 'ready',
  cloudMessage: 'Audio transcription is available.',
});

assert.equal(autoCloudFallback.status, 'degraded');
assert.match(autoCloudFallback.message, /Auto 仍可用 Cloud ASR fallback/);
assert.match(autoCloudFallback.message, /只有实际切到 Cloud 层时才上传音频/);
assert.doesNotMatch(autoCloudFallback.message, /asr_model_downloading/);

const liveReadyFinalMissing = describeLocalASRPreflightStatus({
  ok: true,
  liveReady: true,
  finalReady: false,
  engines: {
    appleSpeech: { ready: true },
    sherpaStreaming: { modelReady: false, reason: 'missing_model' },
    funasrFinal: { modelReady: false, reason: 'missing_model' },
    whisperFallback: {
      ready: false,
      modelReady: false,
      whisperBinaryAvailable: false,
    },
  },
});

assert.equal(liveReadyFinalMissing.available, false);
assert.match(liveReadyFinalMissing.summary, /本地实时引擎已就绪/);
assert.match(
  liveReadyFinalMissing.summary,
  /Local ASR session 仍需要 FunASR 或 Whisper fallback/,
);
assert.match(liveReadyFinalMissing.nextStep, /local-only 不会调用云端/);
assert.doesNotMatch(liveReadyFinalMissing.summary, /live_ready_final_not_ready/);

const finalOnly = describeLocalASRPreflightStatus({
  ok: true,
  ready: false,
  liveReady: false,
  finalReady: true,
  engines: {
    appleSpeech: { ready: false, reason: 'not_authorized' },
    sherpaStreaming: { modelReady: false, reason: 'missing_model' },
    funasrFinal: { modelReady: false, reason: 'missing_model' },
    whisperFallback: {
      ready: true,
      modelReady: true,
      whisperBinaryAvailable: true,
    },
  },
});

assert.equal(finalOnly.available, true);
assert.equal(finalOnly.liveReady, false);
assert.match(finalOnly.summary, /final transcript 可用/);
assert.match(finalOnly.nextStep, /不要把短时间空白误认为无人发言/);

const disconnected = describeLocalASRPreflightStatus(null);
assert.equal(disconnected.connected, false);
assert.match(disconnected.summary, /Desktop App 未连接/);

console.log('verify-meeting-pilot-asr-preflight: ok');
