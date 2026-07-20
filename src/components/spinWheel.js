// ============================================================
// spinWheel.js — Canvas-Based Animated Spinning Wheel
// ============================================================

import { getSegmentSizes, getSpinDurationMs, getTierById, getTierIntensity, isDramaticTier, weightedRandom } from '../utils/rarity.js';
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

function getRaritySegmentColor(tiers, rarity) {
  return getTierById(tiers, rarity).color ?? '#8a9ba8';
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
    this.tiers = options.tiers ?? [];
    this.options = {
      size: options.size ?? 280,
      onLand: options.onLand ?? (() => {}),
      onTick: options.onTick ?? (() => {}),
      compressWeights: options.compressWeights ?? false,
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

    // Appended to <body> (not .wheel-container) and positioned `fixed`, not
    // `absolute` — the 9:16 .spin-viewport frame has `overflow:hidden`, so a
    // tooltip confined to it gets clipped whenever it would spill past the
    // frame's edge. Living on <body> lets it render fully regardless.
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'wheel-tooltip';
    this.tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tooltip);

    this.canvas.addEventListener('mousemove', (e) => this._handleHover(e));
    this.canvas.addEventListener('mouseleave', () => this._hideTooltip());
  }

  // ─── Hover Tooltip ─────────────────────────────────────────
  _handleHover(e) {
    if (this.isSpinning || !this.wheel.traits?.length) {
      this._hideTooltip();
      return;
    }

    const { size } = this.options;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      this._hideTooltip();
      return;
    }

    // Same convention as _drawWheel: segments start at angle `rotation`
    // (this.currentAngle), so the angle within the wheel's local frame is
    // the cursor angle minus that rotation, normalized to [0, 2π).
    const TAU = Math.PI * 2;
    let localAngle = (Math.atan2(dy, dx) - this.currentAngle) % TAU;
    if (localAngle < 0) localAngle += TAU;

    const segments = getSegmentSizes(this.wheel.traits, this.tiers, this.options.compressWeights);
    let cumulative = 0;
    const hit = segments.find((seg) => {
      const arc = seg.size * TAU;
      const inSegment = localAngle >= cumulative && localAngle < cumulative + arc;
      cumulative += arc;
      return inSegment;
    });

    if (!hit) {
      this._hideTooltip();
      return;
    }

    const tier = getTierById(this.tiers, hit.rarity);
    const logText = hit.combatLog ? `<div class="wheel-tooltip-log" style="font-size:11px; font-style:italic; color:rgba(255,255,255,0.9); margin-top:4px; border-top:1px dashed rgba(255,255,255,0.2); padding-top:4px;">"${escapeHtml(hit.combatLog)}"</div>` : '';

    this.tooltip.innerHTML = `
      <div class="wheel-tooltip-label" style="font-weight:bold; color:var(--gold); font-size:12px;">${escapeHtml(hit.label)}</div>
      <div class="wheel-tooltip-meta" style="font-size:10px; color:rgba(255,255,255,0.6);">${escapeHtml(tier.label)} ${hit.points ? `· +${hit.points} pts` : `· ${tier.weight}%`}</div>
      ${logText}
    `;

    // Fixed positioning is viewport-relative, so clientX/Y are used directly.
    // Clamp to the viewport so the tooltip can't run off-screen either.
    const estWidth = 220;
    const estHeight = hit.combatLog ? 80 : 50;
    const left = Math.min(e.clientX + 16, window.innerWidth - estWidth - 8);
    const top = Math.min(e.clientY + 16, window.innerHeight - estHeight - 8);
    this.tooltip.style.left = `${Math.max(8, left)}px`;
    this.tooltip.style.top = `${Math.max(8, top)}px`;
    this.tooltip.style.opacity = '1';
  }

  _hideTooltip() {
    if (this.tooltip) this.tooltip.style.opacity = '0';
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

    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const segments = getSegmentSizes(traits, this.tiers, this.options.compressWeights);
    const palette = NEON_PALETTES[this.paletteIndex % NEON_PALETTES.length];

    // The pointer (.wheel-pointer in main.css) sits at the right edge of the
    // wheel (canvas angle 0), not the top — segments must start there too,
    // or the visual landing position drifts a quarter-turn from the
    // actual weighted-RNG winner computed in spin().
    let startAngle = rotation;

    segments.forEach((seg, i) => {
      const arc = seg.size * Math.PI * 2;
      const endAngle = startAngle + arc;
      const midAngle = startAngle + arc / 2;

      const traitObj = traits[i];
      const isDisabled = traitObj && traitObj.disabled;

      // ─── Segment Fill ──────────────────────────────────
      const rColor = getRaritySegmentColor(this.tiers, seg.rarity);
      const baseColor = palette[i % palette.length];
      const dramatic = isDramaticTier(this.tiers, seg.rarity);

      // Use rarity color tint for dramatic (rarest) tiers, palette for common, dark grey for disabled
      let fillColor = dramatic ? rColor : baseColor;
      if (isDisabled) {
        fillColor = '#3a3a3c';
      }

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

      // ─── Glow for dramatic (rarest) tiers ─────────────
      if (dramatic && !isDisabled) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.strokeStyle = adjustAlpha(rColor, 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ─── Label ─────────────────────────────────────────
      // Normalize angle to determine if we are on left/right half
      let normAngle = midAngle % (Math.PI * 2);
      if (normAngle > Math.PI) normAngle -= Math.PI * 2;
      if (normAngle < -Math.PI) normAngle += Math.PI * 2;
      const isLeftHalf = Math.abs(normAngle) > Math.PI / 2;

      ctx.save();
      ctx.translate(cx, cy);
      // For left half, rotate by an additional 180 degrees so the text is upright
      const rotationAngle = isLeftHalf ? midAngle + Math.PI : midAngle;
      ctx.rotate(rotationAngle);

      const startX = radius * 0.28;
      const endX = radius * 0.88;
      const maxWidth = endX - startX;

      const fontSize = Math.max(11, Math.min(14, (size * seg.size * 1.2)));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';

      // Truncate long text
      let label = seg.label;
      while (ctx.measureText(label).width > maxWidth && label.length > 3) {
        label = label.slice(0, -4) + '…';
      }

      const textWidth = ctx.measureText(label).width;
      const pillW = textWidth + 12;
      const pillH = fontSize + 6;

      if (isLeftHalf) {
        ctx.textAlign = 'right';
        ctx.fillStyle = isDisabled ? 'rgba(5,5,5,0.85)' : 'rgba(10,10,15,0.75)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(-startX - textWidth - 6, -pillH / 2, pillW, pillH, pillH / 2);
          ctx.fill();
        } else {
          ctx.fillRect(-startX - textWidth - 6, -pillH / 2, pillW, pillH);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(label, -startX, 0);
        ctx.fillStyle = isDisabled ? '#8a8a95' : '#ffffff';
        ctx.fillText(label, -startX, 0);
      } else {
        ctx.textAlign = 'left';
        ctx.fillStyle = isDisabled ? 'rgba(5,5,5,0.85)' : 'rgba(10,10,15,0.75)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(startX - 6, -pillH / 2, pillW, pillH, pillH / 2);
          ctx.fill();
        } else {
          ctx.fillRect(startX - 6, -pillH / 2, pillW, pillH);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(label, startX, 0);
        ctx.fillStyle = isDisabled ? '#8a8a95' : '#ffffff';
        ctx.fillText(label, startX, 0);
      }

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
    ctx.restore();
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
  spin(forcedWinnerIndex) {
    return new Promise((resolve) => {
      if (this.isSpinning) return;
      if (!this.wheel.traits?.length) return;

      this.isSpinning = true;
      playWhoosh();

      // 1. Pick winner before animation
      let winnerIndex = typeof forcedWinnerIndex === 'number' && forcedWinnerIndex >= 0 && forcedWinnerIndex < this.wheel.traits.length
        ? forcedWinnerIndex
        : weightedRandom(this.wheel.traits, this.tiers, this.options.compressWeights);
      if (winnerIndex === -1 || winnerIndex >= this.wheel.traits.length) {
        winnerIndex = 0;
      }
      const winner = this.wheel.traits[winnerIndex];
      if (!winner) {
        this.isSpinning = false;
        return;
      }

      // 2. Compute total target rotation with randomized landing offset within slice
      const segments = getSegmentSizes(this.wheel.traits, this.tiers, this.options.compressWeights);
      let cumulativeAngle = 0;
      for (let i = 0; i < winnerIndex; i++) {
        cumulativeAngle += segments[i].size * Math.PI * 2;
      }
      
      const segArc = segments[winnerIndex].size * Math.PI * 2;
      // Randomize offset within 80% of the slice width so it never lands right on a border line
      const landingOffset = (Math.random() - 0.5) * segArc * 0.8;
      const segmentLandingAngle = cumulativeAngle + segArc * 0.5 + landingOffset;

      const extraFullTurns = 8 + Math.floor(Math.random() * 7); // 8-14 whole turns
      const fullSpins = extraFullTurns * Math.PI * 2;

      const targetRotation = this.currentAngle
        - (this.currentAngle % (Math.PI * 2))  // normalize
        + fullSpins
        - segmentLandingAngle;                  // place randomized slice landing angle at pointer

      const startAngle = this.currentAngle;
      const delta = targetRotation - startAngle;

      // 3. Duration varies dynamically for drama
      const duration = Math.max(2500, getSpinDurationMs(this.tiers, winner.rarity) + (Math.random() * 1200 - 600));

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
          playLock(winner.rarity, this.tiers);
          this._triggerLandEffect(winner.rarity);
          resolve({ trait: winner, index: winnerIndex });
        }
      };

      this.spinAnimId = requestAnimationFrame(animate);
    });
  }

  _triggerLandEffect(rarity) {
    if (isDramaticTier(this.tiers, rarity)) {
      const color = getRaritySegmentColor(this.tiers, rarity);

      // Screen shake
      this.container.classList.add('shake');
      setTimeout(() => this.container.classList.remove('shake'), 600);

      // Flash overlay, tinted with the tier's own color
      const flash = document.createElement('div');
      flash.className = 'flash-overlay';
      flash.style.background = `radial-gradient(ellipse, ${adjustAlpha(color, 0.45)} 0%, transparent 70%)`;
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 700);

      // The rarest slice of the "dramatic" band gets extra particles
      const veryRare = getTierIntensity(this.tiers, rarity) >= 0.9;
      this._spawnParticles(veryRare ? 20 : 10);
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
    this.tooltip?.remove();
  }
}

// ─── Utility ───────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function adjustAlpha(hexColor, alpha) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
