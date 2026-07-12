// ============================================================
// homePage.js — Landing / Dashboard
// ============================================================

import { router } from '../utils/router.js';
import { store } from '../utils/store.js';

export function renderHomePage(container) {
  const state = store.getState();
  const { wheels, characters } = state;

  container.innerHTML = `
    <div class="page page-full">
      <div class="home-hero">
        <div class="home-hero-glow" aria-hidden="true"></div>
        <span class="home-hero-icon" aria-hidden="true">🎡</span>
        <h1>WHEEL OF FATE</h1>
        <p>Roll your destiny. Generate epic characters with weighted randomness, dramatic spins, and shareable short-form videos.</p>
        <div class="home-cta">
          <button class="btn btn-primary btn-lg" id="cta-spin" aria-label="Start spinning the wheel">
            ⚡ Start Spinning
          </button>
          <button class="btn btn-secondary btn-lg" id="cta-builder" aria-label="Open Wheel Builder">
            🎡 Customize Wheels
          </button>
        </div>

        <!-- Quick Stats -->
        <div class="home-stats" aria-label="App statistics">
          <div class="stat-card">
            <span class="stat-number" id="stat-wheels">${wheels.length}</span>
            <span class="stat-label">Wheels Created</span>
          </div>
          <div class="stat-card">
            <span class="stat-number" id="stat-traits">${wheels.reduce((s, w) => s + w.traits.length, 0)}</span>
            <span class="stat-label">Total Traits</span>
          </div>
          <div class="stat-card">
            <span class="stat-number" id="stat-chars">${characters.length}</span>
            <span class="stat-label">Characters Saved</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">4</span>
            <span class="stat-label">Rarity Tiers</span>
          </div>
        </div>
      </div>

      <!-- Wheel Preview Grid -->
      <div class="page" style="padding-top:0;">
        <p class="section-title">🎡 Your Wheels</p>
        <div class="home-wheels-preview" id="wheels-preview" role="list">
          ${wheels.length === 0 ? `
            <div class="empty-state" style="grid-column:1/-1;">
              <span class="empty-state-icon">🎡</span>
              <p>No wheels yet! Create one in the Wheel Builder.</p>
              <button class="btn btn-primary" id="empty-builder-btn">Open Builder</button>
            </div>
          ` : wheels.map(w => `
            <div
              class="wheel-preview-card"
              data-wheel-id="${w.id}"
              role="listitem"
              tabindex="0"
              aria-label="${w.name} wheel with ${w.traits.length} traits"
            >
              <span class="wheel-preview-icon" aria-hidden="true">${w.icon}</span>
              <div class="wheel-preview-name">${escapeHtml(w.name)}</div>
              <div class="wheel-preview-count">${w.traits.length} traits</div>
              <div class="rarity-dist" aria-hidden="true">
                ${buildRarityBar(w.traits)}
              </div>
            </div>
          `).join('')}
          <div
            class="wheel-preview-card"
            id="add-wheel-card"
            role="button"
            tabindex="0"
            aria-label="Add new wheel"
            style="border-style: dashed; display:flex; align-items:center; justify-content:center; min-height:120px; flex-direction:column; gap:8px; color:rgba(255,255,255,0.3);"
          >
            <span style="font-size:32px;">＋</span>
            <span style="font-size:13px;">Add New Wheel</span>
          </div>
        </div>

        <!-- Rarity Legend -->
        <div style="margin-top: 48px;">
          <p class="section-title">🏆 Rarity Tiers</p>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:16px;">
            ${[
              { key: 'common', label: 'Common', weight: '60%', desc: 'The foundation of every hero.' },
              { key: 'rare', label: 'Rare', weight: '30%', desc: 'Something beyond ordinary.' },
              { key: 'legendary', label: 'Legendary', weight: '9%', desc: 'The stuff of songs and tales.' },
              { key: 'mythic', label: 'Mythic', weight: '1%', desc: 'A power that reshapes worlds.' },
            ].map(r => `
              <div class="card" style="padding:20px; border-color: rgba(var(--rarity-${r.key}-rgb, 138,155,168), 0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span class="rarity-badge rarity-${r.key}">${r.label}</span>
                  <span style="font-family:var(--font-display); font-size:18px; color:var(--rarity-${r.key});">${r.weight}</span>
                </div>
                <p style="font-size:12px; color:rgba(255,255,255,0.4);">${r.desc}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // ─── Event Listeners ────────────────────────────────────────
  container.querySelector('#cta-spin')?.addEventListener('click', () => router.navigate('/spin'));
  container.querySelector('#cta-builder')?.addEventListener('click', () => router.navigate('/builder'));
  container.querySelector('#empty-builder-btn')?.addEventListener('click', () => router.navigate('/builder'));
  container.querySelector('#add-wheel-card')?.addEventListener('click', () => router.navigate('/builder'));
  container.querySelector('#add-wheel-card')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') router.navigate('/builder');
  });

  container.querySelectorAll('[data-wheel-id]').forEach(card => {
    card.addEventListener('click', () => router.navigate('/builder'));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') router.navigate('/builder');
    });
  });
}

function buildRarityBar(traits) {
  if (!traits.length) return '';
  const counts = { common: 0, rare: 0, legendary: 0, mythic: 0 };
  traits.forEach(t => { counts[t.rarity] = (counts[t.rarity] || 0) + 1; });
  const total = traits.length;
  const colors = { common: '#8a9ba8', rare: '#00b4ff', legendary: '#ffd700', mythic: '#ff3366' };

  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([key, count]) =>
      `<div class="rarity-dist-segment" style="flex:${count/total}; background:${colors[key]}; opacity:0.7;"></div>`
    ).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
