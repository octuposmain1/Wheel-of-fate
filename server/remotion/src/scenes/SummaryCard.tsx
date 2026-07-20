import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { RarityBadge } from '../components/RarityBadge';
import { COLORS, FONT_BODY, FONT_DISPLAY } from '../theme';
import type { RevealTrait } from '../CharacterReveal';

export const SummaryCard: React.FC<{
  characterName: string;
  traits: RevealTrait[];
  backstory: string | null;
}> = ({ characterName, traits, backstory }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const rise = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${rise}px)`,
          width: '100%',
          maxWidth: 820,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 36,
            color: COLORS.gold,
            letterSpacing: 3,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          🏆 CHARACTER COMPLETE
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 64,
            fontWeight: 900,
            color: 'white',
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          {characterName}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 40,
          }}
        >
          {traits.map((t, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 28px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 16,
                borderLeft: `6px solid ${t.color}`,
              }}
            >
              <span style={{ fontFamily: FONT_BODY, fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>
                {t.wheelIcon} {t.wheelName}
              </span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: 'white' }}>
                {t.label}
              </span>
              <RarityBadge label={t.rarityLabel} color={t.color} />
            </div>
          ))}
        </div>

        {backstory && (
          <div
            style={{
              padding: 32,
              background: 'rgba(191,0,255,0.08)',
              border: '1px solid rgba(191,0,255,0.25)',
              borderRadius: 20,
            }}
          >
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 18,
                color: COLORS.purple,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              AI Backstory
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 26,
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.5,
              }}
            >
              "{backstory}"
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
