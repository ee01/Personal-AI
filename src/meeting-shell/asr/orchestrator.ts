import type {
  ASRProvider,
  ASRTranscriptEvent,
  ASRErrorEvent,
  MeetingPilotASRTier,
} from './types.js';
import type {
  MeetingPilotASRProbeState,
  MeetingPilotASRProbeTrailItem,
  MeetingPilotTierStatus,
} from '../protocol.js';
import { isValidTierTransition } from '../protocol.js';

type TranscriptionMode = 'auto' | 'local-only' | 'cloud-only';

const LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS = 12_000;
const MAX_PROBE_TRAIL_ITEMS = 8;

function formatFirstTranscriptWatchdogDetail(timeoutMs: number): string {
  return (
    `Chrome On-Device waiting for first transcript; fallback watchdog ${timeoutMs / 1000}s. ` +
    'Chrome may not be consuming the extension/offscreen custom audio track.'
  );
}

interface OrchestratorOptions {
  providers: ASRProvider[];
  mode: TranscriptionMode;
  onTierStatus: (status: MeetingPilotTierStatus) => void;
  onTranscript: (event: ASRTranscriptEvent) => void;
  onCaptureLog: (level: 'info' | 'error', msg: string) => void;
}

const TIER_BADGE_MAP: Record<
  MeetingPilotASRTier,
  MeetingPilotTierStatus['badge']
> = {
  ringcentral_transcript: 'RC Transcript',
  web_speech: 'On-Device',
  desktop_whisper: 'Local ASR',
  cloud: 'Cloud',
};

function tierAllowedByMode(
  tier: MeetingPilotASRTier,
  mode: TranscriptionMode,
): boolean {
  if (mode === 'cloud-only') return tier === 'cloud';
  if (mode === 'local-only') return tier !== 'cloud';
  return true;
}

export class ASROrchestrator {
  private providers: ASRProvider[];
  private mode: TranscriptionMode;
  private onTierStatus: (status: MeetingPilotTierStatus) => void;
  private onTranscript: (event: ASRTranscriptEvent) => void;
  private onCaptureLog: (level: 'info' | 'error', msg: string) => void;

  private activeProvider: ASRProvider | undefined;
  private activeAudio: MediaStreamTrack | MediaStream | undefined;
  private currentBadge: MeetingPilotTierStatus['badge'] = 'Probing';
  private stopped = false;
  private unsubscribers: Array<() => void> = [];
  private demoting = false;
  private firstTranscriptTimer: ReturnType<typeof setTimeout> | undefined;
  private activeProviderHasTranscript = false;
  private demotionReason: string | undefined;
  private probeTrail: MeetingPilotASRProbeTrailItem[] = [];

  constructor(opts: OrchestratorOptions) {
    this.providers = opts.providers;
    this.mode = opts.mode;
    this.onTierStatus = opts.onTierStatus;
    this.onTranscript = opts.onTranscript;
    this.onCaptureLog = opts.onCaptureLog;
  }

  async start(audio: MediaStreamTrack | MediaStream): Promise<void> {
    this.stopped = false;
    this.activeAudio = audio;
    this.currentBadge = 'Probing';
    this.demotionReason = undefined;
    this.probeTrail = [];
    this._emitTierStatus(null, 'Probing');

    const eligibleProviders = this.providers.filter((p) =>
      tierAllowedByMode(p.tier, this.mode),
    );

    const unavailableReasons: string[] = [];
    for (const provider of eligibleProviders) {
      const avail = await provider.isAvailable();
      if (avail.ok) {
        await this._activateProvider(provider, audio);
        return;
      }
      this._appendProbeTrail(
        provider.tier,
        'unavailable',
        avail.reason || 'unknown',
      );
      unavailableReasons.push(
        `${provider.tier}: ${avail.reason || 'unknown'}`,
      );
      this.onCaptureLog(
        'info',
        `ASR tier ${provider.tier} unavailable: ${avail.reason || 'unknown'}`,
      );
    }

    this.currentBadge = 'No ASR';
    this._emitTierStatus(
      null,
      'No ASR',
      unavailableReasons.length
        ? `All ASR tiers unavailable (${unavailableReasons.join('; ')})`
        : 'No ASR tier is allowed by the current mode',
    );
    this.onCaptureLog('error', 'ASR: all tiers unavailable, no transcription');
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.demoting = false;
    this._clearFirstTranscriptTimer();
    this._clearSubscriptions();
    if (this.activeProvider) {
      await this.activeProvider.stop();
      this.activeProvider = undefined;
    }
    this.activeAudio = undefined;
  }

  private async _activateProvider(
    provider: ASRProvider,
    audio: MediaStreamTrack | MediaStream,
    transitionReason?: string,
  ): Promise<void> {
    this.activeProvider = provider;
    this.activeProviderHasTranscript = false;
    const badge = TIER_BADGE_MAP[provider.tier];

    const unsubTranscript = provider.on('transcript', (e) => {
      this.activeProviderHasTranscript = true;
      this._clearFirstTranscriptTimer();
      this.onTranscript(e);
    });
    const unsubStatus = provider.on('status', (e) => {
      this.onCaptureLog(
        'info',
        `ASR tier ${e.tier} status: ${e.state}${e.detail ? ` (${e.detail})` : ''}`,
      );
      if (
        e.detail &&
        e.state === 'running' &&
        this.activeProvider === provider
      ) {
        this._emitTierStatus(
          provider.tier,
          badge,
          transitionReason || `ASR tier ${provider.tier} activated`,
          e.detail,
        );
      }
    });

    const unsubError = provider.on('error', (e: ASRErrorEvent) => {
      if (e.fatal && !this.stopped) {
        this.demotionReason = `ASR tier ${e.tier} fatal error: ${e.message}`;
        this._appendProbeTrail(e.tier, 'fatal_error', e.message);
        this.onCaptureLog(
          'error',
          this.demotionReason,
        );
        void this._demoteTier();
      }
    });

    this.unsubscribers.push(unsubTranscript, unsubStatus, unsubError);

    const newBadge = badge;
    if (isValidTierTransition(this.currentBadge, newBadge)) {
      this.currentBadge = newBadge;
    } else {
      this.currentBadge = newBadge;
    }
    this._appendProbeTrail(provider.tier, 'selected');
    this._emitTierStatus(
      provider.tier,
      newBadge,
      transitionReason || `ASR tier ${provider.tier} activated`,
    );

    try {
      await provider.start(audio);
    } catch (error) {
      this.demotionReason = `ASR tier ${provider.tier} start failed: ${String(
        (error as Error)?.message || error,
      )}`;
      this._appendProbeTrail(
        provider.tier,
        'start_failed',
        String((error as Error)?.message || error),
      );
      this.onCaptureLog(
        'error',
        this.demotionReason,
      );
      await this._demoteTier();
      return;
    }
    if (this.stopped || this.activeProvider !== provider) return;
    this._appendProbeTrail(provider.tier, 'running');
    this.onCaptureLog('info', `ASR tier ${provider.tier} activated`);
    this._armFirstTranscriptWatchdog(provider, transitionReason);
  }

  private async _demoteTier(): Promise<void> {
    if (this.stopped || !this.activeAudio || this.demoting) return;
    this.demoting = true;

    const currentProvider = this.activeProvider;
    this.activeProvider = undefined;
    this._clearFirstTranscriptTimer();
    this._clearSubscriptions();

    if (currentProvider) {
      await currentProvider.stop();
    }

    const currentTierIndex = this.providers.findIndex(
      (p) => p === currentProvider,
    );
    const eligibleProviders = this.providers
      .slice(currentTierIndex + 1)
      .filter((p) => tierAllowedByMode(p.tier, this.mode));

    const unavailableReasons: string[] = [];
    for (const provider of eligibleProviders) {
      const avail = await provider.isAvailable();
      if (avail.ok) {
        this.demoting = false;
        const fallbackReason = this.demotionReason
          ? `${this.demotionReason}. ASR fallback activated: ${provider.tier}`
          : `ASR fallback activated: ${provider.tier}`;
        await this._activateProvider(
          provider,
          this.activeAudio,
          fallbackReason,
        );
        return;
      }
      this._appendProbeTrail(
        provider.tier,
        'unavailable',
        avail.reason || 'unknown',
      );
      unavailableReasons.push(
        `${provider.tier}: ${avail.reason || 'unknown'}`,
      );
      this.onCaptureLog(
        'info',
        `ASR fallback: tier ${provider.tier} unavailable: ${avail.reason || 'unknown'}`,
      );
    }

    this.currentBadge = 'No ASR';
    const reasonPrefix = this.demotionReason
      ? `${this.demotionReason}. `
      : '';
    this._emitTierStatus(
      null,
      'No ASR',
      unavailableReasons.length
        ? `${reasonPrefix}All ASR fallback tiers unavailable (${unavailableReasons.join('; ')})`
        : `${reasonPrefix}No ASR fallback tier is allowed by the current mode`,
    );
    this.onCaptureLog('error', 'ASR: all tiers exhausted after fallback');
    this.demoting = false;
  }

  private _clearSubscriptions(): void {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
  }

  private _armFirstTranscriptWatchdog(
    provider: ASRProvider,
    transitionReason?: string,
  ): void {
    this._clearFirstTranscriptTimer();
    if (provider.tier !== 'web_speech') return;
    this._emitTierStatus(
      provider.tier,
      TIER_BADGE_MAP[provider.tier],
      transitionReason || `ASR tier ${provider.tier} activated`,
      formatFirstTranscriptWatchdogDetail(LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS),
    );
    this.firstTranscriptTimer = setTimeout(() => {
      this.firstTranscriptTimer = undefined;
      if (
        this.stopped ||
        this.activeProvider !== provider ||
        this.activeProviderHasTranscript
      ) {
        return;
      }
      this.onCaptureLog(
        'info',
        `ASR tier ${provider.tier} produced no transcript within ${LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS / 1000}s; trying fallback`,
      );
      this.demotionReason =
        `Chrome On-Device started but produced no transcript within ${LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS / 1000}s. Chrome may not be consuming the extension/offscreen custom audio track.`;
      this._appendProbeTrail(
        provider.tier,
        'watchdog_timeout',
        `no transcript within ${LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS / 1000}s`,
      );
      void this._demoteTier();
    }, LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS);
  }

  private _clearFirstTranscriptTimer(): void {
    if (!this.firstTranscriptTimer) return;
    clearTimeout(this.firstTranscriptTimer);
    this.firstTranscriptTimer = undefined;
  }

  private _emitTierStatus(
    activeTier: MeetingPilotASRTier | null,
    badge: MeetingPilotTierStatus['badge'],
    reason?: string,
    statusDetail?: string,
  ): void {
    this.onTierStatus({
      activeTier,
      badge,
      mode: this.mode,
      lastTransitionAt: Date.now(),
      lastTransitionReason: reason,
      lastStatusDetail: statusDetail,
      probeTrail: this.probeTrail.slice(-MAX_PROBE_TRAIL_ITEMS),
    });
  }

  private _appendProbeTrail(
    tier: MeetingPilotASRTier,
    state: MeetingPilotASRProbeState,
    reason?: string,
  ): void {
    const last = this.probeTrail[this.probeTrail.length - 1];
    if (
      last &&
      last.tier === tier &&
      last.state === state &&
      last.reason === reason
    ) {
      return;
    }
    this.probeTrail.push({
      tier,
      state,
      reason,
      ts: Date.now(),
    });
    if (this.probeTrail.length > MAX_PROBE_TRAIL_ITEMS) {
      this.probeTrail = this.probeTrail.slice(-MAX_PROBE_TRAIL_ITEMS);
    }
  }
}
