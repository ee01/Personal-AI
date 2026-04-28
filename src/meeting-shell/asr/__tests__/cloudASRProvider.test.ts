import test from 'node:test';
import assert from 'node:assert/strict';

import { CloudASRProvider } from '../cloudASRProvider';

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
