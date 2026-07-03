import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCloudASRStatusDetail,
  CloudASRProvider,
} from '../cloudASRProvider.js';

test('buildCloudASRStatusDetail names endpoint style, model, language, and segment window', () => {
  assert.equal(
    buildCloudASRStatusDetail({
      MEETING_TRANSCRIBE_API_STYLE: 'openai_chat_completions',
      MEETING_TRANSCRIBE_MODEL: 'qwen3-asr-flash',
      MEETING_TRANSCRIBE_LANGUAGE: 'zh-CN',
    }),
    'Cloud ASR · POST /v1/chat/completions + input_audio · OpenAI Chat Completions + input_audio · model qwen3-asr-flash · language zh-CN · segment 5s',
  );

  assert.equal(
    buildCloudASRStatusDetail({
      MEETING_TRANSCRIBE_API_STYLE: 'openai_audio_transcriptions',
      MEETING_TRANSCRIBE_MODEL: 'whisper-1',
      MEETING_TRANSCRIBE_LANGUAGE: 'auto',
    }),
    'Cloud ASR · POST /v1/audio/transcriptions · OpenAI Audio Transcriptions · model whisper-1 · language auto · segment 5s',
  );
});

test('CloudASRProvider.stop emits stopped status when idle', async () => {
  const provider = new CloudASRProvider();
  const statuses: string[] = [];
  provider.on('status', (event) => {
    statuses.push(event.state);
  });
  await provider.stop();
  assert.equal(statuses.includes('stopped'), true);
});

test('CloudASRProvider.queue is trimmed to latest 3 segments', () => {
  const provider = new CloudASRProvider();
  const enqueue = Reflect.get(provider as object, '_enqueue') as (
    blob: Blob,
    seq: number,
  ) => void;
  Reflect.set(
    provider as object,
    '_processQueue',
    async (): Promise<void> => undefined,
  );
  enqueue.call(provider, new Blob(['1']), 1);
  enqueue.call(provider, new Blob(['2']), 2);
  enqueue.call(provider, new Blob(['3']), 3);
  enqueue.call(provider, new Blob(['4']), 4);
  const queue = Reflect.get(provider as object, 'queue') as Array<{
    seq: number;
  }>;
  assert.equal(queue.length, 3);
  assert.deepEqual(
    queue.map((item) => item.seq),
    [2, 3, 4],
  );
});
