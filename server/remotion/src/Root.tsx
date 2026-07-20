import { Composition } from 'remotion';
import { CharacterReveal, CharacterRevealProps } from './CharacterReveal';
import { FPS, HEIGHT, INTRO_FRAMES, OUTRO_FRAMES, SPIN_FRAMES, SUMMARY_FRAMES, WIDTH, traitFramesForIntensity } from './theme';

const defaultProps: CharacterRevealProps = {
  characterName: 'Vex Nightshade',
  traits: [
    {
      wheelName: 'Race',
      wheelIcon: '🧬',
      label: 'Dragonborn',
      color: '#00b4ff',
      rarityLabel: 'Rare',
      intensity: 0.33,
      segments: [
        { label: 'Human', color: '#8a9ba8', weight: 60, dramatic: false },
        { label: 'Dragonborn', color: '#00b4ff', weight: 30, dramatic: false },
        { label: 'Void Walker', color: '#ff3366', weight: 1, dramatic: true },
      ],
      winnerIndex: 1,
    },
    {
      wheelName: 'Special Power',
      wheelIcon: '⚡',
      label: 'Godkiller Strike',
      color: '#ff3366',
      rarityLabel: 'Mythic',
      intensity: 1,
      segments: [
        { label: 'Enhanced Strength', color: '#8a9ba8', weight: 60, dramatic: false },
        { label: 'Elemental Mastery', color: '#ffd700', weight: 9, dramatic: true },
        { label: 'Godkiller Strike', color: '#ff3366', weight: 1, dramatic: true },
      ],
      winnerIndex: 2,
    },
  ],
  backstory: 'Born under a collapsing star, they wielded fate itself like a blade.',
};

function totalDurationFor(props: CharacterRevealProps): number {
  const traitFrames = props.traits.reduce(
    (sum, t) => sum + SPIN_FRAMES + traitFramesForIntensity(t.intensity),
    0
  );
  return INTRO_FRAMES + traitFrames + SUMMARY_FRAMES + OUTRO_FRAMES;
}

export const Root: React.FC = () => {
  return (
    <Composition
      id="CharacterReveal"
      component={CharacterReveal}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={totalDurationFor(defaultProps)}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        return { durationInFrames: totalDurationFor(props) };
      }}
    />
  );
};
