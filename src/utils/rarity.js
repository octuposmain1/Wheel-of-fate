// ============================================================
// rarity.js — Weighted RNG Engine
// ============================================================

export const RARITY_TIERS = {
  common:    { label: "Common",    weight: 60, color: "#8a9ba8", glow: "#8a9ba822", icon: "⚪", class: "rarity-common" },
  rare:      { label: "Rare",      weight: 30, color: "#00b4ff", glow: "#00b4ff44", icon: "🔵", class: "rarity-rare" },
  legendary: { label: "Legendary", weight: 9,  color: "#ffd700", glow: "#ffd70066", icon: "🟡", class: "rarity-legendary" },
  mythic:    { label: "Mythic",    weight: 1,  color: "#ff3366", glow: "#ff336688", icon: "🔴", class: "rarity-mythic" },
};

export const RARITY_KEYS = ["common", "rare", "legendary", "mythic"];

/**
 * Given an array of trait objects { id, label, rarity },
 * returns the index of the randomly selected trait using
 * cumulative weighted probability.
 */
export function weightedRandom(traits) {
  if (!traits || traits.length === 0) return -1;

  const totalWeight = traits.reduce((sum, t) => {
    return sum + (RARITY_TIERS[t.rarity]?.weight ?? 60);
  }, 0);

  let rand = Math.random() * totalWeight;

  for (let i = 0; i < traits.length; i++) {
    rand -= (RARITY_TIERS[traits[i].rarity]?.weight ?? 60);
    if (rand <= 0) return i;
  }

  return traits.length - 1; // fallback
}

/**
 * Returns an array of segment arc sizes (0–1 normalized) for
 * a given traits array, respecting rarity weights.
 */
export function getSegmentSizes(traits) {
  const totalWeight = traits.reduce((sum, t) => {
    return sum + (RARITY_TIERS[t.rarity]?.weight ?? 60);
  }, 0);

  return traits.map(t => ({
    ...t,
    size: (RARITY_TIERS[t.rarity]?.weight ?? 60) / totalWeight,
  }));
}

/**
 * Returns the cumulative angle (in radians) for the start of
 * segment at index `targetIndex`, based on weighted segment sizes.
 */
export function getSegmentAngle(traits, targetIndex) {
  const segments = getSegmentSizes(traits);
  let angle = 0;
  for (let i = 0; i < targetIndex; i++) {
    angle += segments[i].size * Math.PI * 2;
  }
  return angle + (segments[targetIndex].size * Math.PI * 2) / 2;
}
