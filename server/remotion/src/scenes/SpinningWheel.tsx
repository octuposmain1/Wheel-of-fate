import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { COLORS, FONT_BODY, SPIN_HOLD_FRAMES, WHOOSH_FILE, tickFreqFile } from '../theme';

type Segment = { label: string; color: string; weight: number; dramatic: boolean };

// Same fixed palette as the live canvas wheel (spinWheel.js's NEON_PALETTES[0]
// — confirmed paletteIndex is never changed from 0 anywhere in that file, so
// this is always the one actually shown). Ordinary segments use this neon
// palette; only dramatic (rare) segments use the tier's real color.
const NEON_PALETTE = ['#00f5ff', '#bf00ff', '#00c4cc', '#8800cc', '#00e5ee', '#9900dd'];

function adjustAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Standard math convention (angle 0 = right/3 o'clock, increasing clockwise
// in a y-down coordinate space) — matches spinWheel.js's canvas drawing and
// the .wheel-pointer position in main.css (right edge, not top).
function wedgePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export const SpinningWheel: React.FC<{
  wheelName: string;
  wheelIcon: string;
  segments: Segment[];
  winnerIndex: number;
  durationInFrames: number;
}> = ({ wheelName, wheelIcon, segments, winnerIndex, durationInFrames }) => {
  const frame = useCurrentFrame();
  const size = 700;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 20;

  const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0) || 1;
  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const arc = (seg.weight / totalWeight) * Math.PI * 2;
    const start = cumulative;
    cumulative += arc;
    return { ...seg, start, end: start + arc, mid: start + arc / 2 };
  });

  const safeWinnerIndex = winnerIndex >= 0 && winnerIndex < arcs.length ? winnerIndex : 0;
  const winnerMidAngle = arcs[safeWinnerIndex]?.mid ?? 0;

  // Same convention as the live spin: several full rotations, then land the
  // winner's midpoint at the pointer (canvas/SVG angle 0 — the right edge).
  const fullSpins = 6 * Math.PI * 2;
  const targetRotation = fullSpins - winnerMidAngle;

  // The animation itself finishes SPIN_HOLD_FRAMES early; interpolate's
  // extrapolateRight:'clamp' then holds progress at 1 (fully landed) for
  // the remainder of the Sequence, giving a visible pause before the cut
  // to the reveal card.
  const animFrames = Math.max(1, durationInFrames - SPIN_HOLD_FRAMES);
  const progress = interpolate(frame, [0, animFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rotationRad = targetRotation * progress;
  const rotationDeg = (rotationRad * 180) / Math.PI;

  // Tick sounds: same trigger rule as the live wheel (spinWheel.js) — fire
  // roughly once per average-segment's-worth of eased rotation, pitched by
  // (1 - linearProgress) so ticks start fast and slow down as the wheel
  // decelerates, mirroring playTick(angularVelocity / 15) there exactly.
  const avgSegmentAngle = (Math.PI * 2) / Math.max(1, arcs.length);
  const ticks: { frame: number; freq: number }[] = [];
  let lastTickRotation = 0;
  for (let f = 0; f <= animFrames; f++) {
    const linearProgress = f / animFrames;
    const eased = 1 - Math.pow(1 - linearProgress, 3);
    const rot = targetRotation * eased;
    if (rot - lastTickRotation >= avgSegmentAngle * 0.9) {
      const velocityNorm = 1 - linearProgress;
      ticks.push({ frame: f, freq: Math.min(1200, 200 + velocityNorm * 400) });
      lastTickRotation = rot;
    }
  }

  return (
    <AbsoluteFill style={{ background: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' }}>
      <Audio src={staticFile(WHOOSH_FILE)} />
      {ticks.map((tk, i) => (
        <Sequence key={i} from={tk.frame} durationInFrames={4} layout="none">
          <Audio src={staticFile(tickFreqFile(tk.freq))} />
        </Sequence>
      ))}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 28,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          {wheelIcon} {wheelName}
        </div>
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg
            width={size}
            height={size}
            style={{
              transform: `rotate(${rotationDeg}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          >
            <defs>
              {/* Radial gradient per segment, matching spinWheel.js's
                  _drawWheel gradient stops exactly (0.7/0.5/0.8 alpha). */}
              {arcs.map((a, i) => {
                const fillColor = a.dramatic ? a.color : NEON_PALETTE[i % NEON_PALETTE.length];
                return (
                  <radialGradient key={i} id={`wheel-grad-${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={adjustAlpha(fillColor, 0.7)} />
                    <stop offset="60%" stopColor={adjustAlpha(fillColor, 0.5)} />
                    <stop offset="100%" stopColor={adjustAlpha(fillColor, 0.8)} />
                  </radialGradient>
                );
              })}
            </defs>

            {arcs.map((a, i) => (
              <path
                key={i}
                d={wedgePath(cx, cy, radius, a.start, a.end)}
                fill={`url(#wheel-grad-${i})`}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={2}
              />
            ))}

            {/* Extra glow outline on dramatic (rare) segments, matching the
                canvas wheel's second stroke pass. */}
            {arcs.map((a, i) =>
              a.dramatic ? (
                <path
                  key={i}
                  d={wedgePath(cx, cy, radius, a.start, a.end)}
                  fill="none"
                  stroke={adjustAlpha(a.color, 0.6)}
                  strokeWidth={1.5}
                />
              ) : null
            )}

            {/* Segment labels — same radius/rotation convention as the live
                canvas wheel (spinWheel.js), so text reads radially and spins
                with the wedges since it lives in the same rotated <svg>. */}
            {arcs.map((a, i) => {
              // Normalize angle to determine if we are on left/right half
              let normAngle = a.mid % (Math.PI * 2);
              if (normAngle > Math.PI) normAngle -= Math.PI * 2;
              if (normAngle < -Math.PI) normAngle += Math.PI * 2;
              const isLeftHalf = Math.abs(normAngle) > Math.PI / 2;

              // For left half, rotate by an additional 180 degrees so the text is upright
              const rotationRad = isLeftHalf ? a.mid + Math.PI : a.mid;
              const rotationDeg = (rotationRad * 180) / Math.PI;

              const startX = radius * 0.28;
              const endX = radius * 0.88;
              const maxWidth = endX - startX;

              const sizeFraction = (a.end - a.start) / (Math.PI * 2);
              const fontSize = Math.max(11, Math.min(14, size * sizeFraction * 1.2));

              // Compute maximum characters based on maxWidth and estimate of char width
              const charWidthEst = fontSize * 0.6;
              const maxChars = Math.max(3, Math.floor(maxWidth / charWidthEst));
              const label = a.label.length > maxChars ? `${a.label.slice(0, maxChars - 1)}…` : a.label;

              const textWidth = label.length * fontSize * 0.62;
              const pillW = textWidth + 12;
              const pillH = fontSize + 6;

              const textX = isLeftHalf ? -startX : startX;
              const textAnchor = isLeftHalf ? 'end' : 'start';
              const pillX = isLeftHalf ? -startX - textWidth - 6 : startX - 6;

              return (
                <g key={i} transform={`rotate(${rotationDeg} ${cx} ${cy})`}>
                  <rect
                    x={cx + pillX}
                    y={cy - pillH / 2}
                    width={pillW}
                    height={pillH}
                    rx={pillH / 2}
                    fill="rgba(10,10,15,0.75)"
                  />
                  <text
                    x={cx + textX}
                    y={cy}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    fontFamily={FONT_BODY}
                    fontWeight={700}
                    fontSize={fontSize}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Outer ring glow, matching the canvas wheel's cyan ring. */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="rgba(0,245,255,0.5)"
              strokeWidth={3}
              style={{ filter: 'drop-shadow(0 0 12px #00f5ff)' }}
            />
          </svg>
          {/* Pointer fixed at the right edge — matches .wheel-pointer in main.css */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: -24,
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '24px solid transparent',
              borderBottom: '24px solid transparent',
              borderRight: `40px solid ${COLORS.cyan}`,
              filter: `drop-shadow(0 0 12px ${COLORS.cyan})`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
