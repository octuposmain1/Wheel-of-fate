// ============================================================
// audio.js — Web Audio API Sound Effects
// ============================================================

let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

/** Generate a single tick/click sound at a given frequency */
export function playTick(angularVelocity = 1.0) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.connect(gain);
    gain.connect(ac.destination);

    // Higher angular velocity = higher pitched tick
    const baseFreq = 200 + angularVelocity * 400;
    osc.frequency.setValueAtTime(Math.min(baseFreq, 1200), ac.currentTime);
    osc.type = 'square';

    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.04);
  } catch (e) { /* ignore */ }
}

/** Dramatic "gong" when a trait is locked */
export function playLock(rarity = 'common') {
  try {
    const ac = getCtx();

    const rarityConfig = {
      common:    { freq: 220, duration: 0.4, volume: 0.3 },
      rare:      { freq: 330, duration: 0.6, volume: 0.4 },
      legendary: { freq: 440, duration: 1.0, volume: 0.5 },
      mythic:    { freq: 110, duration: 2.0, volume: 0.7 },
    };

    const cfg = rarityConfig[rarity] || rarityConfig.common;

    // Main tone
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.frequency.setValueAtTime(cfg.freq, ac.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(cfg.volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + cfg.duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + cfg.duration);

    // Harmonic overtone for richness
    if (rarity === 'legendary' || rarity === 'mythic') {
      const osc2 = ac.createOscillator();
      const gain2 = ac.createGain();
      osc2.connect(gain2);
      gain2.connect(ac.destination);
      osc2.frequency.setValueAtTime(cfg.freq * 2, ac.currentTime);
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(cfg.volume * 0.4, ac.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + cfg.duration * 0.7);
      osc2.start(ac.currentTime);
      osc2.stop(ac.currentTime + cfg.duration);
    }

    // Mythic: add a deep boom
    if (rarity === 'mythic') {
      const boom = ac.createOscillator();
      const bGain = ac.createGain();
      boom.connect(bGain);
      bGain.connect(ac.destination);
      boom.frequency.setValueAtTime(55, ac.currentTime);
      boom.type = 'sine';
      bGain.gain.setValueAtTime(0.6, ac.currentTime);
      bGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.5);
      boom.start(ac.currentTime);
      boom.stop(ac.currentTime + 1.5);
    }
  } catch (e) { /* ignore */ }
}

/** Whoosh on spin start */
export function playWhoosh() {
  try {
    const ac = getCtx();
    const bufferSize = ac.sampleRate * 0.15;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, ac.currentTime);
    filter.frequency.linearRampToValueAtTime(100, ac.currentTime + 0.15);
    filter.Q.value = 0.5;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.2, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    source.start(ac.currentTime);
  } catch (e) { /* ignore */ }
}
