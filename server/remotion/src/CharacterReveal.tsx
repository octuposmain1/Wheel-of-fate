import { loadFont as loadOrbitron } from '@remotion/google-fonts/Orbitron';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { SpinningWheel } from './scenes/SpinningWheel';
import { SummaryCard } from './scenes/SummaryCard';
import { TraitReveal } from './scenes/TraitReveal';
import {
  COLORS,
  FONT_DISPLAY,
  INTRO_FRAMES,
  OUTRO_FRAMES,
  SPIN_FRAMES,
  SUMMARY_FRAMES,
  traitFramesForIntensity,
} from './theme';

loadOrbitron();
loadInter();

export type RevealTrait = {
  wheelName: string;
  wheelIcon: string;
  label: string;
  color: string;
  rarityLabel: string;
  intensity: number; // 0 (most common) - 1 (rarest), computed by the frontend from live tier weights
  segments: { label: string; color: string; weight: number; dramatic: boolean }[]; // full wheel, for the spin animation
  winnerIndex: number;
};

export type CharacterRevealProps = {
  characterName: string;
  traits: RevealTrait[];
  backstory: string | null;
};

const IntroCard: React.FC<{ characterName: string }> = ({ characterName }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15, INTRO_FRAMES - 10, INTRO_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgPrimary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>🎡</div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 40,
            letterSpacing: 4,
            color: COLORS.cyan,
            marginBottom: 12,
          }}
        >
          WHEEL OF FATE
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, fontWeight: 900, color: 'white' }}>
          {characterName}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CharacterReveal: React.FC<CharacterRevealProps> = ({
  characterName,
  traits,
  backstory,
}) => {
  let cursor = 0;
  const introFrom = cursor;
  cursor += INTRO_FRAMES;

  const traitSequences = traits.map((t) => {
    const spinFrom = cursor;
    cursor += SPIN_FRAMES;
    const revealFrom = cursor;
    const revealDuration = traitFramesForIntensity(t.intensity);
    cursor += revealDuration;
    return { ...t, spinFrom, revealFrom, revealDuration };
  });

  const summaryFrom = cursor;
  cursor += SUMMARY_FRAMES;
  cursor += OUTRO_FRAMES; // outro simply holds the last frame of SummaryCard

  return (
    <AbsoluteFill style={{ background: COLORS.bgPrimary }}>
      <Sequence from={introFrom} durationInFrames={INTRO_FRAMES}>
        <IntroCard characterName={characterName} />
      </Sequence>

      {traitSequences.map((t, i) => (
        <React.Fragment key={i}>
          <Sequence from={t.spinFrom} durationInFrames={SPIN_FRAMES}>
            <SpinningWheel
              wheelName={t.wheelName}
              wheelIcon={t.wheelIcon}
              segments={t.segments}
              winnerIndex={t.winnerIndex}
              durationInFrames={SPIN_FRAMES}
            />
          </Sequence>
          <Sequence from={t.revealFrom} durationInFrames={t.revealDuration}>
            <TraitReveal
              wheelName={t.wheelName}
              wheelIcon={t.wheelIcon}
              label={t.label}
              color={t.color}
              intensity={t.intensity}
              rarityLabel={t.rarityLabel}
              durationInFrames={t.revealDuration}
            />
          </Sequence>
        </React.Fragment>
      ))}

      <Sequence from={summaryFrom} durationInFrames={SUMMARY_FRAMES + OUTRO_FRAMES}>
        <SummaryCard characterName={characterName} traits={traits} backstory={backstory} />
      </Sequence>
    </AbsoluteFill>
  );
};
