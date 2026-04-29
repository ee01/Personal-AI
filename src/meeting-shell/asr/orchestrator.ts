import type {
  ASRProvider,
  ASRTranscriptEvent,
  ASRErrorEvent,
  MeetingPilotASRTier,
} from './types';
import type { MeetingPilotTierStatus } from '../protocol';
import { isValidTierTransition } from '../protocol';

type TranscriptionMode = 'auto' | 'local-only' | 'cloud-only';

const LOCAL_FIRST_TRANSCRIPT_TIMEOUT_MS = 12_000;

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
  web_speech: 'On-Device',
  desktop_whisper: 'Local Whisper',
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
        `ASR tier ${e.tier} status: ${e.state}`,
      );
    });

    const unsubError = provider.on('error', (e: ASRErrorEvent) => {
      if (e.fatal && !this.stopped) {
        this.demotionReason = `ASR tier ${e.tier} fatal error: ${e.message}`;
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
    this._emitTierStatus(
      provider.tier,
      newBadge,
      `ASR tier ${provider.tier} activated`,
    );

    try {
      await provider.start(audio);
    } catch (error) {
      this.demotionReason = `ASR tier ${provider.tier} start failed: ${String(
        (error as Error)?.message || error,
      )}`;
      this.onCaptureLog(
        'error',
        this.demotionReason,
      );
      await this._demoteTier();
      return;
    }
    if (this.stopped || this.activeProvider !== provider) return;
    this.onCaptureLog('info', `ASR tier ${provider.tier} activated`);
    this._armFirstTranscriptWatchdog(provider);
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
        await this._activateProvider(provider, this.activeAudio);
        return;
      }
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

  private _armFirstTranscriptWatchdog(provider: ASRProvider): void {
    this._clearFirstTranscriptTimer();
    if (provider.tier !== 'web_speech') return;
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
  ): void {
    this.onTierStatus({
      activeTier,
      badge,
      mode: this.mode,
      lastTransitionAt: Date.now(),
      lastTransitionReason: reason,
    });
  }
}
