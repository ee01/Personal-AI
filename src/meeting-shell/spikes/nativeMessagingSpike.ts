type ChromeRuntimeWithNative = typeof chrome.runtime & {
  connectNative?: (application: string) => chrome.runtime.Port;
};

const runtimeWithNative: ChromeRuntimeWithNative = chrome.runtime;

const nmResult = {
  connectNativeType: typeof runtimeWithNative.connectNative,
  connectNativeExists: typeof runtimeWithNative.connectNative === 'function',
  error: null as string | null,
  portCreated: false,
  messageSent: false,
  replyReceived: false,
};

console.log('SPIKE_NM_connectNative_type =', nmResult.connectNativeType);
console.log('SPIKE_NM_connectNative_exists =', nmResult.connectNativeExists);

if (nmResult.connectNativeExists) {
  try {
    const port = runtimeWithNative.connectNative?.(
      'com.personal_ai.whisper_host_spike',
    );
    if (!port) {
      throw new Error('connectNative returned no port');
    }
    nmResult.portCreated = true;
    console.log('SPIKE_NM_port_created = true');

    port.onMessage.addListener((msg: unknown) => {
      nmResult.replyReceived = true;
      console.log('SPIKE_NM_reply_received =', JSON.stringify(msg));
      chrome.runtime.sendMessage({
        type: 'SPIKE_NM_RESULT',
        result: nmResult,
        reply: msg,
      });
    });

    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError?.message || 'disconnected';
      console.log('SPIKE_NM_disconnect =', err);
      chrome.runtime.sendMessage({
        type: 'SPIKE_NM_RESULT',
        result: nmResult,
        disconnect: err,
      });
    });

    port.postMessage({ ping: 1 });
    nmResult.messageSent = true;
    console.log('SPIKE_NM_message_sent = true');
  } catch (e) {
    nmResult.error = String(e);
    console.log('SPIKE_NM_error =', nmResult.error);
    chrome.runtime.sendMessage({ type: 'SPIKE_NM_RESULT', result: nmResult });
  }
} else {
  console.log(
    'SPIKE_NM_VERDICT = FAIL: connectNative not available in offscreen',
  );
  chrome.runtime.sendMessage({ type: 'SPIKE_NM_RESULT', result: nmResult });
}
