// ============================================================
// api.js — Thin fetch wrapper for the optional Express backend
// ============================================================

const API_BASE = '/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

export const api = {
  // Render jobs (Stage 2)
  startRenderJob(payload) {
    return apiPost('/render', payload);
  },
  getRenderJob(jobId) {
    return apiGet(`/render/${jobId}`);
  },

  // Wheels/characters (Stage 4)
  getWheels() {
    return apiGet('/wheels');
  },
  createWheel(wheel) {
    return apiPost('/wheels', wheel);
  },
  updateWheel(id, updates) {
    return apiPut(`/wheels/${id}`, updates);
  },
  deleteWheel(id) {
    return apiDelete(`/wheels/${id}`);
  },
  createTrait(wheelId, trait) {
    return apiPost(`/wheels/${wheelId}/traits`, trait);
  },
  updateTrait(wheelId, traitId, updates) {
    return apiPut(`/wheels/${wheelId}/traits/${traitId}`, updates);
  },
  deleteTrait(wheelId, traitId) {
    return apiDelete(`/wheels/${wheelId}/traits/${traitId}`);
  },
  reorderTraits(wheelId, traitIds) {
    return apiPut(`/wheels/${wheelId}/traits/reorder`, { traitIds });
  },
  getCharacters() {
    return apiGet('/characters');
  },
  createCharacter(character) {
    return apiPost('/characters', character);
  },
  deleteCharacter(id) {
    return apiDelete(`/characters/${id}`);
  },

  // Rarity tiers
  getRarityTiers() {
    return apiGet('/rarity-tiers');
  },
  createRarityTier(tier) {
    return apiPost('/rarity-tiers', tier);
  },
  updateRarityTier(id, updates) {
    return apiPut(`/rarity-tiers/${id}`, updates);
  },
  deleteRarityTier(id) {
    return apiDelete(`/rarity-tiers/${id}`);
  },
};
