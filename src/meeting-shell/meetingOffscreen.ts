import { getEnvConfig, getMeetingTranscriptionMode } from '../utils';
import { MEETING_PILOT_OFFSCREEN_PATH } from './protocol';
import { releaseWhisperTranscodeContext } from './transcodeForWhisper';
import { ASROrchestrator } from './asr/orchestrator';
import { CloudASRProvider } from './asr/cloudASRProvider';
import { DesktopLocalAsrProvider } from './asr/desktopLocalAsrProvider';
import { WebSpeechProvider } from './asr/webSpeechProvider';
import type { MeetingPilotTierStatus } from './protocol';

type OffscreenCaptureState = {
  meetingId?: string;
  tabId?: number;
  title?: string;
  streamId?: string;
  stream?: MediaStream;
  micStream?: MediaStream;
  asrAudioStream?: MediaStream;
  recorder?: MediaRecorder;
  asrOrchestrator?: ASROrchestrator;
  micAsrOrchestrator?: ASROrchestrator;
  tierStatus?: MeetingPilotTierStatus;
  micGain?: GainNode;
  micMuted: boolean;
  selfName?: string;
  activeSpeakerLabel?: string;
  /**
   * Route captured tab audio back to speakers while keeping tab and mic ASR
   * separate so speaker attribution can distinguish remote speakers from self.
   */
  audioContext?: AudioContext;
  chunks: Blob[];
  startedAt?: number;
  chunkCount: number;
  blobSize: number;
  transcriptSeq: number;
  requestLog: Array<{
    id: string;
    ts: number;
    level: 'info' | 'request' | 'response' | 'error';
    message: string;
  }>;
  testApiMock?: {
    enabled: boolean;
    requestLog: string[];
  };
  /**
   * MediaRecorder mimeType for merging chunks into a single WebM before
   * uploading the full recording to the minutes service.
   */
  recorderMimeType?: string;
};

const AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
];
const VIDEO_RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const state: OffscreenCaptureState = {
  chunks: [],
  chunkCount: 0,
  blobSize: 0,
  transcriptSeq: 0,
  micMuted: false,
  requestLog: [],
};

function setMicMuted(muted: boolean): void {
  state.micMuted = muted;
  if (state.micGain) {
    state.micGain.gain.value = muted ? 0 : 1;
  }
  appendCaptureLog(
    'info',
    `offscreen mic ${muted ? 'muted' : 'unmuted'} for ASR`,
  );
}

function normalizeSpeakerIdentity(value?: string): string {
  return String(value || '')
    .replace(/\s*\(you\)\s*$/i, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSelfSpeakerLabel(value?: string): boolean {
  const selfName = normalizeSpeakerIdentity(state.selfName);
  const speaker = normalizeSpeakerIdentity(value);
  return Boolean(selfName && speaker && selfName === speaker);
}

function shouldEmitMicTranscript(): boolean {
  if (state.micMuted) return false;
  if (!state.activeSpeakerLabel) return true;
  return isSelfSpeakerLabel(state.activeSpeakerLabel);
}

function updateMeetingContextForOffscreen(message: Record<string, any>): void {
  if (typeof message.micMuted === 'boolean') {
    setMicMuted(message.micMuted);
  }
  const selfName = String(message.selfName || '').trim();
  if (selfName) state.selfName = selfName;
  state.activeSpeakerLabel =
    String(message.speakerLabel || '').trim() || undefined;
}

function getSupportedRecorderMimeType(
  candidates: string[],
): string | undefined {
  return candidates.find((candidate) =>
    MediaRecorder.isTypeSupported(candidate),
  );
}

function appendCaptureLog(
  level: 'info' | 'request' | 'response' | 'error',
  message: string,
): void {
  const log =
    level === 'error'
      ? console.error
      : level === 'request'
        ? console.info
        : console.log;
  log(`[Meeting Pilot][offscreen][${level}] ${message}`);
  state.requestLog.push({
    id: `${Date.now()}-${state.requestLog.length}`,
    ts: Date.now(),
    level,
    message,
  });
  if (state.requestLog.length > 60) {
    state.requestLog = state.requestLog.slice(-60);
  }
}

function setStatus(message: string): void {
  const element = document.getElementById('meeting-pilot-offscreen-status');
  if (element) {
    element.textContent = message;
  }
}

async function createCaptureStream(streamId: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      } as any,
    } as any,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      } as any,
    } as any,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

function emitCaptureStatus(kind: string, lastError?: string): void {
  void chrome.runtime.sendMessage({
    type: 'MEETING_PILOT_CAPTURE_STATUS',
    tabId: state.tabId,
    capture: {
      kind,
      lastError,
      chunkCount: state.chunkCount,
      blobSize: state.blobSize,
      startedAt: state.startedAt,
      streamId: state.streamId,
    },
    tierStatus: state.tierStatus,
  });
}

function emitDigestStatus(digest: Record<string, unknown>): void {
  void chrome.runtime.sendMessage({
    type: 'MEETING_PILOT_DIGEST_STATUS',
    tabId: state.tabId,
    digest,
  });
}

function emitObservation(observationText: string): void {
  void chrome.runtime.sendMessage({
    type: 'MEETING_PILOT_OBSERVATION_UPDATE',
    tabId: state.tabId,
    observationText,
  });
}

async function captureFrameDataUrl(
  stream: MediaStream,
): Promise<string | undefined> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  await new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }
    video.onloadeddata = () => resolve();
    window.setTimeout(() => resolve(), 1200);
  });
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  if (!width || !height) {
    video.srcObject = null;
    return undefined;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    video.srcObject = null;
    return undefined;
  }
  context.drawImage(video, 0, 0, width, height);
  video.pause();
  video.srcObject = null;
  return canvas.toDataURL('image/jpeg', 0.72);
}

async function analyzeObservationFromFrame(stream: MediaStream): Promise<void> {
  if (!state.tabId) return;
  try {
    const envConfig = await getEnvConfig();
    const baseUrl = String(envConfig.MEETING_PROVIDER_BASE_URL || '').replace(
      /\/$/,
      '',
    );
    const apiKey = String(envConfig.MEETING_PROVIDER_API_KEY || '').trim();
    // Vision 仍走 OneAPI/兼容网关；与主配置对齐时用 OPENAI_MODEL 作为多模态名。
    const model = String(envConfig.OPENAI_MODEL || '').trim();
    if (!baseUrl || !apiKey || !model) {
      return;
    }
    const dataUrl = await captureFrameDataUrl(stream);
    if (!dataUrl) {
      return;
    }
    appendCaptureLog('request', 'POST /v1/chat/completions (observation OCR)');
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You extract visible text and concise meeting-screen observations from screenshots.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the most important visible text from this meeting screenshot as a concise OCR-style summary in Chinese. Mention slides, charts, agenda items, or labels if visible. Keep it under 120 Chinese characters.',
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    });
    const payload = await response.json();
    const observationText = String(
      payload?.choices?.[0]?.message?.content || '',
    ).trim();
    if (!response.ok || !observationText) {
      return;
    }
    appendCaptureLog('response', 'observation OCR received');
    emitObservation(observationText);
  } catch (error) {
    appendCaptureLog(
      'error',
      `observation OCR failed: ${String((error as Error)?.message || error || 'unknown_error')}`,
    );
  }
}

async function createAsrAudioStream(args: {
  audioCtx: AudioContext;
  tabStream: MediaStream;
}): Promise<{ tabStream: MediaStream; micStream?: MediaStream }> {
  const tabAudioTracks = args.tabStream
    .getAudioTracks()
    .filter((track) => track.readyState === 'live');
  const tabOnlyStream = new MediaStream(tabAudioTracks);
  if (!tabAudioTracks.length) {
    appendCaptureLog('error', 'ASR stream unavailable: no live tab audio track');
    return { tabStream: tabOnlyStream };
  }

  const tabSrc = args.audioCtx.createMediaStreamSource(tabOnlyStream);

  // tabCapture mutes local playback unless the captured audio is routed back.
  tabSrc.connect(args.audioCtx.destination);

  try {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    state.micStream = micStream;
    const micTracks = micStream
      .getAudioTracks()
      .filter((track) => track.readyState === 'live');
    if (!micTracks.length) {
      appendCaptureLog('info', 'offscreen mic stream has no live audio track');
      return { tabStream: tabOnlyStream };
    }
    const micSrc = args.audioCtx.createMediaStreamSource(
      new MediaStream(micTracks),
    );
    const micDest = args.audioCtx.createMediaStreamDestination();
    const micGain = args.audioCtx.createGain();
    micGain.gain.value = state.micMuted ? 0 : 1;
    state.micGain = micGain;
    micSrc.connect(micGain);
    micGain.connect(micDest);
    appendCaptureLog('info', 'offscreen mic stream acquired; ASR uses tab+mic separate streams');
    return { tabStream: tabOnlyStream, micStream: micDest.stream };
  } catch (error) {
    appendCaptureLog(
      'info',
      `offscreen mic unavailable; ASR uses tab-only: ${String((error as Error)?.name || '')} ${String((error as Error)?.message || error)}`.trim(),
    );
    return { tabStream: tabOnlyStream };
  }
}

async function startCapture(message: Record<string, any>): Promise<void> {
  if (state.recorder && state.recorder.state !== 'inactive') {
    state.recorder.stop();
  }

  state.meetingId = String(message.meetingId || '');
  state.tabId = Number(message.tabId || 0);
  state.title = String(message.title || `Meeting ${state.meetingId || ''}`);
  state.streamId = String(message.streamId || '');
  state.chunks = [];
  state.recorderMimeType = undefined;
  state.chunkCount = 0;
  state.blobSize = 0;
  state.transcriptSeq = 0;
  state.tierStatus = undefined;
  state.startedAt = Date.now();
  state.requestLog = [];
  state.selfName = String(message.selfName || '').trim() || undefined;
  state.activeSpeakerLabel =
    String(message.speakerLabel || '').trim() || undefined;
  setMicMuted(message.micMuted === true);
  appendCaptureLog(
    'info',
    `capture requested for ${state.meetingId || 'meeting'}`,
  );

  if (state.streamId === '__meeting_pilot_test_mock_stream__') {
    setStatus(`Mock recording ${state.meetingId || ''}`);
    appendCaptureLog('info', 'MediaRecorder started');
    emitCaptureStatus('recording');
    return;
  }

  try {
    const stream = await createCaptureStream(state.streamId);
    state.stream = stream;

    const audioCtx = new AudioContext();
    state.audioContext = audioCtx;

    const audioTracks = stream
      .getAudioTracks()
      .filter((track) => track.readyState === 'live');
    const recorderStream = audioTracks.length
      ? new MediaStream(audioTracks)
      : stream;
    const mimeType = getSupportedRecorderMimeType(
      audioTracks.length
        ? AUDIO_RECORDER_MIME_CANDIDATES
        : VIDEO_RECORDER_MIME_CANDIDATES,
    );
    const recorder = mimeType
      ? new MediaRecorder(recorderStream, { mimeType })
      : new MediaRecorder(recorderStream);
    state.recorder = recorder;
    state.recorderMimeType = recorder.mimeType || mimeType;

    recorder.ondataavailable = (event) => {
      if (!event.data.size) {
        return;
      }
      state.chunks.push(event.data);
      state.chunkCount += 1;
      state.blobSize += event.data.size;
      emitCaptureStatus('recording');
    };

    recorder.onerror = (event) => {
      const error =
        (event as MediaRecorderErrorEvent).error?.message || 'recorder_error';
      setStatus(`Error: ${error}`);
      emitCaptureStatus('error', error);
    };

    recorder.start(5000);
    setStatus(`Recording ${state.meetingId || ''}`);
    appendCaptureLog(
      'info',
      `MediaRecorder started (${
        audioTracks.length ? 'audio' : 'video fallback'
      }, ${state.recorderMimeType || 'default mime'})`,
    );

    const asrStreams = await createAsrAudioStream({
      audioCtx,
      tabStream: stream,
    });
    state.asrAudioStream = asrStreams.tabStream;
    const envConfig = await getEnvConfig();
    const transcriptionMode = getMeetingTranscriptionMode(envConfig);
    // SpeechRecognition.start(audioTrack) is unstable in extension/offscreen
    // renderers. Use it only when the user explicitly chooses local-only.
    const providers =
      transcriptionMode === 'local-only'
        ? [new DesktopLocalAsrProvider(), new WebSpeechProvider()]
        : [new DesktopLocalAsrProvider(), new CloudASRProvider()];
    const buildOrchestrator = (args: {
      channel: 'tab' | 'mic';
      fixedSpeaker?: string;
    }) =>
      new ASROrchestrator({
        providers,
        mode: transcriptionMode,
        onTierStatus: (tierStatus: MeetingPilotTierStatus) => {
          if (args.channel === 'mic') return;
          state.tierStatus = tierStatus;
          void chrome.runtime.sendMessage({
            type: 'MEETING_PILOT_TIER_STATUS_UPDATE',
            tabId: state.tabId,
            tierStatus,
          });
          emitCaptureStatus('recording');
        },
        onTranscript: (event) => {
          state.transcriptSeq += 1;
          void chrome.runtime.sendMessage({
            type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
            tabId: state.tabId,
            transcriptChunk: {
              id: event.utteranceId
                ? `transcript-${event.utteranceId}`
                : `transcript-${event.ts}-${state.transcriptSeq}`,
              speaker: args.fixedSpeaker || '',
              text: event.text,
              ts: event.ts,
              source:
                event.tier === 'web_speech'
                  ? 'web_speech'
                  : event.tier === 'desktop_whisper'
                    ? 'desktop_whisper'
                    : 'cloud',
              lowConfidence: event.kind === 'interim',
            },
          });
        },
        onCaptureLog: (level, msg) =>
          appendCaptureLog(level, `${args.channel} ${msg}`),
      });

    const orchestrator = buildOrchestrator({ channel: 'tab' });
    state.asrOrchestrator = orchestrator;
    if (
      asrStreams.tabStream.getAudioTracks().some((t) => t.readyState === 'live')
    ) {
      void orchestrator.start(asrStreams.tabStream);
    }
    if (asrStreams.micStream) {
      const fixedSpeaker = state.selfName || 'You';
      const micProviders =
        transcriptionMode === 'cloud-only'
          ? [new CloudASRProvider()]
          : [new DesktopLocalAsrProvider()];
      const micOrchestrator = new ASROrchestrator({
        providers: micProviders,
        mode: transcriptionMode,
        onTierStatus: () => undefined,
        onTranscript: (event) => {
          if (!shouldEmitMicTranscript()) {
            appendCaptureLog(
              'info',
              `mic transcript suppressed (${state.micMuted ? 'muted' : `active speaker: ${state.activeSpeakerLabel || 'unknown'}`})`,
            );
            return;
          }
          state.transcriptSeq += 1;
          void chrome.runtime.sendMessage({
            type: 'MEETING_PILOT_TRANSCRIPT_UPDATE',
            tabId: state.tabId,
            transcriptChunk: {
              id: event.utteranceId
                ? `transcript-${event.utteranceId}`
                : `transcript-${event.ts}-${state.transcriptSeq}`,
              speaker: fixedSpeaker,
              text: event.text,
              ts: event.ts,
              source:
                event.tier === 'web_speech'
                  ? 'web_speech'
                  : event.tier === 'desktop_whisper'
                    ? 'desktop_whisper'
                    : 'cloud',
              lowConfidence: event.kind === 'interim',
            },
          });
        },
        onCaptureLog: (level, msg) => appendCaptureLog(level, `mic ${msg}`),
      });
      state.micAsrOrchestrator = micOrchestrator;
      void micOrchestrator.start(asrStreams.micStream);
      appendCaptureLog(
        'info',
        `mic ASR orchestrator started for ${fixedSpeaker}`,
      );
    }
    appendCaptureLog(
      'info',
      `ASR orchestrator started (mode: ${transcriptionMode})`,
    );
    emitCaptureStatus('recording');
    void analyzeObservationFromFrame(stream).finally(() => {
      if (audioTracks.length) {
        stream.getVideoTracks().forEach((track) => track.stop());
        appendCaptureLog('info', 'capture video track released after observation');
      }
    });
    emitDigestStatus({
      status: 'idle',
      message: 'Capture running. Digest will start after stop.',
    });
  } catch (error) {
    const messageText = String(
      (error as Error)?.message || error || 'capture_failed',
    );
    setStatus(`Mock recording: ${messageText}`);
    appendCaptureLog('error', `capture start failed: ${messageText}`);
    emitCaptureStatus('error', messageText);
  }
}

async function stopCapture(): Promise<void> {
  const recorder = state.recorder;
  if (state.asrOrchestrator) {
    await state.asrOrchestrator.stop();
    state.asrOrchestrator = undefined;
  }
  if (state.micAsrOrchestrator) {
    await state.micAsrOrchestrator.stop();
    state.micAsrOrchestrator = undefined;
  }
  const stopPromise =
    recorder && recorder.state !== 'inactive'
      ? new Promise<void>((resolve) => {
          const handleStop = () => {
            recorder.removeEventListener('stop', handleStop);
            resolve();
          };
          recorder.addEventListener('stop', handleStop, { once: true });
        })
      : Promise.resolve();

  if (state.recorder && state.recorder.state !== 'inactive') {
    state.recorder.stop();
  }
  await stopPromise;
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  if (state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
    state.micStream = undefined;
  }
  state.micGain = undefined;
  state.asrAudioStream = undefined;
  if (state.audioContext) {
    state.audioContext.close().catch(() => undefined);
    state.audioContext = undefined;
  }
  releaseWhisperTranscodeContext();
  state.recorder = undefined;
  state.tierStatus = undefined;
  state.stream = undefined;
  setStatus('Stopped');
  appendCaptureLog('info', 'capture stopped');
  emitCaptureStatus('stopped');

  if (state.chunks.length > 0 && state.tabId) {
    await uploadDigestForCapture();
  }
}

async function uploadDigestForCapture(): Promise<void> {
  if (!state.meetingId || !state.tabId || state.chunks.length === 0) {
    return;
  }

  const envConfig = await getEnvConfig();
  const baseUrl = String(
    envConfig.MEETING_MINUTES_API_URL ||
      envConfig.MEETING_DIGEST_API_BASE_URL ||
      '',
  ).replace(/\/$/, '');
  if (!baseUrl) {
    emitDigestStatus({
      status: 'failed',
      errorCode: 'missing_minutes_api_base_url',
      message:
        'Minutes API is not configured. PDF minutes were skipped for this meeting.',
    });
    return;
  }

  const recordingBlob = new Blob(state.chunks, {
    type: state.recorderMimeType || state.chunks[0]?.type || 'audio/webm',
  });
  const meetingKey = `${state.meetingId}-${Date.now()}`;

  try {
    setStatus('Uploading recording…');
    appendCaptureLog('request', 'POST /api/v2/upload/video');
    emitCaptureStatus('uploading');
    emitDigestStatus({
      status: 'uploading',
      lookupId: meetingKey,
      message: 'Uploading meeting recording',
    });

    const formData = new FormData();
    formData.append('file', recordingBlob, `meeting-${state.meetingId}.webm`);

    let uploadData: any;
    if (state.testApiMock?.enabled) {
      state.testApiMock.requestLog.push('POST /api/v2/upload/video');
      uploadData = { videoUrl: `${baseUrl}/uploaded/${state.meetingId}.webm` };
    } else {
      const uploadResponse = await fetch(`${baseUrl}/api/v2/upload/video`, {
        method: 'POST',
        body: formData,
      });
      uploadData = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadData.videoUrl) {
        throw new Error(uploadData.error || 'video_upload_failed');
      }
    }

    appendCaptureLog('response', 'video upload completed');

    emitDigestStatus({
      status: 'processing',
      lookupId: meetingKey,
      videoUrl: uploadData.videoUrl,
      message: 'Video uploaded. Starting digest generation.',
      errorCode: undefined,
    });

    let generateData: any;
    if (state.testApiMock?.enabled) {
      state.testApiMock.requestLog.push('POST /api/v3/generate_digest');
      generateData = {
        taskId: 'scene2-task',
        status: 'PROCESSING',
        message: 'queued',
      };
    } else {
      appendCaptureLog('request', 'POST /api/v3/generate_digest');
      const generateResponse = await fetch(
        `${baseUrl}/api/v3/generate_digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: meetingKey,
            videoUrl: uploadData.videoUrl,
            sessionName: state.title || `Meeting ${state.meetingId}`,
            output: 'pdf',
            needClips: false,
          }),
        },
      );
      generateData = await generateResponse.json();
      if (!generateResponse.ok) {
        throw new Error(generateData.error || 'digest_generation_failed');
      }
    }

    appendCaptureLog('response', 'digest generation accepted');

    emitDigestStatus({
      status: 'processing',
      taskId: generateData.taskId,
      lookupId: meetingKey,
      videoUrl: uploadData.videoUrl,
      message: generateData.message || 'Digest generation in progress',
      errorCode: undefined,
    });

    setStatus('Digest queued');
  } catch (error) {
    const messageText = String(
      (error as Error)?.message || error || 'digest_failed',
    );
    appendCaptureLog('error', `digest flow failed: ${messageText}`);
    setStatus(`Digest failed: ${messageText}`);
    emitCaptureStatus('error', messageText);
    emitDigestStatus({
      status: 'failed',
      errorCode: 'digest_flow_failed',
      message: messageText,
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MEETING_PILOT_OFFSCREEN_BOOTSTRAP_CAPTURE') {
    state.meetingId = String(message.meetingId || '');
    state.tabId = Number(message.tabId || 0);
    state.title = String(message.title || `Meeting ${state.meetingId || ''}`);
    state.streamId = undefined;
    state.stream = undefined;
    state.recorder = undefined;
    state.chunks = [];
    state.chunkCount = 0;
    state.blobSize = 0;
    state.startedAt = Date.now();
    setStatus(`Mock recording ${state.meetingId || ''}`);
    emitCaptureStatus('recording');
    emitDigestStatus({
      status: 'idle',
      message: 'Capture running. Digest will start after stop.',
    });
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_SET_TEST_API_MOCK') {
    state.testApiMock = {
      enabled: Boolean(message.enabled),
      requestLog: [],
    };
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_GET_TEST_API_LOG') {
    sendResponse({ requestLog: state.testApiMock?.requestLog || [] });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_GET_CAPTURE_LOG') {
    sendResponse({ entries: state.requestLog || [] });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_START_CAPTURE') {
    void startCapture(message).catch((error) => {
      const messageText = String(
        (error as Error)?.message || error || 'capture_start_failed',
      );
      appendCaptureLog('error', `capture start failed: ${messageText}`);
      emitCaptureStatus('error', messageText);
    });
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_INJECT_CHUNK') {
    const text = String(message.text || 'fixture chunk');
    const chunk = new Blob([text], { type: 'video/webm' });
    state.chunks.push(chunk);
    state.chunkCount += 1;
    state.blobSize += chunk.size;
    emitCaptureStatus('recording');
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_STOP_CAPTURE') {
    appendCaptureLog(
      'info',
      `stop requested (${String(message.reason || 'manual-stop')})`,
    );
    void stopCapture().catch((error) => {
      const messageText = String(
        (error as Error)?.message || error || 'capture_stop_failed',
      );
      appendCaptureLog('error', `capture stop failed: ${messageText}`);
      emitCaptureStatus('error', messageText);
    });
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_SET_MIC_MUTED') {
    setMicMuted(message.micMuted === true);
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'MEETING_PILOT_OFFSCREEN_UPDATE_CONTEXT') {
    updateMeetingContextForOffscreen(message);
    sendResponse({ success: true });
    return true;
  }
  return false;
});

document.body.innerHTML = `
  <div style="padding:16px;font-family:Inter,system-ui,sans-serif;background:#0b1020;color:#eef2ff;min-height:100vh;">
    <h1 style="font-size:16px;margin:0 0 8px;">Meeting Pilot Offscreen</h1>
    <p id="meeting-pilot-offscreen-status" style="margin:0;font-size:12px;color:#a5b4fc;">Ready</p>
    <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">This page stays hidden and hosts MediaRecorder for the meeting tab.</p>
  </div>
`;

setStatus(`Loaded ${MEETING_PILOT_OFFSCREEN_PATH}`);
