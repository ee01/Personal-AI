import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { MeetingPilotTierStatus } from '../protocol';

interface TierBadgeProps {
  tier: MeetingPilotTierStatus | undefined;
}

const BADGE_COLORS: Record<MeetingPilotTierStatus['badge'], string> = {
  Probing: '#9ca3af',
  'On-Device': '#16a34a',
  'Local Whisper': '#2563eb',
  Cloud: '#7c3aed',
  'No ASR': '#dc2626',
};

const BADGE_LABELS: Record<MeetingPilotTierStatus['badge'], string> = {
  Probing: 'Probing...',
  'On-Device': 'On-Device',
  'Local Whisper': 'Local Whisper',
  Cloud: 'Cloud',
  'No ASR': 'No Transcription',
};

export function TierBadge({ tier }: TierBadgeProps): React.ReactElement | null {
  const badge = tier?.badge ?? 'Probing';
  const color = BADGE_COLORS[badge];
  const label = BADGE_LABELS[badge];
  const [showToast, setShowToast] = useState(false);
  const seenTransitions = useRef(new Set<string>());
  const prevBadge = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!tier?.lastTransitionReason?.includes('fallback')) return;
    if (!prevBadge.current) {
      prevBadge.current = badge;
      return;
    }
    const key = `${prevBadge.current}->${badge}`;
    if (!seenTransitions.current.has(key)) {
      seenTransitions.current.add(key);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    }
    prevBadge.current = badge;
  }, [badge, tier?.lastTransitionReason]);

  const tooltipText = tier
    ? `Mode: ${tier.mode}${tier.lastTransitionReason ? ` | ${tier.lastTransitionReason}` : ''}`
    : 'Transcription mode unknown';

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span
        title={tooltipText}
        aria-label={`Transcription: ${label}`}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          backgroundColor: color,
          animation: badge === 'Probing' ? 'pulse 1.5s infinite' : undefined,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
      {showToast && (
        <span
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            backgroundColor: 'rgba(0,0,0,0.75)',
            color: '#fff',
            whiteSpace: 'nowrap',
            zIndex: 9999,
          }}
        >
          Switched to {label}
        </span>
      )}
    </span>
  );
}
