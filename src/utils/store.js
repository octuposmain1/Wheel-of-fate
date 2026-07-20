// ============================================================
// store.js — Global Application State (localStorage backed)
// ============================================================

import { api } from './api.js';

const STORAGE_KEY = 'wheel_of_fate_v1';
const MIGRATED_KEY = 'wheel_of_fate_migrated_v1';

// Ids are stable and never user-edited — label/weight/color are (icon is
// kept in the data shape for backward compatibility but is no longer
// displayed anywhere — every rarity indicator in the UI is now a plain
// circle derived directly from `color`, so it can never drift from the
// color picker the way a separately-stored icon character could).
const DEFAULT_RARITY_TIERS = [
  { id: 'common', label: 'Common', weight: 60, color: '#8a9ba8', icon: '⚪' },
  { id: 'rare', label: 'Rare', weight: 30, color: '#00b4ff', icon: '🔵' },
  { id: 'legendary', label: 'Legendary', weight: 9, color: '#ffd700', icon: '🟡' },
  { id: 'mythic', label: 'Mythic', weight: 1, color: '#ff3366', icon: '🔴' },
];

// ─── Default Templates ────────────────────────────────────────
function createTrait(label, rarity = 'common') {
  return { id: crypto.randomUUID(), label, rarity };
}

function createWheel(name, icon, traits) {
  return {
    id: crypto.randomUUID(),
    name,
    icon,
    color: '#00f5ff',
    traits,
    createdAt: Date.now(),
  };
}

const DEFAULT_WHEELS = [
  createWheel('Race', '🧬', [
    createTrait('Human', 'common'),
    createTrait('Elf', 'common'),
    createTrait('Orc', 'common'),
    createTrait('Dwarf', 'common'),
    createTrait('Halfling', 'common'),
    createTrait('Tiefling', 'rare'),
    createTrait('Dragonborn', 'rare'),
    createTrait('Aasimar', 'rare'),
    createTrait('Githyanki', 'legendary'),
    createTrait('Astral Deva', 'legendary'),
    createTrait('Void Walker', 'mythic'),
    createTrait('Elder God Fragment', 'mythic'),
  ]),
  createWheel('Bloodline', '🩸', [
    createTrait('Peasant Stock', 'common'),
    createTrait('Merchant Family', 'common'),
    createTrait('Minor Noble', 'common'),
    createTrait('Soldier Lineage', 'common'),
    createTrait('Ancient Mage Line', 'rare'),
    createTrait('Cursed Bloodline', 'rare'),
    createTrait('Royal Descent', 'rare'),
    createTrait('Demon Touched', 'legendary'),
    createTrait('Celestial Heritage', 'legendary'),
    createTrait('Dragon Emperor\'s Kin', 'mythic'),
  ]),
  createWheel('Special Power', '⚡', [
    createTrait('Enhanced Strength', 'common'),
    createTrait('Night Vision', 'common'),
    createTrait('Minor Healing', 'common'),
    createTrait('Fire Resistance', 'common'),
    createTrait('Telepathy', 'rare'),
    createTrait('Time Slow (3s)', 'rare'),
    createTrait('Shadow Step', 'rare'),
    createTrait('Elemental Mastery', 'legendary'),
    createTrait('Reality Bend', 'legendary'),
    createTrait('Godkiller Strike', 'mythic'),
    createTrait('Infinite Rebirth', 'mythic'),
  ]),
  createWheel('Fatal Weakness', '💀', [
    createTrait('Fear of Heights', 'common'),
    createTrait('Allergy to Silver', 'common'),
    createTrait('Socially Awkward', 'common'),
    createTrait('Can\'t Swim', 'common'),
    createTrait('Cursed at Dawn', 'rare'),
    createTrait('Soul Debt', 'rare'),
    createTrait('Blood Rage', 'rare'),
    createTrait('Memory Wipe Monthly', 'legendary'),
    createTrait('Feeds Enemy Power', 'legendary'),
    createTrait('Existence Paradox', 'mythic'),
  ]),
];

const DEFAULT_WHEEL_GROUPS = [
  {
    id: 'group-default-fantasy',
    name: '⚔️ High Fantasy RPG',
    icon: '⚔️',
    active: true,
    wheelIds: DEFAULT_WHEELS.map(w => w.id),
  }
];

// ─── State Singleton ─────────────────────────────────────────
const listeners = new Set();

let state = loadFromStorage();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure defaults exist if new wheels were added
      if (!parsed.wheels || parsed.wheels.length === 0) {
        parsed.wheels = DEFAULT_WHEELS;
      }
      if (!parsed.rarityTiers || parsed.rarityTiers.length === 0) {
        parsed.rarityTiers = DEFAULT_RARITY_TIERS;
      }
      if (!parsed.wheelGroups || parsed.wheelGroups.length === 0) {
        parsed.wheelGroups = [
          {
            id: 'group-default-fantasy',
            name: '⚔️ High Fantasy RPG',
            icon: '⚔️',
            active: true,
            wheelIds: (parsed.wheels || DEFAULT_WHEELS).map(w => w.id),
          }
        ];
      }
      // `online` always starts false and is re-derived by store.init() —
      // never trust a stale value that happened to be persisted last session.
      parsed.online = false;
      return parsed;
    }
  } catch (e) { /* ignore */ }

  return {
    wheels: DEFAULT_WHEELS,
    wheelGroups: DEFAULT_WHEEL_GROUPS,
    characters: [],
    rarityTiers: DEFAULT_RARITY_TIERS,
    session: null,
    online: false,
  };
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

function notify() {
  listeners.forEach(fn => fn({ ...state }));
}

// Fire-and-forget background sync — only ever called when state.online is
// true. Failures are logged, not surfaced: local state stays authoritative
// and no retry/outbox queue exists yet (fine for single-device use).
function _syncInBackground(fn) {
  Promise.resolve()
    .then(fn)
    .catch(err => console.warn('Background sync failed:', err.message));
}

function _wheelToApiPayload(wheel) {
  return { id: wheel.id, name: wheel.name, icon: wheel.icon, color: wheel.color };
}

function _rarityTierToApiPayload(tier) {
  return { id: tier.id, label: tier.label, weight: tier.weight, color: tier.color, icon: tier.icon };
}

function _characterToApiPayload(character) {
  const traits = character.traits.map(({ wheelId, trait }) => {
    const wheel = state.wheels.find(w => w.id === wheelId);
    return {
      wheelId,
      wheelName: wheel?.name ?? '',
      wheelIcon: wheel?.icon ?? '',
      trait: { label: trait.label, rarity: trait.rarity },
    };
  });
  return {
    id: character.id,
    name: character.name,
    backstory: character.backstory,
    traits,
    powerSystem: character.powerSystem ?? null
  };
}

export const store = {
  getState() { return state; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ─── Backend Init (Stage 4) ──────────────────────────────
  // Tries the API first; falls back to the existing localStorage-only
  // behavior if no server is running. The app must stay fully usable
  // with zero backend — this only ever upgrades what's already there.
  async init() {
    try {
      const [wheels, characters, rarityTiers] = await Promise.all([
        api.getWheels(),
        api.getCharacters(),
        api.getRarityTiers(),
      ]);

      if (
        wheels.length === 0 &&
        characters.length === 0 &&
        rarityTiers.length === 0 &&
        !localStorage.getItem(MIGRATED_KEY)
      ) {
        // First run against a fresh/empty backend: push up whatever's
        // already in localStorage, once, then never re-attempt it.
        for (const tier of state.rarityTiers) {
          await api.createRarityTier(_rarityTierToApiPayload(tier));
        }
        for (const wheel of state.wheels) {
          await api.createWheel(_wheelToApiPayload(wheel));
          for (const trait of wheel.traits) {
            await api.createTrait(wheel.id, { id: trait.id, label: trait.label, rarity: trait.rarity });
          }
        }
        for (const character of state.characters) {
          await api.createCharacter(_characterToApiPayload(character));
        }
        localStorage.setItem(MIGRATED_KEY, '1');
        state = { ...state, online: true };
      } else {
        state = {
          ...state,
          wheels,
          characters,
          rarityTiers: rarityTiers.length ? rarityTiers : state.rarityTiers,
          online: true,
        };
      }
    } catch (e) {
      // No server running (or it errored) — stay on localStorage only.
      state = { ...state, online: false };
    }

    saveToStorage();
    notify();
  },

  // ─── Wheel CRUD ──────────────────────────────────────────
  addWheel(name, icon = '🎡') {
    const wheel = createWheel(name, icon, []);
    const activeGroup = (state.wheelGroups || []).find(g => g.active) || state.wheelGroups?.[0];
    
    let updatedGroups = state.wheelGroups || [];
    if (activeGroup) {
      updatedGroups = updatedGroups.map(g =>
        g.id === activeGroup.id ? { ...g, wheelIds: [...g.wheelIds, wheel.id] } : g
      );
    }

    state = { ...state, wheels: [...state.wheels, wheel], wheelGroups: updatedGroups };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.createWheel(_wheelToApiPayload(wheel)));
    return wheel;
  },

  updateWheel(wheelId, updates) {
    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId ? { ...w, ...updates } : w
      ),
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.updateWheel(wheelId, updates));
  },

  deleteWheel(wheelId) {
    const updatedGroups = (state.wheelGroups || []).map(g => ({
      ...g,
      wheelIds: (g.wheelIds || []).filter(id => id !== wheelId)
    }));

    state = {
      ...state,
      wheels: state.wheels.filter(w => w.id !== wheelId),
      wheelGroups: updatedGroups
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.deleteWheel(wheelId));
  },

  // ─── Trait CRUD ──────────────────────────────────────────
  addTrait(wheelId, label, rarity = 'common') {
    const trait = createTrait(label, rarity);
    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId
          ? { ...w, traits: [...w.traits, trait] }
          : w
      ),
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.createTrait(wheelId, { id: trait.id, label: trait.label, rarity: trait.rarity }));
    return trait;
  },

  updateTrait(wheelId, traitId, updates) {
    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId
          ? {
              ...w,
              traits: w.traits.map(t =>
                t.id === traitId ? { ...t, ...updates } : t
              ),
            }
          : w
      ),
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.updateTrait(wheelId, traitId, updates));
  },

  deleteTrait(wheelId, traitId) {
    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId
          ? { ...w, traits: w.traits.filter(t => t.id !== traitId) }
          : w
      ),
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.deleteTrait(wheelId, traitId));
  },

  regenerateWheelTraits(wheelId, newTraits) {
    const wheel = state.wheels.find(w => w.id === wheelId);
    if (!wheel) return;

    const oldTraits = [...wheel.traits];

    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId ? { ...w, backupTraits: oldTraits, traits: newTraits } : w
      )
    };

    saveToStorage();
    notify();

    if (state.online) {
      _syncInBackground(async () => {
        for (const t of oldTraits) {
          try {
            await api.deleteTrait(wheelId, t.id);
          } catch (e) {
            console.error('Failed to sync trait deletion:', e);
          }
        }
        for (const t of newTraits) {
          try {
            await api.createTrait(wheelId, { id: t.id, label: t.label, rarity: t.rarity });
          } catch (e) {
            console.error('Failed to sync trait creation:', e);
          }
        }
      });
    }
  },

  revertWheelTraits(wheelId) {
    const wheel = state.wheels.find(w => w.id === wheelId);
    if (!wheel || !wheel.backupTraits) return;

    const currentTraits = [...wheel.traits];
    const backupTraits = [...wheel.backupTraits];

    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId ? { ...w, backupTraits: null, traits: backupTraits } : w
      )
    };

    saveToStorage();
    notify();

    if (state.online) {
      _syncInBackground(async () => {
        for (const t of currentTraits) {
          try {
            await api.deleteTrait(wheelId, t.id);
          } catch (e) {
            console.error('Failed to sync trait deletion:', e);
          }
        }
        for (const t of backupTraits) {
          try {
            await api.createTrait(wheelId, { id: t.id, label: t.label, rarity: t.rarity });
          } catch (e) {
            console.error('Failed to sync trait restoration:', e);
          }
        }
      });
    }
  },

  reorderTraits(wheelId, newTraits) {
    state = {
      ...state,
      wheels: state.wheels.map(w =>
        w.id === wheelId ? { ...w, traits: newTraits } : w
      ),
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.reorderTraits(wheelId, newTraits.map(t => t.id)));
  },

  // ─── Rarity Tier CRUD ────────────────────────────────────
  addRarityTier({ label, weight = 10, color = '#00f5ff', icon = '❔' }) {
    const tier = { id: crypto.randomUUID(), label, weight, color, icon };
    state = { ...state, rarityTiers: [...state.rarityTiers, tier] };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.createRarityTier(_rarityTierToApiPayload(tier)));
    return tier;
  },

  updateRarityTier(tierId, updates) {
    state = {
      ...state,
      rarityTiers: state.rarityTiers.map(t =>
        t.id === tierId ? { ...t, ...updates } : t
      ),
    };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.updateRarityTier(tierId, updates));
  },

  deleteRarityTier(tierId) {
    state = { ...state, rarityTiers: state.rarityTiers.filter(t => t.id !== tierId) };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.deleteRarityTier(tierId));
  },

  // ─── Session ─────────────────────────────────────────────
  startSession(wheelIds) {
    state = {
      ...state,
      session: {
        id: crypto.randomUUID(),
        wheelIds,
        currentWheelIndex: 0,
        lockedTraits: [],
        backstory: null,
        powerSystem: null,
        startedAt: Date.now(),
      },
    };
    notify();
  },

  lockTrait(wheelId, trait) {
    if (!state.session) return;
    const lockedTraits = [...state.session.lockedTraits, { wheelId, trait, lockedAt: Date.now() }];
    const currentWheelIndex = state.session.currentWheelIndex + 1;
    state = {
      ...state,
      session: { ...state.session, lockedTraits, currentWheelIndex },
    };
    notify();
  },

  setBackstory(text) {
    if (!state.session) return;
    state = { ...state, session: { ...state.session, backstory: text } };
    notify();
  },

  setPowerSystem(powerSystem) {
    if (!state.session) return;
    state = { ...state, session: { ...state.session, powerSystem } };
    notify();
  },

  saveCharacter(name, traits, backstory, powerSystem) {
    // traits: array of { wheelId, trait }, backstory: string|null, powerSystem: object|null
    // Falls back to active session if traits not provided directly
    const finalTraits = traits ?? state.session?.lockedTraits ?? [];
    const finalBackstory = backstory ?? state.session?.backstory ?? null;
    const finalPowerSystem = powerSystem ?? state.session?.powerSystem ?? null;
    const character = {
      id: crypto.randomUUID(),
      name: name || `Character #${state.characters.length + 1}`,
      traits: finalTraits,
      backstory: finalBackstory,
      powerSystem: finalPowerSystem,
      createdAt: Date.now(),
    };
    state = { ...state, characters: [...state.characters, character], session: null };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.createCharacter(_characterToApiPayload(character)));
    return character;
  },

  reorderWheels(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= state.wheels.length) return;
    if (toIndex < 0 || toIndex >= state.wheels.length) return;
    if (fromIndex === toIndex) return;

    const wheels = [...state.wheels];
    const [moved] = wheels.splice(fromIndex, 1);
    wheels.splice(toIndex, 0, moved);

    state = { ...state, wheels };
    saveToStorage();
    notify();
  },

  updateCharacter(charId, updates) {
    state = {
      ...state,
      characters: state.characters.map(c =>
        c.id === charId ? { ...c, ...updates } : c
      )
    };
    saveToStorage();
    notify();
    const updatedChar = state.characters.find(c => c.id === charId);
    if (state.online && updatedChar) {
      _syncInBackground(() => api.updateCharacter(charId, _characterToApiPayload(updatedChar)));
    }
  },

  updateCharacterPower(charId, powerSystem) {
    state = {
      ...state,
      characters: state.characters.map(c =>
        c.id === charId ? { ...c, powerSystem } : c
      )
    };
    saveToStorage();
    notify();
    if (state.online) {
      const updated = state.characters.find(c => c.id === charId);
      if (updated) _syncInBackground(() => api.updateCharacter(charId, _characterToApiPayload(updated)));
    }
  },

  deleteCharacter(charId) {
    state = { ...state, characters: state.characters.filter(c => c.id !== charId) };
    saveToStorage();
    notify();
    if (state.online) _syncInBackground(() => api.deleteCharacter(charId));
  },

  // ─── Wheel Groups CRUD ────────────────────────────────────
  addWheelGroup({ name, icon = '📁', active = true, makeSingleActive = false, wheelIds = [] }) {
    let currentGroups = state.wheelGroups || [];
    if (makeSingleActive) {
      currentGroups = currentGroups.map(g => ({ ...g, active: false }));
    }
    const group = {
      id: crypto.randomUUID(),
      name,
      icon,
      active: true,
      wheelIds: [...wheelIds]
    };
    state = { ...state, wheelGroups: [...currentGroups, group] };
    saveToStorage();
    notify();
    return group;
  },

  selectSingleActiveGroup(groupId) {
    state = {
      ...state,
      wheelGroups: (state.wheelGroups || []).map(g => ({
        ...g,
        active: g.id === groupId
      }))
    };
    saveToStorage();
    notify();
  },

  duplicateWheelGroup(groupId) {
    const original = (state.wheelGroups || []).find(g => g.id === groupId);
    if (!original) return;

    const copy = {
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      icon: original.icon,
      active: true,
      wheelIds: [...original.wheelIds]
    };

    // Make copy active and others inactive
    const updatedGroups = (state.wheelGroups || []).map(g => ({ ...g, active: false }));
    updatedGroups.push(copy);

    state = { ...state, wheelGroups: updatedGroups };
    saveToStorage();
    notify();
    return copy;
  },

  toggleWheelGroupActive(groupId) {
    state = {
      ...state,
      wheelGroups: (state.wheelGroups || []).map(g =>
        g.id === groupId ? { ...g, active: !g.active } : g
      )
    };
    saveToStorage();
    notify();
  },

  updateWheelGroup(groupId, updates) {
    state = {
      ...state,
      wheelGroups: (state.wheelGroups || []).map(g =>
        g.id === groupId ? { ...g, ...updates } : g
      )
    };
    saveToStorage();
    notify();
  },

  deleteWheelGroup(groupId) {
    state = {
      ...state,
      wheelGroups: (state.wheelGroups || []).filter(g => g.id !== groupId)
    };
    saveToStorage();
    notify();
  },

  assignWheelToGroup(wheelId, groupId) {
    state = {
      ...state,
      wheelGroups: (state.wheelGroups || []).map(g => {
        if (g.id === groupId) {
          return { ...g, wheelIds: g.wheelIds.includes(wheelId) ? g.wheelIds : [...g.wheelIds, wheelId] };
        }
        return g;
      })
    };
    saveToStorage();
    notify();
  },

  getActiveWheels() {
    const activeGroups = (state.wheelGroups || []).filter(g => g.active);
    if (activeGroups.length === 0) return state.wheels; // Fallback if no active group

    const activeWheelIds = new Set(activeGroups.flatMap(g => g.wheelIds || []));
    const filtered = state.wheels.filter(w => activeWheelIds.has(w.id));
    return filtered.length > 0 ? filtered : state.wheels;
  },

  clearSession() {
    state = { ...state, session: null };
    notify();
  },
};
