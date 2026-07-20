// ============================================================
// rarity.js — Weighted RNG Engine & Rarity Tier Derivation
// ============================================================
//
// Rarity tiers are user data (store.getState().rarityTiers), not a fixed
// set of keys — everything here is a pure function of that live list plus
// a trait's `rarity` id, so adding/renaming/deleting tiers just works
// without touching this file again.

const FALLBACK_TIER = { id: '__unknown__', label: 'Unknown', weight: 60, color: '#8a9ba8', icon: '❔' };

function lerp(min, max, t) {
  return min + (max - min) * t;
}

/** Safe lookup — never returns undefined, even for an orphaned/deleted tier id. */
export function getTierById(tiers, id) {
  return tiers.find(t => t.id === id) ?? FALLBACK_TIER;
}

/**
 * Normalized rarity position in [0, 1] based on weight rank — 0 is the
 * most common tier (highest weight), 1 is the rarest (lowest weight).
 * Every derived effect (duration/power/audio/drama) is a function of this,
 * so it automatically stays consistent as tiers are added/edited/removed.
 */
export function getTierIntensity(tiers, id) {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => b.weight - a.weight);
  const rank = sorted.findIndex(t => t.id === id);
  if (rank === -1 || sorted.length === 1) return 0;
  return rank / (sorted.length - 1);
}

/** Bounded so an extreme weight never produces an absurd spin duration. */
export function getSpinDurationMs(tiers, id) {
  return lerp(3500, 7000, getTierIntensity(tiers, id));
}

/** Bounded 1-25 tournament power score. */
export function getPowerScore(tiers, id) {
  return Math.round(lerp(1, 25, getTierIntensity(tiers, id)));
}

/** Bounded base tone for lock-in sound effects. */
export function getAudioFrequency(tiers, id) {
  return lerp(220, 660, getTierIntensity(tiers, id));
}

/** The rarest third of tiers get flash/shake/particle/pulse treatment. */
export function isDramaticTier(tiers, id) {
  return getTierIntensity(tiers, id) >= 0.66;
}

export function isNegativeWheel(wheelName) {
  if (!wheelName) return false;
  const name = wheelName.toLowerCase();
  return name.includes('weakness') || name.includes('flaw') || name.includes('defect') || name.includes('negative') || name.includes('curse') || name.includes('penalty');
}

export function hexToRgba(hex, alpha) {
  const clean = (hex ?? '').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Given an array of trait objects { id, label, rarity },
 * returns the index of the randomly selected trait using
 * cumulative weighted probability.
 */
export function getCompressedWeight(tiers, rarityId) {
  if (!tiers.length) return 30;
  const sorted = [...tiers].sort((a, b) => b.weight - a.weight);
  const index = sorted.findIndex(t => t.id === rarityId);
  if (index === -1) return 30;
  const scale = [30, 20, 15, 10];
  return scale[Math.min(index, scale.length - 1)];
}

export function weightedRandom(traits, tiers, compressWeights = false) {
  if (!traits || traits.length === 0) return -1;

  // Filter out disabled traits, tracking their original index
  const activeTraits = traits
    .map((t, idx) => ({ t, idx }))
    .filter(item => !item.t.disabled);

  if (activeTraits.length === 0) return -1;

  const totalWeight = activeTraits.reduce((sum, item) => {
    const w = compressWeights 
      ? getCompressedWeight(tiers, item.t.rarity) 
      : (getTierById(tiers, item.t.rarity).weight ?? 60);
    return sum + w;
  }, 0);

  let rand = Math.random() * totalWeight;

  for (let i = 0; i < activeTraits.length; i++) {
    const item = activeTraits[i];
    const w = compressWeights 
      ? getCompressedWeight(tiers, item.t.rarity) 
      : (getTierById(tiers, item.t.rarity).weight ?? 60);
    rand -= w;
    if (rand <= 0) return item.idx;
  }

  return activeTraits[activeTraits.length - 1].idx; // fallback
}

/**
 * Returns an array of segment arc sizes (0–1 normalized) for
 * a given traits array, respecting rarity weights (optionally compressed).
 */
export function getSegmentSizes(traits, tiers, compressWeights = false) {
  const totalWeight = traits.reduce((sum, t) => {
    const w = compressWeights 
      ? getCompressedWeight(tiers, t.rarity) 
      : (getTierById(tiers, t.rarity).weight ?? 60);
    return sum + w;
  }, 0);

  return traits.map(t => {
    const w = compressWeights 
      ? getCompressedWeight(tiers, t.rarity) 
      : (getTierById(tiers, t.rarity).weight ?? 60);
    return {
      ...t,
      size: w / (totalWeight || 1),
    };
  });
}

/**
 * Returns the cumulative angle (in radians) for the start of
 * segment at index `targetIndex`, based on weighted segment sizes.
 */
export function getSegmentAngle(traits, targetIndex, tiers, compressWeights = false) {
  const segments = getSegmentSizes(traits, tiers, compressWeights);
  let angle = 0;
  for (let i = 0; i < targetIndex; i++) {
    angle += segments[i].size * Math.PI * 2;
  }
  return angle + (segments[targetIndex].size * Math.PI * 2) / 2;
}

/** Shared rarity-distribution bar segments — used by builderPage.js and homePage.js. */
export function computeRarityBarSegments(tiers, traits) {
  if (!traits.length) return [];
  const counts = new Map();
  traits.forEach(t => counts.set(t.rarity, (counts.get(t.rarity) ?? 0) + 1));
  const total = traits.length;

  return [...counts.entries()].map(([rarityId, count]) => ({
    tier: getTierById(tiers, rarityId),
    count,
    fraction: count / total,
  }));
}

/** Renders a beautifully styled glassmorphic RPG stat sheet block. */
export function renderRpgStatsSheet(powerSystem, backstory) {
  if (!powerSystem) return '';
  const stats = powerSystem.stats ?? {};
  const labels = {
    combatPower: '✨ Potential',
    strength: '💪 Strength',
    defense: '🛡️ Defense',
    speed: '⚡ Speed',
    energy: '🔥 Energy Flow',
    tactics: '🧠 Tactics'
  };

  const esc = (str) => {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  };

  return `
    <div class="rpg-stats-sheet" style="display:flex; flex-direction:column; gap:12px; margin-top:8px; width:100%;">
      <!-- Header: Power System Type -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
        <div>
          <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px;">System / Class</span>
          <div style="font-family:var(--font-display); font-size:13px; color:var(--cyan); font-weight:700;">
            ${esc(powerSystem.systemName)}: ${esc(powerSystem.classOrType)}
          </div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px;">Synergy</span>
          <div style="font-family:var(--font-display); font-size:14px; font-weight:900; color:var(--gold); text-shadow:0 0 8px rgba(255,215,0,0.4);">
            ${esc(powerSystem.synergyRating)}
          </div>
        </div>
      </div>

      <!-- Narrative Backstory -->
      ${backstory ? `
        <div class="backstory-text" style="font-size:12px; line-height:1.6; color:rgba(255,255,255,0.85); font-style:italic; background:rgba(191,0,255,0.05); padding:12px; border-radius:10px; border:1px solid rgba(191,0,255,0.15); margin:0;">
          "${esc(backstory)}"
        </div>
      ` : ''}

      <!-- Calculation & Synergy Audit -->
      ${powerSystem.breakdown ? `
        <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; font-size:11px; margin-top:2px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-weight:700; color:var(--cyan);">
            <span>📊 Math & Synergy Audit</span>
            <span style="color:var(--gold); font-size:11px;">⚡ Raw Power Level: ${powerSystem.rawPower ?? 100} PL</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:3px 8px; border-radius:4px; font-size:10px; color:rgba(255,255,255,0.5);">
              <span>Base Adventurer Rank</span>
              <span style="font-weight:bold; color:#fff;">+${powerSystem.basePower ?? 30} pts</span>
            </div>
            ${(powerSystem.breakdown || []).map(b => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:4px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
                <span style="color:rgba(255,255,255,0.85); font-size:11px;">
                  ${b.isNegative ? '🔴' : '🟢'} ${esc(b.label)}
                  <span style="font-size:9px; color:${b.color}; font-weight:bold; margin-left:4px; opacity:0.9;">(${esc(b.tierLabel)})</span>
                </span>
                <span style="font-family:var(--font-display); font-weight:bold; font-size:11px; color:${b.isNegative ? '#ff4d4d' : '#00ffaa'};">
                  ${b.points > 0 ? '+' : ''}${b.points} pts
                </span>
              </div>
            `).join('')}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px; font-size:10px; color:rgba(255,255,255,0.6);">
            <span>Capacity: <strong style="color:var(--cyan);">${powerSystem.rawPower ?? 0} / ${powerSystem.maxPotentialPL ?? 100} PL (${Math.round(((powerSystem.rawPower ?? 0) / (powerSystem.maxPotentialPL || 1)) * 100)}%)</strong></span>
            <span>Potential: <strong style="color:var(--gold); font-size:12px;">${stats.combatPower ?? 50} / 100</strong></span>
          </div>
        </div>
      ` : ''}

      <!-- Rating Explanation -->
      ${powerSystem.ratingExpl ? `
        <p style="font-size:10px; color:rgba(255,255,255,0.45); line-height:1.4; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px; margin:0;">
          💡 <strong>Evaluation:</strong> ${esc(powerSystem.ratingExpl)}
        </p>
      ` : ''}
    </div>
  `;
}

/** Generates a local fallback power system object deterministically based on live dynamic rarity intensity. */
export function proceduralFallbackPowerSystem(lockedTraits, tiers, wheels = []) {
  const traitRoles = {};
  const breakdown = [];
  
  let basePower = 30;
  let sumPositive = 0;
  let sumNegative = 0;
  let positiveSlotsCount = 0;

  lockedTraits.forEach(lt => {
    const whl = wheels.find(w => w.id === lt.wheelId) || { name: lt.wheelName ?? '' };
    const isNeg = isNegativeWheel(whl.name);
    const intensity = getTierIntensity(tiers, lt.trait.rarity);
    const tier = getTierById(tiers, lt.trait.rarity);

    const role = isNeg ? 'negative' : 'positive';
    traitRoles[lt.trait.label] = role;

    if (isNeg) {
      // Dynamic negative weakness penalty scaling with rarity rank (e.g. -12 to -60)
      const penalty = Math.round(12 + intensity * 48);
      sumNegative += penalty;
      breakdown.push({
        label: lt.trait.label,
        tierLabel: tier.label,
        color: tier.color,
        isNegative: true,
        points: -penalty
      });
    } else {
      positiveSlotsCount++;
      // Dynamic positive power bonus scaling with rarity rank (e.g. +10 to +50)
      const bonus = Math.round(10 + intensity * 40);
      sumPositive += bonus;
      breakdown.push({
        label: lt.trait.label,
        tierLabel: tier.label,
        color: tier.color,
        isNegative: false,
        points: +bonus
      });
    }
  });

  // Cumulative Raw Power Level (PL)
  const rawPower = basePower + sumPositive - sumNegative;
  // Maximum Possible PL achievable for this specific wheel count configuration
  const maxPotentialPL = basePower + Math.max(1, positiveSlotsCount) * 50;

  let synergyMultiplier = 1.0;
  let synergyRating = 'B-Tier';

  const hasNegative = sumNegative > 0;
  const netBalance = sumPositive - sumNegative;

  if (hasNegative && sumNegative >= 50) {
    synergyMultiplier = 0.70;
    synergyRating = 'D-Tier (Severely Flawed)';
  } else if (hasNegative && sumNegative >= 30) {
    synergyMultiplier = 0.82;
    synergyRating = 'C-Tier (Flawed)';
  } else if (netBalance >= 50) {
    synergyMultiplier = 1.25;
    synergyRating = 'S-Tier';
  } else if (netBalance >= 25) {
    synergyMultiplier = 1.15;
    synergyRating = 'A-Tier';
  } else if (netBalance < 0) {
    synergyMultiplier = 0.85;
    synergyRating = 'C-Tier';
  }

  // Efficiency ratio: Achieved Raw PL / Max Potential PL
  const efficiencyRatio = Math.max(0, rawPower) / maxPotentialPL;
  const baseCombatGrade = Math.round(efficiencyRatio * 90);
  
  // Normalized 0–100 Combat Power Grade (100 requires top Mythic roll on all slots + S-Tier synergy)
  const calculatedCombatPower = Math.max(5, Math.min(100, Math.round(baseCombatGrade * synergyMultiplier)));

  const strength = Math.max(5, Math.min(100, Math.round(calculatedCombatPower * 0.9 + (sumPositive * 0.2) - (sumNegative * 0.15))));
  const defense = Math.max(5, Math.min(100, Math.round(calculatedCombatPower * 0.85 - (sumNegative * 0.3) + 10)));
  const speed = Math.max(5, Math.min(100, Math.round(calculatedCombatPower * 0.95 + Math.random() * 8)));
  const energy = Math.max(5, Math.min(100, Math.round(calculatedCombatPower * 1.02 - (sumNegative * 0.2))));
  const tactics = Math.max(5, Math.min(100, Math.round(calculatedCombatPower * 0.8 + 15)));

  // Derive power system and class name directly from character's actual traits (No fake/hallucinated anime systems)
  const posTraits = lockedTraits.filter(lt => !isNegativeWheel(wheels.find(w => w.id === lt.wheelId)?.name ?? lt.wheelName));
  const mainTrait = posTraits[0] ?? lockedTraits[0];
  const mainLabel = mainTrait ? mainTrait.trait.label : 'Character Traits';

  const systemName = `${mainLabel} Resonance`;
  const classOrType = posTraits.length > 1 ? `Multi-Trait Synergy (${posTraits.length} Traits)` : `Single Trait Master`;

  const ratingExpl = hasNegative
    ? `Weakness penalties (-${sumNegative} pts) bring total capacity to ${rawPower} PL, evaluating to ${calculatedCombatPower}/100 Potential.`
    : `Synergy boost brings total capacity to ${rawPower} PL (${Math.round(efficiencyRatio * 100)}% of max potential), evaluating to ${calculatedCombatPower}/100 Potential.`;

  return {
    systemName,
    classOrType,
    synergyRating,
    synergyMultiplier,
    rawPower,
    maxPotentialPL,
    basePower,
    breakdown,
    stats: {
      combatPower: calculatedCombatPower,
      strength,
      defense,
      speed,
      energy,
      tactics
    },
    traitRoles,
    ratingExpl
  };
}
