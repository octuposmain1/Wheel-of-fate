// ============================================================
// toneSynth.js — Server-side WAV synthesis for the export video
// ============================================================
//
// Mirrors src/utils/audio.js's Web Audio API sound design (playWhoosh,
// playTick, playLock) as plain PCM16 WAV buffers, since oscillators don't
// exist in Node. A fixed bank of files is pre-generated once (idempotent —
// skipped if already on disk) covering the full range of pitches/intensities
// the frontend's formulas can produce, so the Remotion scenes can reference
// a bucketed filename directly instead of the render pipeline needing to
// know in advance exactly which sounds a given render will use.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', 'remotion', 'public', 'audio', 'generated');
const SAMPLE_RATE = 44100;

// Matches playTick's `200 + angularVelocity * 400`, clamped to 1200.
export const TICK_FREQ_MIN = 200;
export const TICK_FREQ_MAX = 1200;
export const TICK_FREQ_STEP = 20;

// Matches getTierIntensity()'s [0, 1] range.
export const LOCK_INTENSITY_STEP = 0.05;

function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

/** Filtered noise sweep (1000Hz -> 100Hz one-pole lowpass) — mirrors playWhoosh. */
function synthWhoosh(durationSec = 0.15) {
  const n = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    const fc = 1000 + (100 - 1000) * (t / durationSec);
    const alpha = 1 - Math.exp((-2 * Math.PI * fc) / SAMPLE_RATE);
    lp += alpha * (noise - lp);
    const gain = 0.2 * Math.pow(0.001 / 0.2, t / durationSec);
    samples[i] = lp * gain;
  }
  return samples;
}

/** Short square-wave click — mirrors playTick. */
function synthTick(freq, durationSec = 0.04) {
  const n = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const square = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
    const gain = 0.08 * Math.pow(0.001 / 0.08, t / durationSec);
    samples[i] = square * gain;
  }
  return samples;
}

/** Sine tone + optional harmonic overtone + optional sub-boom — mirrors playLock. */
function synthLock(intensity) {
  const freq = 220 + (660 - 220) * intensity;
  const duration = 0.4 + intensity * 1.6;
  const volume = 0.3 + intensity * 0.4;
  const dramatic = intensity >= 0.66;
  const veryRare = intensity >= 0.9;

  const totalDuration = Math.max(duration, veryRare ? 1.5 : 0);
  const n = Math.ceil(totalDuration * SAMPLE_RATE);
  const samples = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    if (t <= duration) {
      s += Math.sin(2 * Math.PI * freq * t) * volume * Math.pow(0.001 / volume, t / duration);
    }
    if (dramatic) {
      const d2 = duration * 0.7;
      if (t <= d2) {
        const v2 = volume * 0.4;
        s += Math.sin(2 * Math.PI * freq * 2 * t) * v2 * Math.pow(0.001 / v2, t / d2);
      }
    }
    if (veryRare) {
      const d3 = 1.5;
      if (t <= d3) {
        s += Math.sin(2 * Math.PI * 55 * t) * 0.6 * Math.pow(0.001 / 0.6, t / d3);
      }
    }
    samples[i] = s;
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak > 1) {
    for (let i = 0; i < n; i++) samples[i] /= peak;
  }
  return samples;
}

export function tickFreqFile(freq) {
  const bucket = Math.min(TICK_FREQ_MAX, Math.max(TICK_FREQ_MIN, Math.round(freq / TICK_FREQ_STEP) * TICK_FREQ_STEP));
  return `audio/generated/tick-${bucket}.wav`;
}

export function lockIntensityFile(intensity) {
  const bucket = Math.min(1, Math.max(0, Math.round(intensity / LOCK_INTENSITY_STEP) * LOCK_INTENSITY_STEP));
  return `audio/generated/lock-${bucket.toFixed(2)}.wav`;
}

export const WHOOSH_FILE = 'audio/generated/whoosh.wav';

let bankReady = false;

/** Idempotent — pre-generates the full tone bank once, skips existing files. */
export function ensureToneBank() {
  if (bankReady) return;
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const whooshPath = path.join(__dirname, '..', 'remotion', 'public', WHOOSH_FILE);
  if (!fs.existsSync(whooshPath)) {
    fs.writeFileSync(whooshPath, encodeWav(synthWhoosh()));
  }

  for (let freq = TICK_FREQ_MIN; freq <= TICK_FREQ_MAX; freq += TICK_FREQ_STEP) {
    const filePath = path.join(__dirname, '..', 'remotion', 'public', tickFreqFile(freq));
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, encodeWav(synthTick(freq)));
    }
  }

  // Integer step count instead of accumulating by += LOCK_INTENSITY_STEP —
  // floating point drift on repeated addition (e.g. 0.05 twenty times can
  // land on 1.0000000000000002) was skipping the final 1.00 bucket.
  const steps = Math.round(1 / LOCK_INTENSITY_STEP);
  for (let i = 0; i <= steps; i++) {
    const rounded = Math.round(i * LOCK_INTENSITY_STEP * 100) / 100;
    const filePath = path.join(__dirname, '..', 'remotion', 'public', lockIntensityFile(rounded));
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, encodeWav(synthLock(rounded)));
    }
  }

  bankReady = true;
}
