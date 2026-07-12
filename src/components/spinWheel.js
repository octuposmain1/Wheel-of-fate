// ============================================================
// spinWheel.js — Canvas-Based Animated Spinning Wheel
// ============================================================

import { getSegmentSizes, RARITY_TIERS, weightedRandom } from '../utils/rarity.js';
import { playTick, playLock, playWhoosh } from '../utils/audio.js';

const NEON_PALETTES = [
  // Cyan/Purple
  ['#00f5ff','#bf00ff','#00c4cc','#8800cc','#00e5ee','#9900dd'],
  // Gold/Red
  ['#ffd700','#ff3366','#cc9900','#cc0033','#ffe066','#ff6699'],
  // Green/Cyan
  ['#00ff88','#00f5ff','#00cc66','#00c4cc','#00ff66','#00d4ee'],
  // Purple/Pink
  ['#bf00ff','#ff00cc','#8800cc','#cc0099','#9900ff','#ff33cc'],
];

function getRaritySegmentColor(rarity) {
  return RARITY_TIERS[rarity]?.color ?? '#8a9ba8';
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 4;
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export class SpinWheel {
  constructor(container, wheel, options = {}) {
    this.container = container;
    this.wheel = wheel;
    this.options = {
      size: options.size ?? 280,
      onLand: options.onLand ?? (() => {}),
      onTick: options.onTick ?? (() => {}),
    };

    this.currentAngle = 0;       // current rotation in radians
    this.isSpinning = false;
    this.spinAnimId = null;
    this.lastTickAngle = 0;
    this.paletteIndex = 0;

    this._build();
    this._drawWheel(this.currentAngle);
  }

  // ─── Build DOM ─────────────────────────────────────────────
  _build() {
    const size = this.options.size;

    this.container.innerHTML = `
      <div class="wheel-container" style="width:${size}px; height:${size}px;">
        <canvas
          id="wheel-canvas-${this.wheel.id}"
          width="${size}"
          height="${size}"
          style="border-radius:50%; display:block;"
          aria-label="Spinning wheel for ${this.wheel.name}"
          role="img"
        ></canvas>
        <div class="wheel-pointer" aria-hidden="true"></div>
        <div class="wheel-center" aria-hidden="true"></div>
      </div>
    `;

    this.canvas = this.container.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  // ─── Draw ──────────────────────────────────────────────────
  _drawWheel(rotation) {
    const { ctx, wheel, options } = this;
    const { size } = options;
    const traits = wheel.traits;

    if (!traits || traits.length === 0) {
      this._drawEmptyWheel();
      return;
    }

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const segments = getSegmentSizes(traits);
    const palette = NEON_PALETTES[this.paletteIndex % NEON_PALETTES.length];

    ctx.clearRect(0, 0, size, size);

    let startAngle = rotation - Math.PI / 2; // start from top (pointer position)

    segments.forEach((seg, i) => {
      const arc = seg.size * Math.PI * 2;
      const endAngle = startAngle + arc;
      const midAngle = startAngle + arc / 2;

      // ─── Segment Fill ──────────────────────────────────
      const rColor = getRaritySegmentColor(seg.rarity);
      const baseColor = palette[i % palette.length];

      // Use rarity color tint for special rarities, palette for common
      const fillColor = (seg.rarity === 'legendary' || seg.rarity === 'mythic')
        ? rColor
        : baseColor;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Gradient fill
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, adjustAlpha(fillColor, 0.7));
      grad.addColorStop(0.6, adjustAlpha(fillColor, 0.5));
      grad.addColorStop(1, adjustAlpha(fillColor, 0.8));
      ctx.fillStyle = grad;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // ─── Glow for Legendary/Mythic ─────────────────────
      if (seg.rarity === 'legendary' || seg.rarity === 'mythic') {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.strokeStyle = adjustAlpha(rColor, 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ─── Label ─────────────────────────────────────────
      const labelRadius = radius * 0.68;
      const textX = cx + labelRadius * Math.cos(midAngle);
      const textY = cy + labelRadius * Math.sin(midAngle);

      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(midAngle + Math.PI / 2);

      const maxWidth = radius * seg.size * 1.8;
      const fontSize = Math.max(9, Math.min(13, (size * seg.size * 0.8)));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Truncate long text
      let label = seg.label;
      while (ctx.measureText(label).width > maxWidth && label.length > 3) {
        label = label.slice(0, -4) + '…';
      }
      ctx.fillText(label, 0, 0);
      ctx.restore();

      startAngle = endAngle;
    });

    // ─── Outer Ring Glow ─────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawEmptyWheel() {
    const { ctx, options: { size } } = this;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,245,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add traits to wheel', cx, cy);
  }

  // ─── Spin Logic ────────────────────────────────────────────
  /**
   * Spins the wheel. Picks the winner via weighted RNG before
   * animation starts, then animates to land on that segment.
   * @returns {Promise<{trait, index}>}
   */
  spin() {
    return new Promise((resolve) => {
      if (this.isSpinning) return;
      if (!this.wheel.traits?.length) return;

      this.isSpinning = true;
      playWhoosh();

      // 1. Pick winner before animation
      const winnerIndex = weightedRandom(this.wheel.traits);
      const winner = this.wheel.traits[winnerIndex];

      // 2. Compute total target rotation
      const segments = getSegmentSizes(this.wheel.traits);
      let cumulativeAngle = 0;
      for (let i = 0; i < winnerIndex; i++) {
        cumulativeAngle += segments[i].size * Math.PI * 2;
      }
      // Land in the middle of the winning segment
      const segmentMidAngle = cumulativeAngle + (segments[winnerIndex].size * Math.PI * 2) * 0.5;

      // Add multiple full rotations for drama (8–12 full spins)
      const fullSpins = (8 + Math.random() * 4) * Math.PI * 2;
      // We want: currentAngle + totalDelta normalised → lands on segmentMidAngle at top
      // At the pointer (top, -π/2): the segment at angle θ from rotation=0 is at the pointer
      // when rotation = -θ (i.e., pointer sees angle=0 when rotation=0)
      const targetRotation = this.currentAngle
        - (this.currentAngle % (Math.PI * 2))  // normalize
        + fullSpins
        - segmentMidAngle;                      // place midpoint at pointer

      const startAngle = this.currentAngle;
      const delta = targetRotation - startAngle;

      // 3. Duration varies by rarity for drama
      const durations = { common: 4000, rare: 4500, legendary: 5500, mythic: 7000 };
      const duration = (durations[winner.rarity] ?? 4000) + Math.random() * 500;

      const startTime = performance.now();
      this.lastTickAngle = startAngle;

      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing: fast start, dramatic slowdown
        const eased = easeOutCubic(progress);
        this.currentAngle = startAngle + delta * eased;

        // Angular velocity for SFX pacing
        const angularVelocity = Math.max(0, (1 - progress) * 15);

        // Trigger tick sounds when crossing segment boundaries
        const angleDiff = this.currentAngle - this.lastTickAngle;
        const segmentsCount = this.wheel.traits.length;
        const avgSegmentAngle = (Math.PI * 2) / segmentsCount;
        if (angleDiff >= avgSegmentAngle * 0.9) {
          playTick(angularVelocity / 15);
          this.lastTickAngle = this.currentAngle;
        }

        this._drawWheel(this.currentAngle);

        if (progress < 1) {
          this.spinAnimId = requestAnimationFrame(animate);
        } else {
          this.currentAngle = targetRotation;
          this._drawWheel(this.currentAngle);
          this.isSpinning = false;
          playLock(winner.rarity);
          this._triggerLandEffect(winner.rarity);
          resolve({ trait: winner, index: winnerIndex });
        }
      };

      this.spinAnimId = requestAnimationFrame(animate);
    });
  }

  _triggerLandEffect(rarity) {
    if (rarity === 'legendary' || rarity === 'mythic') {
      // Screen shake
      this.container.classList.add('shake');
      setTimeout(() => this.container.classList.remove('shake'), 600);

      // Flash overlay
      const flash = document.createElement('div');
      flash.className = `flash-overlay flash-${rarity}`;
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 700);

      // Particles
      if (rarity === 'mythic') {
        this._spawnParticles(20);
      } else {
        this._spawnParticles(10);
      }
    }
  }

  _spawnParticles(count) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#ffd700','#ff3366','#00f5ff','#bf00ff','#00ff88'];

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'particle';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 4 + Math.random() * 8;
        const vx = (Math.random() - 0.5) * 200;
        const vy = -(Math.random() * 200 + 100);
        p.style.cssText = `
          left: ${cx + (Math.random()-0.5)*80}px;
          top: ${cy}px;
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          box-shadow: 0 0 ${size}px ${color};
          animation-duration: ${1 + Math.random()}s;
        `;
        document.body.appendChild(p);
        p.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 },
        ], { duration: 1200 + Math.random() * 600, easing: 'cubic-bezier(0,0,0.2,1)' })
          .onfinish = () => p.remove();
      }, i * 30);
    }
  }

  // ─── Update Wheel Data ─────────────────────────────────────
  updateWheel(wheel) {
    this.wheel = wheel;
    if (!this.isSpinning) {
      this._drawWheel(this.currentAngle);
    }
  }

  destroy() {
    if (this.spinAnimId) {
      cancelAnimationFrame(this.spinAnimId);
    }
  }
}

// ─── Utility ───────────────────────────────────────────────────
function adjustAlpha(hexColor, alpha) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
