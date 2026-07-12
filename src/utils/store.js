// ============================================================
// store.js — Global Application State (localStorage backed)
// ============================================================

import { RARITY_TIERS } from './rarity.js';

const STORAGE_KEY = 'wheel_of_fate_v1';

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
      return parsed;
    }
  } catch (e) { /* ignore */ }

  return {
    wheels: DEFAULT_WHEELS,
    characters: [],
    session: null,
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

export const store = {
  getState() { return state; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ─── Wheel CRUD ──────────────────────────────────────────
  addWheel(name, icon = '🎡') {
    const wheel = createWheel(name, icon, []);
    state = { ...state, wheels: [...state.wheels, wheel] };
    saveToStorage();
    notify();
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
  },

  deleteWheel(wheelId) {
    state = { ...state, wheels: state.wheels.filter(w => w.id !== wheelId) };
    saveToStorage();
    notify();
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

  saveCharacter(name, traits, backstory) {
    // traits: array of { wheelId, trait }, backstory: string|null
    // Falls back to active session if traits not provided directly
    const finalTraits = traits ?? state.session?.lockedTraits ?? [];
    const finalBackstory = backstory ?? state.session?.backstory ?? null;
    const character = {
      id: crypto.randomUUID(),
      name: name || `Character #${state.characters.length + 1}`,
      traits: finalTraits,
      backstory: finalBackstory,
      createdAt: Date.now(),
    };
    state = { ...state, characters: [...state.characters, character], session: null };
    saveToStorage();
    notify();
    return character;
  },

  deleteCharacter(charId) {
    state = { ...state, characters: state.characters.filter(c => c.id !== charId) };
    saveToStorage();
    notify();
  },

  clearSession() {
    state = { ...state, session: null };
    notify();
  },
};
