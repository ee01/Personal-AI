import test from 'node:test';
import assert from 'node:assert/strict';
import { ASROrchestrator } from '../orchestrator.js';
import type {
  ASRProvider,
  ASRTranscriptEvent,
  ASREventMap,
  MeetingPilotASRTier,
} from '../types.js';
import { createASREventEmitter } from '../types.js';
import type { MeetingPilotTierStatus } from '../../protocol.js';

function makeFakeProvider(
  tier: MeetingPilotASRTier,
  available = true,
  stopDelayMs = 0,
  statusDetail?: string,
): ASRProvider & {
  emitter: ReturnType<typeof createASREventEmitter>;
  startCalled: number;
  stopCalled: number;
} {
  const emitter = createASREventEmitter();
  let startCalled = 0;
  let stopCalled = 0;

  return {
    tier,
    emitter,
    get startCalled() {
      return startCalled;
    },
    get stopCalled() {
      return stopCalled;
    },
    async isAvailable() {
      return available
        ? { ok: true }
        : { ok: false, reason: 'test_unavailable' };
    },
    async start() {
      startCalled++;
      emitter.emit('status', {
        tier,
        state: 'running',
        ts: Date.now(),
        detail: statusDetail,
      });
    },
    async stop() {
      stopCalled++;
      if (stopDelayMs > 0) {
        await new Promise((r) => setTimeout(r, stopDelayMs));
      }
      emitter.emit('status', { tier, state: 'stopped', ts: Date.now() });
    },
    on<K extends keyof ASREventMap>(
      event: K,
      handler: (e: ASREventMap[K]) => void,
    ) {
      return emitter.on(event, handler);
    },
  };
}

function makeDummyTrack(): MediaStreamTrack {
  return {} as MediaStreamTrack;
}

test('orchestrator: picks first available tier', async () => {
  const p1 = makeFakeProvider('web_speech', true);
  const p2 = makeFakeProvider('desktop_whisper', true);
  const p3 = makeFakeProvider('cloud', true);

  const tierStatuses: MeetingPilotTierStatus[] = [];
  const orch = new ASROrchestrator({
    providers: [p1, p2, p3],
    mode: 'auto',
    onTierStatus: (s) => tierStatuses.push(s),
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  assert.equal(p1.startCalled, 1);
  assert.equal(p2.startCalled, 0);
  assert.equal(p3.startCalled, 0);
  const lastStatus = tierStatuses[tierStatuses.length - 1];
  assert.equal(lastStatus.badge, 'On-Device');
});

test('orchestrator: web speech exposes first transcript watchdog detail', async () => {
  const p1 = makeFakeProvider('web_speech', true);

  const tierStatuses: MeetingPilotTierStatus[] = [];
  const orch = new ASROrchestrator({
    providers: [p1],
    mode: 'auto',
    onTierStatus: (s) => tierStatuses.push(s),
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  const watchdogStatus = tierStatuses.find((status) =>
    /waiting for first transcript/i.test(status.lastStatusDetail || ''),
  );
  assert.ok(
    watchdogStatus,
    'web speech should surface first-transcript watchdog status',
  );
  assert.equal(watchdogStatus?.badge, 'On-Device');
  assert.match(watchdogStatus?.lastStatusDetail || '', /fallback watchdog 12s/);
});

test('orchestrator: skips unavailable tiers and picks next', async () => {
  const p1 = makeFakeProvider('web_speech', false);
  const p2 = makeFakeProvider('desktop_whisper', false);
  const p3 = makeFakeProvider('cloud', true);

  const tierStatuses: MeetingPilotTierStatus[] = [];
  const orch = new ASROrchestrator({
    providers: [p1, p2, p3],
    mode: 'auto',
    onTierStatus: (s) => tierStatuses.push(s),
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  assert.equal(p1.startCalled, 0);
  assert.equal(p2.startCalled, 0);
  assert.equal(p3.startCalled, 1);
  const lastStatus = tierStatuses[tierStatuses.length - 1];
  assert.equal(lastStatus.badge, 'Cloud');
  assert.deepEqual(
    lastStatus.probeTrail?.map((item) => [item.tier, item.state]),
    [
      ['web_speech', 'unavailable'],
      ['desktop_whisper', 'unavailable'],
      ['cloud', 'selected'],
    ],
  );
});

test('orchestrator: all unavailable → No ASR', async () => {
  const p1 = makeFakeProvider('web_speech', false);
  const p2 = makeFakeProvider('cloud', false);

  const tierStatuses: MeetingPilotTierStatus[] = [];
  const orch = new ASROrchestrator({
    providers: [p1, p2],
    mode: 'auto',
    onTierStatus: (s) => tierStatuses.push(s),
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  const lastStatus = tierStatuses[tierStatuses.length - 1];
  assert.equal(lastStatus.badge, 'No ASR');
});

test('orchestrator: fatal error triggers fallback to next tier', async () => {
  const p1 = makeFakeProvider('web_speech', true, 10);
  const p2 = makeFakeProvider(
    'cloud',
    true,
    0,
    'Cloud ASR · POST /v1/chat/completions + input_audio · OpenAI Chat Completions + input_audio · model qwen3-asr-flash · language auto · segment 5s',
  );

  const tierStatuses: MeetingPilotTierStatus[] = [];
  const orch = new ASROrchestrator({
    providers: [p1, p2],
    mode: 'auto',
    onTierStatus: (s) => tierStatuses.push(s),
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());
  assert.equal(p1.startCalled, 1);

  p1.emitter.emit('error', {
    tier: 'web_speech',
    code: 'network',
    message: 'test error',
    ts: Date.now(),
    fatal: true,
  });

  await new Promise((r) => setTimeout(r, 50));

  assert.equal(p1.stopCalled, 1);
  assert.equal(p2.startCalled, 1);
  const lastStatus = tierStatuses[tierStatuses.length - 1];
  assert.equal(lastStatus.badge, 'Cloud');
  assert.match(lastStatus.lastTransitionReason || '', /fallback/);
  assert.match(lastStatus.lastTransitionReason || '', /test error/);
  assert.match(lastStatus.lastStatusDetail || '', /chat\/completions/);
  assert.match(lastStatus.lastStatusDetail || '', /qwen3-asr-flash/);
  assert.deepEqual(
    lastStatus.probeTrail?.map((item) => [item.tier, item.state]),
    [
      ['web_speech', 'selected'],
      ['web_speech', 'running'],
      ['web_speech', 'fatal_error'],
      ['cloud', 'selected'],
    ],
  );
});

test('orchestrator: no-overlap — p2.start called after p1.stop resolves', async () => {
  const p1 = makeFakeProvider('web_speech', true, 100);
  const p2 = makeFakeProvider('cloud', true);

  const timeline: string[] = [];
  const origP1Stop = p1.stop.bind(p1);
  p1.stop = async () => {
    timeline.push('p1.stop.start');
    await origP1Stop();
    timeline.push('p1.stop.end');
  };
  const origP2Start = p2.start.bind(p2);
  p2.start = async (...args: Parameters<typeof origP2Start>) => {
    timeline.push('p2.start');
    return origP2Start(...args);
  };

  const orch = new ASROrchestrator({
    providers: [p1, p2],
    mode: 'auto',
    onTierStatus: () => {},
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  p1.emitter.emit('error', {
    tier: 'web_speech',
    code: 'network',
    message: 'test',
    ts: Date.now(),
    fatal: true,
  });

  await new Promise((r) => setTimeout(r, 200));

  const p1StopEndIdx = timeline.indexOf('p1.stop.end');
  const p2StartIdx = timeline.indexOf('p2.start');
  assert.ok(p1StopEndIdx >= 0, 'p1.stop.end should be in timeline');
  assert.ok(p2StartIdx >= 0, 'p2.start should be in timeline');
  assert.ok(p2StartIdx > p1StopEndIdx, 'p2.start must come after p1.stop.end');
});

test('orchestrator: local-only mode never uses cloud', async () => {
  const p1 = makeFakeProvider('web_speech', false);
  const p2 = makeFakeProvider('desktop_whisper', false);
  const p3 = makeFakeProvider('cloud', true);

  const tierStatuses: MeetingPilotTierStatus[] = [];
  const orch = new ASROrchestrator({
    providers: [p1, p2, p3],
    mode: 'local-only',
    onTierStatus: (s) => tierStatuses.push(s),
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  assert.equal(p3.startCalled, 0);
  const lastStatus = tierStatuses[tierStatuses.length - 1];
  assert.equal(lastStatus.badge, 'No ASR');
  assert.deepEqual(
    lastStatus.probeTrail?.map((item) => [item.tier, item.state]),
    [
      ['web_speech', 'unavailable'],
      ['desktop_whisper', 'unavailable'],
    ],
  );
});

test('orchestrator: cloud-only mode skips local tiers', async () => {
  const p1 = makeFakeProvider('web_speech', true);
  const p2 = makeFakeProvider('desktop_whisper', true);
  const p3 = makeFakeProvider('cloud', true);

  const orch = new ASROrchestrator({
    providers: [p1, p2, p3],
    mode: 'cloud-only',
    onTierStatus: () => {},
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  assert.equal(p1.startCalled, 0);
  assert.equal(p2.startCalled, 0);
  assert.equal(p3.startCalled, 1);
});

test('orchestrator: concurrent fatal errors only trigger one demotion', async () => {
  const p1 = makeFakeProvider('web_speech', true, 50);
  const p2 = makeFakeProvider('cloud', true);

  const orch = new ASROrchestrator({
    providers: [p1, p2],
    mode: 'auto',
    onTierStatus: () => {},
    onTranscript: () => {},
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());
  assert.equal(p1.startCalled, 1);

  p1.emitter.emit('error', {
    tier: 'web_speech',
    code: 'network',
    message: 'err1',
    ts: Date.now(),
    fatal: true,
  });
  p1.emitter.emit('error', {
    tier: 'web_speech',
    code: 'network',
    message: 'err2',
    ts: Date.now(),
    fatal: true,
  });

  await new Promise((r) => setTimeout(r, 200));

  assert.equal(
    p2.startCalled,
    1,
    'p2 should be started exactly once despite two concurrent fatal errors',
  );
});

test('orchestrator: transcript events forwarded to onTranscript', async () => {
  const p1 = makeFakeProvider('cloud', true);
  const transcripts: ASRTranscriptEvent[] = [];

  const orch = new ASROrchestrator({
    providers: [p1],
    mode: 'auto',
    onTierStatus: () => {},
    onTranscript: (e) => transcripts.push(e),
    onCaptureLog: () => {},
  });

  await orch.start(makeDummyTrack());

  p1.emitter.emit('transcript', {
    kind: 'final',
    text: 'hello world',
    tier: 'cloud',
    ts: Date.now(),
  });

  assert.equal(transcripts.length, 1);
  assert.equal(transcripts[0].text, 'hello world');
});
