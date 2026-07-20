// ============================================================
// spinPage.js — The Main Spin Session UI (9:16 Optimized)
// ============================================================

import { store } from '../utils/store.js';
import { SpinWheel } from '../components/spinWheel.js';
import { getTierById, getTierIntensity, isDramaticTier, hexToRgba, renderRpgStatsSheet, proceduralFallbackPowerSystem } from '../utils/rarity.js';
import { showToast, openModal, closeModal } from '../components/toast.js';
import { router } from '../utils/router.js';
import { api } from '../utils/api.js';
import { requireApiKey, callAiChat, cleanAndParseJson } from '../utils/ai.js';

let activeWheelInstance = null;
let activeCardTab = 'traits'; // 'traits' | 'powers'
let sessionState = {
  selectedGroupId: null,
  folderWheelSelections: {}, // { [groupId]: { [wheelId]: boolean } }
  selectedWheelIds: [],
  currentIndex: 0,
  lockedTraits: [],
  backstory: null,
  powerSystem: null,
  isSpinning: false,
  isDone: false,
  isLoadingBackstory: false,
};
let unsubscribeStore = null;

export function renderSpinPage(container) {
  _updateSpinPage(container);

  if (unsubscribeStore) unsubscribeStore();
  unsubscribeStore = store.subscribe(() => {
    _updateSpinPage(container);
  });
}

function _updateSpinPage(container) {
  const state = store.getState();
  const wheelGroups = state.wheelGroups || [];

  if (!sessionState.selectedGroupId || !wheelGroups.some(g => g.id === sessionState.selectedGroupId)) {
    sessionState.selectedGroupId = wheelGroups.find(g => g.active)?.id || wheelGroups[0]?.id || null;
  }

  const selectedGroup = wheelGroups.find(g => g.id === sessionState.selectedGroupId);
  if (selectedGroup) {
    if (!sessionState.folderWheelSelections[selectedGroup.id]) {
      sessionState.folderWheelSelections[selectedGroup.id] = {};
      (selectedGroup.wheelIds || []).forEach(wId => {
        sessionState.folderWheelSelections[selectedGroup.id][wId] = true;
      });
    }

    const groupSel = sessionState.folderWheelSelections[selectedGroup.id];
    sessionState.selectedWheelIds = (selectedGroup.wheelIds || []).filter(wId => groupSel[wId] !== false);
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
  const { wheels, rarityTiers: tiers } = state;
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
        <div class="spin-card-zone" style="overflow-y:auto; max-height:240px;">
          <div class="char-stat-card">
            ${sessionState.isDone && sessionState.backstory ? `
              <!-- Tabs Header -->
              <div class="spin-card-tabs" style="display:flex; border-bottom:1px solid var(--border-subtle); margin-bottom:12px; gap:8px;">
                <button class="tab-btn" id="tab-traits-btn" style="flex:1; background:transparent; border:none; border-bottom:2px solid ${activeCardTab === 'traits' ? 'var(--cyan)' : 'transparent'}; padding:8px 0; color:${activeCardTab === 'traits' ? '#fff' : 'rgba(255,255,255,0.45)'}; font-family:var(--font-display); font-size:11px; font-weight:700; letter-spacing:1px; cursor:pointer; outline:none; transition:all var(--transition-fast);">
                  TRAITS
                </button>
                <button class="tab-btn" id="tab-powers-btn" style="flex:1; background:transparent; border:none; border-bottom:2px solid ${activeCardTab === 'powers' ? 'var(--cyan)' : 'transparent'}; padding:8px 0; color:${activeCardTab === 'powers' ? '#fff' : 'rgba(255,255,255,0.45)'}; font-family:var(--font-display); font-size:11px; font-weight:700; letter-spacing:1px; cursor:pointer; outline:none; transition:all var(--transition-fast);">
                  POWER SHEET
                </button>
              </div>
            ` : `
              <div class="char-stat-card-title">Character Stats</div>
            `}

            ${activeCardTab === 'traits' || !sessionState.backstory ? `
              <!-- Traits List -->
              ${sessionState.lockedTraits.length === 0
                ? `<div style="font-size:12px; color:rgba(255,255,255,0.2); text-align:center; padding:16px;">Traits will appear here as you spin…</div>`
                : sessionState.lockedTraits.map(({ wheelId, trait }) => {
                    const whl = store.getState().wheels.find(w => w.id === wheelId);
                    const tier = getTierById(tiers, trait.rarity);
                    return `
                      <div class="stat-row" style="border-left-color:${tier.color};" aria-label="${whl?.name ?? 'Trait'}: ${trait.label}">
                        <span class="stat-row-wheel">${whl?.icon ?? ''} ${whl?.name?.slice(0,8) ?? ''}</span>
                        <span class="stat-row-value">${escapeHtml(trait.label)}</span>
                        <span class="rarity-badge ${isDramaticTier(tiers, trait.rarity) ? 'rarity-badge-dramatic' : ''}" style="font-size:9px; padding:1px 5px; background:${hexToRgba(tier.color, 0.15)}; color:${tier.color}; border:1px solid ${hexToRgba(tier.color, 0.4)};"><span class="rarity-dot" style="background:${tier.color};"></span></span>
                      </div>
                    `;
                  }).join('')
              }
            ` : `
              <!-- RPG Power Stats Sheet -->
              ${renderRpgStatsSheet(sessionState.powerSystem, sessionState.backstory)}
            `}
          </div>
        </div>
      </div>

      <!-- ─── Right Controls Panel ─── -->
      <div class="spin-controls">

        <!-- Wheel Selector -->
        ${!sessionState.isSpinning && sessionState.lockedTraits.length === 0 ? `
          <div class="spin-wheel-select card" style="padding:20px;" role="group" aria-labelledby="wheel-select-label">
            
            <!-- Folder Package Selector -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); flex-wrap:wrap; gap:8px;">
              <span style="font-size:12px; color:var(--gold); font-weight:700; display:flex; align-items:center; gap:6px;">
                📁 Wheel Folder:
              </span>
              <select id="spin-folder-select" class="input" style="font-size:12px; padding:4px 8px; border-radius:6px; background:rgba(12,14,24,0.9); border:1px solid rgba(255,255,255,0.15); max-width:220px;">
                ${(state.wheelGroups || []).map(g => {
                  const validCount = (g.wheelIds || []).filter(wId => state.wheels.some(w => w.id === wId)).length;
                  return `
                    <option value="${g.id}" ${g.id === sessionState.selectedGroupId ? 'selected' : ''}>
                      ${g.icon ?? '📁'} ${escapeHtml(g.name)} (${validCount} wheel${validCount !== 1 ? 's' : ''})
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <p class="section-title" id="wheel-select-label">Select Wheels to Spin (${sessionState.selectedWheelIds.length})</p>
            <div class="wheel-checkbox-grid">
              ${(() => {
                const grp = (state.wheelGroups || []).find(g => g.id === sessionState.selectedGroupId);
                const folderWheels = grp
                  ? wheels.filter(w => (grp.wheelIds || []).includes(w.id))
                  : wheels;

                return folderWheels.map(w => `
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
                `).join('');
              })()}
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
              const lockedTierStyle = locked
                ? (() => {
                    const t = getTierById(tiers, locked.trait.rarity);
                    return `background:${hexToRgba(t.color, 0.15)}; color:${t.color}; border:1px solid ${hexToRgba(t.color, 0.4)};`;
                  })()
                : '';
              return `
                <div class="spin-queue-item ${status}" role="listitem" aria-label="${w.name}: ${status}">
                  <span class="spin-queue-status" aria-hidden="true">${statusIcon}</span>
                  <span class="spin-queue-name">${escapeHtml(w.name)}</span>
                  ${locked ? `<span class="rarity-badge" style="margin-left:auto; font-size:9px; ${lockedTierStyle}">${escapeHtml(locked.trait.label)}</span>` : ''}
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
            <button class="btn btn-ghost btn-sm" id="export-video-btn" aria-label="Export as video">
              🎬 Export as Short
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
                const tier = getTierById(tiers, trait.rarity);
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.3); border-radius:8px; border-left:3px solid ${tier.color};">
                    <span style="font-size:12px; color:rgba(255,255,255,0.45);">${whl?.icon ?? ''} ${whl?.name ?? ''}</span>
                    <span style="font-size:14px; font-weight:600;">${escapeHtml(trait.label)}</span>
                    <span class="rarity-badge ${isDramaticTier(tiers, trait.rarity) ? 'rarity-badge-dramatic' : ''}" style="background:${hexToRgba(tier.color, 0.15)}; color:${tier.color}; border:1px solid ${hexToRgba(tier.color, 0.4)};"><span class="rarity-dot" style="background:${tier.color};"></span> ${escapeHtml(tier.label)}</span>
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
    tiers: store.getState().rarityTiers,
    onLand: () => {},
  });
}

// ─── Bind Events ───────────────────────────────────────────────
function _bindEvents(container, state) {
  const { wheels } = state;

  // Wheel toggles
  container.querySelectorAll('[data-wheel-toggle]').forEach(checkbox => {
    checkbox.onchange = () => {
      const wid = checkbox.dataset.wheelToggle;
      if (checkbox.checked) {
        if (!sessionState.selectedWheelIds.includes(wid)) {
          sessionState.selectedWheelIds = [...sessionState.selectedWheelIds, wid];
        }
      } else {
        sessionState.selectedWheelIds = sessionState.selectedWheelIds.filter(id => id !== wid);
      }
      _updateSpinPage(container);
    };
  });

  // Spin folder select
  const folderSelect = container.querySelector('#spin-folder-select');
  if (folderSelect) {
    folderSelect.onchange = () => {
      sessionState.selectedGroupId = folderSelect.value;
      sessionState.currentIndex = 0;
      _updateSpinPage(container);
    };
  }

  // Individual wheel toggles per folder
  container.querySelectorAll('[data-toggle-spin-wheel]').forEach(btn => {
    btn.onclick = () => {
      const wId = btn.dataset.toggleSpinWheel;
      const grpId = sessionState.selectedGroupId;
      if (!sessionState.folderWheelSelections[grpId]) {
        sessionState.folderWheelSelections[grpId] = {};
      }
      const current = sessionState.folderWheelSelections[grpId][wId] !== false;
      sessionState.folderWheelSelections[grpId][wId] = !current;
      sessionState.currentIndex = 0;
      _updateSpinPage(container);
    };
  });

  // Spin button
  const spinBtn = container.querySelector('#spin-btn');
  if (spinBtn) spinBtn.onclick = () => _doSpin(container);

  // Auto-spin
  const autoSpinBtn = container.querySelector('#auto-spin-btn');
  if (autoSpinBtn) autoSpinBtn.onclick = () => _doAutoSpin(container);

  // Reset
  const resetBtn = container.querySelector('#reset-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (activeWheelInstance) { activeWheelInstance.destroy(); activeWheelInstance = null; }
      activeCardTab = 'traits';
      sessionState = {
        selectedWheelIds: state.wheels.map(w => w.id),
        currentIndex: 0,
        lockedTraits: [],
        backstory: null,
        powerSystem: null,
        isSpinning: false,
        isDone: false,
        isLoadingBackstory: false,
      };
      _updateSpinPage(container);
    };
  }

  // Backstory
  const backstoryBtn = container.querySelector('#backstory-btn');
  if (backstoryBtn) backstoryBtn.onclick = () => _generateBackstory(container);

  // Save character
  const saveCharBtn = container.querySelector('#save-char-btn');
  if (saveCharBtn) saveCharBtn.onclick = () => _saveCharacter();

  // Export video
  const exportVideoBtn = container.querySelector('#export-video-btn');
  if (exportVideoBtn) exportVideoBtn.onclick = () => _exportVideo();

  // Tab Switchers
  const tabTraitsBtn = container.querySelector('#tab-traits-btn');
  if (tabTraitsBtn) {
    tabTraitsBtn.onclick = () => {
      activeCardTab = 'traits';
      _updateSpinPage(container);
    };
  }

  const tabPowersBtn = container.querySelector('#tab-powers-btn');
  if (tabPowersBtn) {
    tabPowersBtn.onclick = () => {
      activeCardTab = 'powers';
      _updateSpinPage(container);
    };
  }
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

    // Hold on the landed wheel for a beat before advancing the UI, so
    // there's actually time to read what it landed on.
    await sleep(900);

    // Lock the trait
    sessionState.lockedTraits.push({ wheelId: currentWheel.id, trait });
    sessionState.currentIndex++;
    sessionState.isSpinning = false;

    if (sessionState.currentIndex >= selectedWheels.length) {
      sessionState.isDone = true;
    }

    _render(container, store.getState());
    _bindEvents(container, store.getState());

    const landedTier = getTierById(store.getState().rarityTiers, trait.rarity);
    showToast(
      `${landedTier.label.toUpperCase()}: "${trait.label}"`,
      isDramaticTier(store.getState().rarityTiers, trait.rarity) ? 'success' : 'info',
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
  const runWithApiKey = async (apiKey) => {
    const tiers = store.getState().rarityTiers;
    sessionState.isLoadingBackstory = true;
    _render(container, store.getState());
    _bindEvents(container, store.getState());

    try {
      const precalculated = proceduralFallbackPowerSystem(sessionState.lockedTraits, tiers, store.getState().wheels);
      const baselinePower = precalculated.stats.combatPower;

      const traitSummary = sessionState.lockedTraits
        .map(({ wheelId, trait }) => {
          const whl = store.getState().wheels.find(w => w.id === wheelId);
          const tier = getTierById(tiers, trait.rarity);
          return `${whl?.name ?? 'Trait'}: ${trait.label} (${tier.label})`;
        })
        .join(', ');

      const systemPrompt = `You are a creative writer and RPG rules designer. Generate a combined fantasy backstory and power system evaluation for a character with these traits: ${traitSummary}.
Important context: This application is a character generator, RPG combat simulator, and fantasy trait builder. If any trait category/wheel represents a theme that is ambiguous (like 'race', 'class', etc.), interpret it strictly in a fantasy/RPG character context (e.g. 'race' refers to fantasy species like Elf, Dwarf, Orc, Human, rather than car racing).

Mathematical Constraint: The strict mathematical baseline evaluation for this character's Potential is ${baselinePower} / 100 based on positive bonuses and negative weakness penalties. You MUST set "combatPower" in stats to ${baselinePower} (or within 2 points of ${baselinePower}) and explain how negative traits (weaknesses/penalties) hamper them in ratingExpl.

Return a raw, unformatted JSON object matching this schema (do NOT wrap in markdown code blocks, do NOT include preamble):
{
  "backstory": "An epic, high-quality 3-sentence narrative weaving their traits and fatal weakness.",
  "powerSystem": {
    "systemName": "E.g. Nen, Chakra, Stand, Ki, Mana, or a thematic power system name",
    "classOrType": "E.g. wind manipulator, enhancer, conjurer, elementalist",
    "synergyRating": "${precalculated.synergyRating}",
    "stats": {
      "combatPower": ${baselinePower},
      "strength": 1-100,
      "defense": 1-100,
      "speed": 1-100,
      "energy": 1-100,
      "tactics": 1-100
    },
    "traitRoles": {
      "TRAIT_LABEL_1": "positive" | "negative",
      "TRAIT_LABEL_2": "positive" | "negative"
    },
    "ratingExpl": "A 2-sentence explanation focusing explicitly on combat utility. Detail how their primary special power is amplified by positive traits, and how their negative traits (weaknesses/penalties) hamper them in battle."
  }
}`;

      const apiUrl = localStorage.getItem('openai_api_url') || 'https://api.groq.com/openai/v1';
      const modelName = localStorage.getItem('openai_model') || 'llama-3.1-8b-instant';

      const requestBody = {
        model: modelName,
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: systemPrompt,
        }],
      };

      if (apiUrl.includes('api.openai.com') || apiUrl.includes('groq.com') || apiUrl.includes('openrouter.ai')) {
        requestBody.response_format = { type: "json_object" };
      }

      const content = await callAiChat(apiUrl, apiKey, requestBody);
      const parsed = _parseBackstoryResponse(content);

      if (parsed && parsed.backstory) {
        sessionState.backstory = parsed.backstory;
        sessionState.powerSystem = {
          ...precalculated,
          ...parsed.powerSystem,
          stats: {
            ...precalculated.stats,
            ...(parsed.powerSystem?.stats || {}),
            combatPower: baselinePower
          },
          rawPower: precalculated.rawPower,
          maxPotentialPL: precalculated.maxPotentialPL,
          breakdown: precalculated.breakdown
        };
      } else {
        throw new Error('No backstory text could be extracted from the response.');
      }
    } catch (e) {
      console.error('Error generating backstory/power system, falling back to local generator:', e);
      showToast(`AI Notice: ${e.message}`, 'info', 5000);
      sessionState.backstory = _localBackstory(sessionState.lockedTraits);
      sessionState.powerSystem = proceduralFallbackPowerSystem(sessionState.lockedTraits, store.getState().rarityTiers, store.getState().wheels);
    }

    sessionState.isLoadingBackstory = false;
    store.setBackstory(sessionState.backstory);
    store.setPowerSystem(sessionState.powerSystem);
    
    // Auto-switch to power tab
    activeCardTab = 'powers';

    _render(container, store.getState());
    _bindEvents(container, store.getState());
  };

  const runFreeFallback = async () => {
    sessionState.isLoadingBackstory = true;
    _render(container, store.getState());
    _bindEvents(container, store.getState());

    await sleep(1500); // simulate thinking

    sessionState.backstory = _localBackstory(sessionState.lockedTraits);
    sessionState.powerSystem = proceduralFallbackPowerSystem(sessionState.lockedTraits, store.getState().rarityTiers, store.getState().wheels);

    sessionState.isLoadingBackstory = false;
    store.setBackstory(sessionState.backstory);
    store.setPowerSystem(sessionState.powerSystem);
    
    // Auto-switch to power tab
    activeCardTab = 'powers';

    _render(container, store.getState());
    _bindEvents(container, store.getState());
  };

  await requireApiKey(runWithApiKey, runFreeFallback);
}



function _localBackstory(lockedTraits) {
  const tiers = store.getState().rarityTiers;
  const traits = lockedTraits.map(lt => lt.trait.label);
  const rarest = [...lockedTraits]
    .filter(lt => isDramaticTier(tiers, lt.trait.rarity))
    .sort((a, b) => getTierIntensity(tiers, b.trait.rarity) - getTierIntensity(tiers, a.trait.rarity))[0];

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
    const character = store.saveCharacter(name, sessionState.lockedTraits, sessionState.backstory, sessionState.powerSystem);
    closeModal();
    showToast(`Character "${character.name}" saved!`, 'success');

    activeCardTab = 'traits';
    // Reset session
    sessionState = {
      selectedWheelIds: store.getState().wheels.map(w => w.id),
      currentIndex: 0,
      lockedTraits: [],
      backstory: null,
      powerSystem: null,
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

// ─── Export Video ──────────────────────────────────────────────
async function _exportVideo() {
  const tiers = store.getState().rarityTiers;
  const wheels = store.getState().wheels;
  const traits = sessionState.lockedTraits.map(({ wheelId, trait }) => {
    const whl = wheels.find(w => w.id === wheelId);
    const tier = getTierById(tiers, trait.rarity);
    const wheelTraits = whl?.traits ?? [];
    const winnerIndex = Math.max(0, wheelTraits.findIndex(t => t.id === trait.id));
    // Full segment list (not just the winner) so the export video can show
    // the actual wheel spinning and landing, not just a static result card.
    const segments = wheelTraits.map(t => {
      const segTier = getTierById(tiers, t.rarity);
      return {
        label: t.label,
        color: segTier.color,
        weight: segTier.weight,
        dramatic: isDramaticTier(tiers, t.rarity),
      };
    });
    return {
      wheelName: whl?.name ?? '',
      wheelIcon: whl?.icon ?? '',
      label: trait.label,
      color: tier.color,
      rarityLabel: tier.label,
      intensity: getTierIntensity(tiers, trait.rarity),
      segments,
      winnerIndex,
    };
  });

  let jobId;
  try {
    const job = await api.startRenderJob({
      characterName: 'My Character',
      traits,
      backstory: sessionState.backstory,
      powerSystem: sessionState.powerSystem,
    });
    jobId = job.jobId;
  } catch (e) {
    showToast("🎬 Video export server isn't running. Start `npm start` in /server.", 'error', 5000);
    return;
  }

  openModal({
    title: '🎬 Rendering Your Short',
    content: `<div id="render-progress" style="text-align:center; padding:20px; font-size:14px; color:rgba(255,255,255,0.7);">Queued…</div>`,
  });

  const poll = setInterval(async () => {
    let job;
    try {
      job = await api.getRenderJob(jobId);
    } catch (e) {
      clearInterval(poll);
      showToast('Lost connection to the render server.', 'error');
      closeModal();
      return;
    }

    const progressEl = document.querySelector('#render-progress');

        if (job.status === 'queued' || job.status === 'rendering') {
      if (progressEl) {
        progressEl.textContent = `${job.status}… ${Math.round((job.progress ?? 0) * 100)}%`;
      }
    } else if (job.status === 'done') {
      clearInterval(poll);
      if (progressEl) {
        progressEl.outerHTML = `
          <div style="display:flex; flex-direction:column; gap:16px; align-items:center; width:100%;">
            <div style="font-size:12px; color:rgba(255,255,255,0.5); text-align:center;">🎬 Preview Your Short:</div>
            <video src="${job.downloadUrl}" controls autoplay style="width:100%; max-width:240px; aspect-ratio:9/16; border-radius:12px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 10px 30px rgba(0,0,0,0.6); background:#000;"></video>
            <div style="display:flex; gap:12px; width:100%; margin-top:8px;">
              <a class="btn btn-primary" href="${job.downloadUrl}?download=1" download style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">⬇ Download MP4</a>
              <button class="btn btn-ghost" id="close-render-preview-btn" style="flex:1;">Close</button>
            </div>
          </div>
        `;
        document.querySelector('#close-render-preview-btn')?.addEventListener('click', closeModal);
      }
    } else if (job.status === 'error') {
      clearInterval(poll);
      showToast(`Render failed${job.error ? `: ${job.error}` : '.'}`, 'error');
      closeModal();
    }
  }, 1500);
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

function _parseBackstoryResponse(content) {
  let backstory = '';
  let powerSystem = {
    systemName: 'Special Power',
    classOrType: 'Combatant',
    synergyRating: 'B-Tier',
    stats: {
      combatPower: 50,
      strength: 50,
      defense: 50,
      speed: 50,
      energy: 50,
      tactics: 50
    },
    traitRoles: {},
    ratingExpl: ''
  };

  try {
    const result = cleanAndParseJson(content);
    if (result && (result.backstory || result.powerSystem)) {
      backstory = result.backstory || '';
      if (result.powerSystem && typeof result.powerSystem === 'object') {
        const ps = result.powerSystem;
        powerSystem.systemName = ps.systemName || ps.name || powerSystem.systemName;
        powerSystem.classOrType = ps.classOrType || ps.class || ps.type || powerSystem.classOrType;
        powerSystem.synergyRating = ps.synergyRating || ps.rating || powerSystem.synergyRating;
        powerSystem.ratingExpl = ps.ratingExpl || ps.explanation || powerSystem.ratingExpl;
        
        if (ps.stats && typeof ps.stats === 'object') {
          for (const key of Object.keys(powerSystem.stats)) {
            if (typeof ps.stats[key] === 'number') {
              powerSystem.stats[key] = ps.stats[key];
            } else if (typeof ps.stats[key] === 'string') {
              const num = parseInt(ps.stats[key], 10);
              if (!isNaN(num)) powerSystem.stats[key] = num;
            }
          }
        }
        
        if (ps.traitRoles && typeof ps.traitRoles === 'object') {
          powerSystem.traitRoles = ps.traitRoles;
        }
      }
    }
  } catch (e) {
    console.warn("Backstory JSON parsing failed, using heuristic text extractor:", e);
  }

  if (!backstory) {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    backstory = sentences.slice(0, 3).join(' ').trim();
    powerSystem.ratingExpl = sentences.slice(3, 5).join(' ').trim() || 'Calculated from local attributes.';
  }

  return { backstory, powerSystem };
}
