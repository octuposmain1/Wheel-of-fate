// Rarity tiers are user-editable/addable data now — the frontend computes
// each trait's color and a bounded 0-1 "intensity" at export time and
// sends them directly in the render payload, so this file no longer needs
// its own copy of the tier table (previously a hand-mirrored duplicate
// that had to be kept in sync manually).

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const INTRO_FRAMES = 30;
export const SUMMARY_FRAMES = 150;
export const OUTRO_FRAMES = 30;

// Bounded per-trait duration, mirroring the frontend's getSpinDurationMs
// formula (src/utils/rarity.js) so pacing feels consistent between the
// live spin and the rendered video.
export const MIN_TRAIT_FRAMES = 90;
export const MAX_TRAIT_FRAMES = 210;

export function traitFramesForIntensity(intensity: number): number {
  return Math.round(MIN_TRAIT_FRAMES + (MAX_TRAIT_FRAMES - MIN_TRAIT_FRAMES) * intensity);
}

// Fixed-length spin animation shown before each trait's reveal card.
export const SPIN_FRAMES = 90;

// How many of SPIN_FRAMES are spent sitting still on the landed segment
// before cutting to the reveal card, so there's time to actually read it.
export const SPIN_HOLD_FRAMES = 15;

export const COLORS = {
  bgPrimary: '#06060f',
  bgCard: '#12122a',
  cyan: '#00f5ff',
  purple: '#bf00ff',
  gold: '#ffd700',
};

export const FONT_DISPLAY = 'Orbitron';
export const FONT_BODY = 'Inter';

// ─── Synthesized SFX file lookup ───────────────────────────────
// Mirrors the bucketing in server/services/toneSynth.js exactly (same step
// sizes) — that module pre-generates a WAV file for every bucket into
// remotion/public/audio/generated/ before each render, so these are always
// resolvable via Remotion's staticFile(). Kept in two files because this
// one is bundled into the browser-rendered composition (no Node built-ins
// allowed) while toneSynth.js needs node:fs to actually write the files.
const TICK_FREQ_MIN = 200;
const TICK_FREQ_MAX = 1200;
const TICK_FREQ_STEP = 20;
const LOCK_INTENSITY_STEP = 0.05;

export function tickFreqFile(freq: number): string {
  const bucket = Math.min(
    TICK_FREQ_MAX,
    Math.max(TICK_FREQ_MIN, Math.round(freq / TICK_FREQ_STEP) * TICK_FREQ_STEP)
  );
  return `audio/generated/tick-${bucket}.wav`;
}

export function lockIntensityFile(intensity: number): string {
  const bucket = Math.min(1, Math.max(0, Math.round(intensity / LOCK_INTENSITY_STEP) * LOCK_INTENSITY_STEP));
  return `audio/generated/lock-${bucket.toFixed(2)}.wav`;
}

export const WHOOSH_FILE = 'audio/generated/whoosh.wav';
