import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { GlowCard } from '../components/GlowCard';
import { RarityBadge } from '../components/RarityBadge';
import { COLORS, FONT_BODY, FONT_DISPLAY, lockIntensityFile } from '../theme';

export const TraitReveal: React.FC<{
  wheelName: string;
  wheelIcon: string;
  label: string;
  color: string;
  intensity: number; // 0 (most common) - 1 (rarest)
  rarityLabel: string;
  durationInFrames: number;
}> = ({ wheelName, wheelIcon, label, color, intensity, rarityLabel, durationInFrames }) => {
  const frame = useCurrentFrame();

  const entrance = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const exit = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = Math.min(entrance, exit);
  const scale = 0.85 + entrance * 0.15;

  // Mirrors the frontend's isDramaticTier threshold (rarest third of tiers)
  const isDramatic = intensity >= 0.66;
  const pulse = isDramatic ? 0.6 + 0.4 * Math.abs(Math.sin(frame / 6)) : 1;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgPrimary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Audio src={staticFile(lockIntensityFile(intensity))} />

      {isDramatic && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle, ${color}${Math.round(
              pulse * 60
            )
              .toString(16)
              .padStart(2, '0')} 0%, transparent 70%)`,
          }}
        />
      )}

      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 24 }}>{wheelIcon}</div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 28,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          {wheelName}
        </div>
        <GlowCard glowColor={color} style={{ padding: '32px 56px' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, fontWeight: 900, marginBottom: 20 }}>
            {label}
          </div>
          <RarityBadge label={rarityLabel} color={color} scale={1.2} />
        </GlowCard>
      </div>
    </AbsoluteFill>
  );
};
