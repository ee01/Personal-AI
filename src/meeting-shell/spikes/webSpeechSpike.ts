/**
 * Wave 0 Spike: SpeechRecognition in MV3 offscreen document.
 * This file exists to verify assumptions A1/A2 from the layered ASR plan.
 */

export {};

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  readonly start: (audioTrack?: MediaStreamTrack) => void;
  readonly abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionCtorLike {
  new (): SpeechRecognitionLike;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<unknown> | unknown;
}

interface SpikeResult {
  speechRecognitionType: string;
  webkitSpeechRecognitionType: string;
  processLocallySupported: boolean;
  availableMethodExists: boolean;
  startWithTrackSupported: boolean;
  errors: string[];
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtorLike | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtorLike;
    webkitSpeechRecognition?: SpeechRecognitionCtorLike;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

const result: SpikeResult = {
  speechRecognitionType: typeof (
    window as typeof window & { SpeechRecognition?: unknown }
  ).SpeechRecognition,
  webkitSpeechRecognitionType: typeof (
    window as typeof window & { webkitSpeechRecognition?: unknown }
  ).webkitSpeechRecognition,
  processLocallySupported: false,
  availableMethodExists: false,
  startWithTrackSupported: false,
  errors: [],
};

const speechRecognitionCtor = getSpeechRecognitionCtor();
if (speechRecognitionCtor) {
  try {
    const recognition = new speechRecognitionCtor();
    result.processLocallySupported = 'processLocally' in recognition;
    result.availableMethodExists =
      typeof speechRecognitionCtor.available === 'function';
    result.startWithTrackSupported = recognition.start.length >= 0;
  } catch (error) {
    result.errors.push(
      `SpeechRecognition instantiation failed: ${String(error)}`,
    );
  }
}

chrome.runtime.sendMessage({
  type: 'SPIKE_WEB_SPEECH_RESULT',
  result,
});

console.log('SPIKE_WEB_SPEECH_RESULT:', JSON.stringify(result, null, 2));
console.log('SpeechRecognition typeof =', result.speechRecognitionType);
console.log(
  'webkitSpeechRecognition typeof =',
  result.webkitSpeechRecognitionType,
);
console.log('processLocally supported =', result.processLocallySupported);
console.log('available() method exists =', result.availableMethodExists);

chrome.runtime.onMessage.addListener(
  (message: { type?: string; streamId?: string }) => {
    if (message.type !== 'SPIKE_START_CAPTURE_WEB_SPEECH') return;
    const streamId = message.streamId;
    if (!streamId) return;

    const tabAudioConstraints = {
      mandatory: {
        chromeMediaSource: 'tab' as const,
        chromeMediaSourceId: streamId,
      },
    } as unknown as MediaTrackConstraints;

    navigator.mediaDevices
      .getUserMedia({
        audio: tabAudioConstraints,
        video: false,
      })
      .then((stream) => {
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            error: 'No audio track in stream',
          });
          return;
        }

        const captureCtor = getSpeechRecognitionCtor();
        if (!captureCtor) {
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            error: 'SpeechRecognition not available',
          });
          return;
        }

        const recognition = new captureCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        if ('processLocally' in recognition) {
          recognition.processLocally = true;
        }

        const events: Array<
          | { type: 'result'; data: { transcript: string; isFinal: boolean } }
          | { type: 'error'; data: string }
        > = [];

        recognition.onresult = (event) => {
          const latestResult = event.results[event.results.length - 1];
          const transcript = latestResult[0].transcript;
          const isFinal = latestResult.isFinal;
          events.push({ type: 'result', data: { transcript, isFinal } });
          console.log('SPIKE_SR_RESULT:', transcript, 'final:', isFinal);
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            event: 'result',
            transcript,
            isFinal,
          });
        };

        recognition.onerror = (event) => {
          events.push({ type: 'error', data: event.error });
          console.log('SPIKE_SR_ERROR:', event.error);
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            event: 'error',
            error: event.error,
          });
        };

        recognition.onend = () => {
          console.log('SPIKE_SR_END');
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            event: 'end',
            totalEvents: events.length,
          });
        };

        try {
          recognition.start(audioTrack);
          console.log('SPIKE_SR_START_WITH_TRACK: called successfully');
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            event: 'start_called',
            success: true,
          });
        } catch (error) {
          console.log('SPIKE_SR_START_WITH_TRACK_ERROR:', String(error));
          chrome.runtime.sendMessage({
            type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
            event: 'start_error',
            error: String(error),
          });
        }
      })
      .catch((error) => {
        chrome.runtime.sendMessage({
          type: 'SPIKE_WEB_SPEECH_TRACK_RESULT',
          error: `getUserMedia failed: ${String(error)}`,
        });
      });
  },
);
