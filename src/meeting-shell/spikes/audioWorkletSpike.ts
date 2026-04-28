/**
 * Wave 0 Spike: AudioWorklet in MV3 offscreen document (Task 3)
 * Verifies assumption A4: AudioWorklet available in offscreen context.
 */

async function runAudioWorkletSpike(): Promise<void> {
  const result = {
    audioContextAvailable: typeof AudioContext !== 'undefined',
    audioWorkletAvailable: false,
    addModuleSucceeded: false,
    processorFired: false,
    error: null as string | null,
  };

  if (!result.audioContextAvailable) {
    chrome.runtime.sendMessage({ type: 'SPIKE_AUDIO_WORKLET_RESULT', result });
    return;
  }

  try {
    const audioCtx = new AudioContext();
    result.audioWorkletAvailable = 'audioWorklet' in audioCtx;

    if (result.audioWorkletAvailable) {
      const workletUrl = chrome.runtime.getURL('spikeWorkletProcessor.js');
      await audioCtx.audioWorklet.addModule(workletUrl);
      result.addModuleSucceeded = true;

      const workletNode = new AudioWorkletNode(audioCtx, 'spike-processor');
      workletNode.port.onmessage = (event) => {
        if (event.data?.type === 'pcm_frame') {
          result.processorFired = true;
          chrome.runtime.sendMessage({
            type: 'SPIKE_AUDIO_WORKLET_FRAME',
            frame: event.data,
          });
        }
      };
    }

    chrome.runtime.sendMessage({ type: 'SPIKE_AUDIO_WORKLET_RESULT', result });
  } catch (err) {
    result.error = String((err as Error)?.message || err);
    chrome.runtime.sendMessage({ type: 'SPIKE_AUDIO_WORKLET_RESULT', result });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SPIKE_START_AUDIO_WORKLET') {
    void runAudioWorkletSpike();
  }
});

void runAudioWorkletSpike();
