// ============================================================
// spinPage.js — The Main Spin Session UI (9:16 Optimized)
// ============================================================

import { store } from '../utils/store.js';
import { SpinWheel } from '../components/spinWheel.js';
import { RARITY_TIERS } from '../utils/rarity.js';
import { showToast, openModal, closeModal } from '../components/toast.js';
import { router } from '../utils/router.js';

let activeWheelInstance = null;
let sessionState = {
  selectedWheelIds: [],
  currentIndex: 0,
  lockedTraits: [],
  backstory: null,
  isSpinning: false,
  isDone: false,
  isLoadingBackstory: false,
};
let unsubscribeStore = null;

export function renderSpinPage(container) {
  const state = store.getState();

  // Default: all wheels selected
  if (sessionState.selectedWheelIds.length === 0) {
    sessionState.selectedWheelIds = state.wheels.map(w => w.id);
  }

  _render(container, state);
  _bindEvents(container, state);
}

export function unmountSpinPage() {
  if (activeWheelInstance) {
    activeWheelInstance.destroy();
    activeWheelInstance = null;
  }
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
}

// ─── Full Re-render ────────────────────────────────────────────
function _render(container, state) {
  const { wheels } = state;
  const selectedWheels = sessionState.selectedWheelIds
    .map(id => wheels.find(w => w.id === id))
    .filter(Boolean);

  const currentWheel = selectedWheels[sessionState.currentIndex];

  container.innerHTML = `
    <div class="page-full spin-page">

      <!-- ─── 9:16 Viewport ─── -->
      <div class="spin-viewport" id="spin-viewport" role="region" aria-label="Spin arena">

        <!-- Header -->
        <div class="spin-viewport-header">
          <div class="spin-viewport-title">🎡 WHEEL OF FATE</div>
          ${sessionState.isDone
            ? `<div style="font-size:11px; color:var(--green);">✓ Character Complete</div>`
            : currentWheel
              ? `<div style="font-size:11px; color:rgba(255,255,255,0.5);">Rolling: <strong style="color:var(--cyan);">${escapeHtml(currentWheel.name)}</strong></div>`
              : `<div style="font-size:11px; color:rgba(255,255,255,0.4);">Select wheels to begin</div>`
          }
          <!-- Progress bar -->
          <div class="spin-progress-bar" style="margin-top:8px;" aria-label="Spin progress">
            <div class="spin-progress-fill" style="width:${selectedWheels.length ? (sessionState.currentIndex / selectedWheels.length * 100) : 0}%;"></div>
          </div>
        </div>

        <!-- Wheel Canvas Zone -->
        <div class="spin-wheel-zone">
          ${currentWheel && !sessionState.isDone
            ? `<div id="wheel-canvas-container"></div>`
            : sessionState.isDone
              ? `
                <div style="text-align:center; padding:20px;">
                  <div style="font-size:64px; margin-bottom:16px; animation:float 2s ease-in-out infinite;">🏆</div>
                  <div style="font-family:var(--font-display); font-size:16px; color:var(--gold); letter-spacing:2px;">CHARACTER COMPLETE!</div>
                </div>
              `
              : `
                <div style="text-align:center; color:rgba(255,255,255,0.3); padding:20px;">
                  <div style="font-size:48px; margin-bottom:8px;">🎡</div>
                  <div style="font-size:13px;">Select wheels and hit Spin!</div>
                </div>
              `
          }
        </div>

        <!-- Character Card Zone -->
        <div class="spin-card-zone">
          <div class="char-stat-card">
            <div class="char-stat-card-title">Character Stats</div>
            ${sessionState.lockedTraits.length === 0
              ? `<div style="font-size:12px; color:rgba(255,255,255,0.2); text-align:center; padding:16px;">Traits will appear here as you spin…</div>`
              : sessionState.lockedTraits.map(({ wheelId, trait }) => {
                  const whl = store.getState().wheels.find(w => w.id === wheelId);
                  return `
                    <div class="stat-row stat-row-${trait.rarity}" aria-label="${whl?.name ?? 'Trait'}: ${trait.label}">
                      <span class="stat-row-wheel">${whl?.icon ?? ''} ${whl?.name?.slice(0,8) ?? ''}</span>
                      <span class="stat-row-value">${escapeHtml(trait.label)}</span>
                      <span class="rarity-badge rarity-${trait.rarity}" style="font-size:9px; padding:1px 5px;">${RARITY_TIERS[trait.rarity].icon}</span>
                    </div>
                  `;
                }).join('')
            }
            ${sessionState.isDone && sessionState.backstory
              ? `<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border-subtle); font-size:11px; font-style:italic; color:rgba(255,255,255,0.6); line-height:1.5;">"${escapeHtml(sessionState.backstory)}"</div>`
              : ''
            }
          </div>
        </div>
      </div>

      <!-- ─── Right Controls Panel ─── -->
      <div class="spin-controls">

        <!-- Wheel Selector -->
        ${!sessionState.isSpinning && sessionState.lockedTraits.length === 0 ? `
          <div class="spin-wheel-select card" style="padding:20px;" role="group" aria-labelledby="wheel-select-label">
            <p class="section-title" id="wheel-select-label">Select Wheels to Spin</p>
            <div class="wheel-checkbox-grid">
              ${wheels.map(w => `
                <label
                  class="wheel-checkbox-item ${sessionState.selectedWheelIds.includes(w.id) ? 'checked' : ''}"
                  aria-label="${w.name}"
                >
                  <input
                    type="checkbox"
                    ${sessionState.selectedWheelIds.includes(w.id) ? 'checked' : ''}
                    data-wheel-toggle="${w.id}"
                    class="sr-only"
                    aria-label="Include ${w.name} wheel"
                  />
                  <span class="wheel-checkbox-icon" aria-hidden="true">${w.icon}</span>
                  <span class="wheel-checkbox-name">${escapeHtml(w.name)}</span>
                  <div class="custom-checkbox" aria-hidden="true">
                    ${sessionState.selectedWheelIds.includes(w.id) ? '✓' : ''}
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Spin Queue -->
        ${sessionState.lockedTraits.length > 0 || sessionState.isSpinning ? `
          <div class="spin-queue card" style="padding:20px;" role="list" aria-label="Spin queue">
            <p class="section-title">Spin Queue</p>
            ${selectedWheels.map((w, i) => {
              const locked = sessionState.lockedTraits.find(lt => lt.wheelId === w.id);
              const status = locked ? 'done' : (i === sessionState.currentIndex ? 'active' : 'pending');
              const statusIcon = { done: '✅', active: '⚡', pending: '⏳' }[status];
              return `
                <div class="spin-queue-item ${status}" role="listitem" aria-label="${w.name}: ${status}">
                  <span class="spin-queue-status" aria-hidden="true">${statusIcon}</span>
                  <span class="spin-queue-name">${escapeHtml(w.name)}</span>
                  ${locked ? `<span class="rarity-badge rarity-${locked.trait.rarity}" style="margin-left:auto; font-size:9px;">${escapeHtml(locked.trait.label)}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${!sessionState.isDone ? `
            <button
              class="btn btn-primary btn-lg"
              id="spin-btn"
              ${sessionState.isSpinning || !currentWheel || sessionState.selectedWheelIds.length === 0 ? 'disabled' : ''}
              aria-label="Spin the wheel"
            >
              ${sessionState.isSpinning
                ? `<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Spinning…`
                : `⚡ SPIN ${currentWheel ? escapeHtml(currentWheel.name) : ''}`
              }
            </button>

            ${!sessionState.isSpinning && currentWheel && selectedWheels.length > 1 ? `
              <button class="btn btn-secondary" id="auto-spin-btn" aria-label="Auto spin all wheels">
                🚀 Auto-Spin All
              </button>
            ` : ''}

            ${sessionState.lockedTraits.length > 0 && !sessionState.isSpinning ? `
              <button class="btn btn-ghost" id="reset-btn" aria-label="Reset session">🔄 Reset Session</button>
            ` : ''}
          ` : `
            ${!sessionState.backstory && !sessionState.isLoadingBackstory ? `
              <button class="btn btn-secondary btn-lg" id="backstory-btn" aria-label="Generate AI backstory">
                ✨ Generate Backstory
              </button>
            ` : sessionState.isLoadingBackstory ? `
              <button class="btn btn-secondary btn-lg" disabled>
                <span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Generating…
              </button>
            ` : ''}
            <button class="btn btn-primary btn-lg" id="save-char-btn" aria-label="Save this character">💾 Save Character</button>
            <button class="btn btn-ghost" id="reset-btn" aria-label="Start over">🔄 Start Over</button>
          `}

          ${sessionState.lockedTraits.length > 0 || sessionState.isDone ? `
            <button class="btn btn-ghost btn-sm" id="export-stub-btn" aria-label="Export as video (coming soon)">
              🎬 Export as Short (Phase 3)
            </button>
          ` : ''}
        </div>

        <!-- Result Highlight (after done) -->
        ${sessionState.isDone && sessionState.lockedTraits.length > 0 ? `
          <div class="backstory-card" style="margin-top:0;">
            <p class="section-title">🏆 Final Character Sheet</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${sessionState.lockedTraits.map(({ wheelId, trait }) => {
                const whl = store.getState().wheels.find(w => w.id === wheelId);
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.3); border-radius:8px; border-left:3px solid ${RARITY_TIERS[trait.rarity].color};">
                    <span style="font-size:12px; color:rgba(255,255,255,0.45);">${whl?.icon ?? ''} ${whl?.name ?? ''}</span>
                    <span style="font-size:14px; font-weight:600;">${escapeHtml(trait.label)}</span>
                    <span class="rarity-badge rarity-${trait.rarity}">${RARITY_TIERS[trait.rarity].icon} ${RARITY_TIERS[trait.rarity].label}</span>
                  </div>
                `;
              }).join('')}
            </div>
            ${sessionState.backstory ? `
              <div style="margin-top:16px; padding:16px; background:rgba(191,0,255,0.08); border-radius:12px; border:1px solid rgba(191,0,255,0.2);">
                <p style="font-size:11px; color:var(--purple); letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">AI Backstory</p>
                <p class="backstory-text">"${escapeHtml(sessionState.backstory)}"</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Mount the canvas wheel after DOM is ready
  if (currentWheel && !sessionState.isDone) {
    _mountWheel(currentWheel);
  }
}

// ─── Mount Canvas Wheel ────────────────────────────────────────
function _mountWheel(wheel) {
  const canvasContainer = document.getElementById('wheel-canvas-container');
  if (!canvasContainer) return;

  if (activeWheelInstance) {
    activeWheelInstance.destroy();
    activeWheelInstance = null;
  }

  const viewport = document.getElementById('spin-viewport');
  const vpWidth = viewport?.offsetWidth ?? 400;
  const size = Math.min(vpWidth - 40, 320);

  activeWheelInstance = new SpinWheel(canvasContainer, wheel, {
    size,
    onLand: () => {},
  });
}

// ─── Bind Events ───────────────────────────────────────────────
function _bindEvents(container, state) {
  const { wheels } = state;

  // Wheel toggles
  container.querySelectorAll('[data-wheel-toggle]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const wid = checkbox.dataset.wheelToggle;
      if (checkbox.checked) {
        if (!sessionState.selectedWheelIds.includes(wid)) {
          sessionState.selectedWheelIds = [...sessionState.selectedWheelIds, wid];
        }
      } else {
        sessionState.selectedWheelIds = sessionState.selectedWheelIds.filter(id => id !== wid);
      }
      _render(container, store.getState());
      _bindEvents(container, store.getState());
    });
  });

  // Spin button
  container.querySelector('#spin-btn')?.addEventListener('click', () => _doSpin(container));

  // Auto-spin
  container.querySelector('#auto-spin-btn')?.addEventListener('click', () => _doAutoSpin(container));

  // Reset
  container.querySelector('#reset-btn')?.addEventListener('click', () => {
    if (activeWheelInstance) { activeWheelInstance.destroy(); activeWheelInstance = null; }
    sessionState = {
      selectedWheelIds: state.wheels.map(w => w.id),
      currentIndex: 0,
      lockedTraits: [],
      backstory: null,
      isSpinning: false,
      isDone: false,
      isLoadingBackstory: false,
    };
    _render(container, store.getState());
    _bindEvents(container, store.getState());
  });

  // Backstory
  container.querySelector('#backstory-btn')?.addEventListener('click', () => _generateBackstory(container));

  // Save character
  container.querySelector('#save-char-btn')?.addEventListener('click', () => _saveCharacter());

  // Export stub
  container.querySelector('#export-stub-btn')?.addEventListener('click', () => {
    showToast('🎬 Video export coming in Phase 3! Build complete when Remotion is set up.', 'info', 4000);
  });
}

// ─── Spin Action ──────────────────────────────────────────────
async function _doSpin(container) {
  if (!activeWheelInstance || sessionState.isSpinning) return;

  const state = store.getState();
  const selectedWheels = sessionState.selectedWheelIds
    .map(id => state.wheels.find(w => w.id === id))
    .filter(Boolean);

  const currentWheel = selectedWheels[sessionState.currentIndex];
  if (!currentWheel) return;

  if (!currentWheel.traits || currentWheel.traits.length === 0) {
    showToast(`"${currentWheel.name}" has no traits! Add some in the Builder.`, 'error');
    return;
  }

  sessionState.isSpinning = true;
  _updateSpinBtn(true);

  try {
    const { trait } = await activeWheelInstance.spin();

    // Lock the trait
    sessionState.lockedTraits.push({ wheelId: currentWheel.id, trait });
    sessionState.currentIndex++;
    sessionState.isSpinning = false;

    if (sessionState.currentIndex >= selectedWheels.length) {
      sessionState.isDone = true;
    }

    _render(container, store.getState());
    _bindEvents(container, store.getState());

    showToast(
      `${RARITY_TIERS[trait.rarity].icon} ${trait.rarity.toUpperCase()}: "${trait.label}"`,
      trait.rarity === 'mythic' || trait.rarity === 'legendary' ? 'success' : 'info',
      3000
    );
  } catch (e) {
    sessionState.isSpinning = false;
    _updateSpinBtn(false);
  }
}

// ─── Auto-Spin ────────────────────────────────────────────────
async function _doAutoSpin(container) {
  const state = store.getState();
  const selectedWheels = sessionState.selectedWheelIds
    .map(id => state.wheels.find(w => w.id === id))
    .filter(Boolean);

  while (sessionState.currentIndex < selectedWheels.length) {
    const currentWheel = selectedWheels[sessionState.currentIndex];
    if (!currentWheel?.traits?.length) { sessionState.currentIndex++; continue; }

    await _doSpin(container);
    if (!sessionState.isDone) {
      // Brief pause between wheels for suspense
      await sleep(800);
    }
  }
}

// ─── AI Backstory ─────────────────────────────────────────────
async function _generateBackstory(container) {
  sessionState.isLoadingBackstory = true;
  _render(container, store.getState());
  _bindEvents(container, store.getState());

  try {
    const traitSummary = sessionState.lockedTraits
      .map(({ wheelId, trait }) => {
        const whl = store.getState().wheels.find(w => w.id === wheelId);
        return `${whl?.name ?? 'Trait'}: ${trait.label} (${trait.rarity})`;
      })
      .join(', ');

    // Try OpenAI if key is available, otherwise use local generator
    const apiKey = localStorage.getItem('openai_api_key');
    if (apiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 120,
          messages: [{
            role: 'user',
            content: `Create a 2-sentence epic or humorous fantasy backstory for a character with these traits: ${traitSummary}. Make it punchy, dramatic, and shareable. No preamble.`,
          }],
        }),
      });
      const data = await response.json();
      sessionState.backstory = data.choices?.[0]?.message?.content?.trim() ?? _localBackstory(sessionState.lockedTraits);
    } else {
      // Local fallback
      await sleep(1200); // simulate thinking
      sessionState.backstory = _localBackstory(sessionState.lockedTraits);
    }
  } catch (e) {
    sessionState.backstory = _localBackstory(sessionState.lockedTraits);
  }

  sessionState.isLoadingBackstory = false;
  store.setBackstory(sessionState.backstory);
  _render(container, store.getState());
  _bindEvents(container, store.getState());
}

function _localBackstory(lockedTraits) {
  const traits = lockedTraits.map(lt => lt.trait.label);
  const mythic = lockedTraits.find(lt => lt.trait.rarity === 'mythic');
  const legendary = lockedTraits.find(lt => lt.trait.rarity === 'legendary');
  const rarest = mythic ?? legendary;

  const intros = [
    "Born under a collapsing star,",
    "Forged in the crucible of forgotten wars,",
    "Cursed before they drew their first breath,",
    "Once mortal, now something far more dangerous,",
  ];
  const middles = [
    `they wielded ${traits[2] ?? traits[0]} like a surgeon wields a scalpel—`,
    `the ${traits[0] ?? 'world'} never prepared for what they would become—`,
    `destiny chose them not for heroism but for necessity—`,
  ];
  const endings = [
    rarest ? `and ${rarest.trait.label} would be the last thing their enemies ever saw.`
           : `but their greatest enemy was always the darkness within.`,
    `a legend not yet written, a fate not yet decided.`,
    `the universe itself held its breath and watched.`,
  ];

  return `${intros[Math.floor(Math.random()*intros.length)]} ${middles[Math.floor(Math.random()*middles.length)]} ${endings[Math.floor(Math.random()*endings.length)]}`;
}

// ─── Save Character ────────────────────────────────────────────
function _saveCharacter() {
  openModal({
    title: '💾 Save Character',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:6px;">Character Name</label>
          <input class="input" id="char-name-input" type="text" placeholder="Give your character a name…" maxlength="60" autofocus />
        </div>
        <div style="display:flex; gap:12px; margin-top:8px;">
          <button class="btn btn-primary" id="confirm-save-btn" style="flex:1;">💾 Save</button>
          <button class="btn btn-ghost" id="cancel-save-btn">Cancel</button>
        </div>
      </div>
    `,
  });

  document.querySelector('#confirm-save-btn')?.addEventListener('click', () => {
    const name = document.querySelector('#char-name-input')?.value.trim();
    const character = store.saveCharacter(name, sessionState.lockedTraits, sessionState.backstory);
    closeModal();
    showToast(`Character "${character.name}" saved!`, 'success');

    // Reset session
    sessionState = {
      selectedWheelIds: store.getState().wheels.map(w => w.id),
      currentIndex: 0,
      lockedTraits: [],
      backstory: null,
      isSpinning: false,
      isDone: false,
      isLoadingBackstory: false,
    };

    router.navigate('/characters');
  });

  document.querySelector('#cancel-save-btn')?.addEventListener('click', closeModal);
  document.querySelector('#char-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.querySelector('#confirm-save-btn')?.click();
  });
}

// ─── Utilities ─────────────────────────────────────────────────
function _updateSpinBtn(spinning) {
  const btn = document.querySelector('#spin-btn');
  if (!btn) return;
  btn.disabled = spinning;
  btn.innerHTML = spinning
    ? `<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Spinning…`
    : btn.innerHTML;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
