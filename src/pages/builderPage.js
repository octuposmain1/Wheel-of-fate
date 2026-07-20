// ============================================================
// builderPage.js — Wheel Builder UI (Full CRUD)
// ============================================================

import { store } from '../utils/store.js';
import { getTierById, getTierIntensity, isDramaticTier, computeRarityBarSegments, hexToRgba, isNegativeWheel } from '../utils/rarity.js';
import { showToast, openModal, closeModal } from '../components/toast.js';
import { requireApiKey, callAiChat, cleanAndParseJson } from '../utils/ai.js';

const WHEEL_ICONS = ['🎡','🧬','🩸','⚡','💀','🗡️','🛡️','🌊','🔥','❄️','⚡','🌪️','☠️','👁️','🌙','☀️','🎭','🦋','🐉','💎'];
const NEW_TIER_COLORS = ['#00ff88','#ff9500','#9d4edd','#00d9ff','#f72585'];

let selectedWheelId = null;
let rarityManagerOpen = false;
let folderSearchQuery = '';
let wheelSearchQuery = '';
let unsubscribe = null;

export function renderBuilderPage(container) {
  const state = store.getState();
  if (!selectedWheelId && state.wheels.length) {
    selectedWheelId = state.wheels[0].id;
  }

  _updateBuilderPage(container);

  // Subscribe to store changes
  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe(() => {
    _updateBuilderPage(container);
  });
}

export function _updateBuilderPage(container) {
  const state = store.getState();
  _renderWithFocusPreserved(container, state);
  _bindEvents(container, state);
}

function _renderWithFocusPreserved(container, state) {
  const activeEl = document.activeElement;
  let activeId = null;
  let activeTraitInputId = null;
  let activeRarityTierId = null;
  let selectionStart = 0;
  let selectionEnd = 0;

  if (activeEl) {
    activeId = activeEl.id;
    activeTraitInputId = activeEl.dataset.traitInput;
    activeRarityTierId = activeEl.dataset.tierLabel;
    try {
      selectionStart = activeEl.selectionStart ?? 0;
      selectionEnd = activeEl.selectionEnd ?? 0;
    } catch (e) {
      // Ignored for elements/input types that do not support selection
    }
  }

  // Save scroll positions
  const traitList = container.querySelector('.traits-list');
  const scrollTop = traitList ? traitList.scrollTop : 0;

  _render(container, state);

  // Restore scroll
  const newTraitList = container.querySelector('.traits-list');
  if (newTraitList && scrollTop) {
    newTraitList.scrollTop = scrollTop;
  }

  // Restore focus
  let elToFocus = null;
  if (activeTraitInputId) {
    elToFocus = container.querySelector(`[data-trait-input="${activeTraitInputId}"]`);
  } else if (activeRarityTierId) {
    elToFocus = container.querySelector(`[data-tier-label="${activeRarityTierId}"]`);
  } else if (activeId) {
    elToFocus = container.querySelector(`#${activeId}`);
  }

  if (elToFocus && elToFocus instanceof HTMLInputElement) {
    elToFocus.focus();
    try {
      elToFocus.setSelectionRange(selectionStart, selectionEnd);
    } catch (e) {
      // Ignored for unsupported input types
    }
  }
}

export function unmountBuilderPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

// ─── Render ────────────────────────────────────────────────────
function _render(container, state) {
  const { wheels, rarityTiers } = state;
  
  const activeGroups = (state.wheelGroups || []).filter(g => g.active);
  const activeWheelIds = new Set(activeGroups.flatMap(g => g.wheelIds || []));
  
  // Sidebar displays wheels belonging ONLY to currently active folders
  let displayedWheels = activeGroups.length > 0
    ? wheels.filter(w => activeWheelIds.has(w.id))
    : [];

  if (wheelSearchQuery.trim()) {
    const q = wheelSearchQuery.toLowerCase().trim();
    displayedWheels = displayedWheels.filter(w => w.name.toLowerCase().includes(q));
  }

  const selectedWheel = displayedWheels.find(w => w.id === selectedWheelId) ?? displayedWheels[0] ?? null;

  // Save scroll position for trait list
  const traitList = container.querySelector('.traits-list');
  const scrollTop = traitList ? traitList.scrollTop : 0;

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">🎡 Wheel Builder</h1>
      <p class="page-subtitle">Create and customize spinning wheels with weighted rarity traits.</p>

      ${_renderRarityManager(rarityTiers, wheels)}
      ${_renderFolderManager(state.wheelGroups || [], wheels)}

      <div class="builder-layout">
        <!-- ─── Sidebar: Wheel List ─── -->
        <aside class="builder-sidebar" aria-label="Wheel list">
          <div class="builder-sidebar-header" style="display:flex; flex-direction:column; gap:8px; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <p class="section-title" style="margin:0;">Trait Wheels (${displayedWheels.length})</p>
            </div>
            <input type="text" id="wheel-search-input" class="input" placeholder="🔍 Filter wheels..." value="${escapeHtml(wheelSearchQuery)}" style="width:100%; font-size:11px; padding:4px 8px; border-radius:6px;">
            <div style="display:flex; gap:6px; width:100%;">
              <button class="btn btn-primary btn-sm" id="add-wheel-btn" style="flex:1;" aria-label="Create new wheel">+ New Wheel</button>
              <button class="btn btn-secondary btn-sm" id="ai-generate-wheel-btn" style="flex:1.2; font-size:10px; padding:4px 6px;" aria-label="Generate wheel with AI">⚡ AI Generate</button>
            </div>
          </div>

          <nav class="wheel-list" role="list" aria-label="Wheels">
            ${displayedWheels.length === 0 ? `
              <div style="padding:20px 12px; text-align:center; font-size:12px; color:rgba(255,255,255,0.4); line-height:1.6; border:1px dashed rgba(255,255,255,0.1); border-radius:8px; margin:8px 0;">
                ${activeGroups.length === 0 
                  ? '📁 No active folders selected.<br>Turn ON a folder above to view its wheels!'
                  : '📁 No wheels in this folder yet.<br>Click <strong style="color:var(--cyan);">+ New Wheel</strong> above to create one!'}
              </div>
            ` : displayedWheels.map((w, idx) => `
              <div
                class="wheel-list-item ${w.id === selectedWheel?.id ? 'active' : ''}"
                data-select-wheel="${w.id}"
                data-wheel-index="${idx}"
                draggable="true"
                role="listitem"
                tabindex="0"
                aria-selected="${w.id === selectedWheel?.id}"
                aria-label="${w.name}, ${w.traits.length} traits"
              >
                <span class="drag-handle" style="cursor:grab; opacity:0.4; font-size:14px; margin-right:4px;" title="Drag to reorder">⋮⋮</span>
                <span class="wheel-list-item-icon" aria-hidden="true">${w.icon}</span>
                <div class="wheel-list-item-info">
                  <div class="wheel-list-item-name">${escapeHtml(w.name)}</div>
                  <div class="wheel-list-item-count">${w.traits.length} trait${w.traits.length !== 1 ? 's' : ''}</div>
                </div>
                <div style="display:flex; gap:2px; align-items:center;">
                  <button class="btn btn-ghost btn-sm btn-icon" data-move-wheel-up="${idx}" title="Move up" style="font-size:10px; padding:2px 4px;">▲</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-move-wheel-down="${idx}" title="Move down" style="font-size:10px; padding:2px 4px;">▼</button>
                  <button
                    class="trait-delete-btn"
                    data-delete-wheel="${w.id}"
                    aria-label="Delete ${w.name} wheel"
                    title="Delete wheel"
                  >🗑</button>
                </div>
              </div>
            `).join('')}
          </nav>
        </aside>

        <!-- ─── Editor: Traits ─── -->
        <div class="wheel-editor" role="main" aria-label="Wheel editor">
          ${selectedWheel ? _renderEditor(selectedWheel, rarityTiers) : _renderNoWheel()}
        </div>
      </div>
    </div>
  `;

  // Restore scroll
  const newTraitList = container.querySelector('.traits-list');
  if (newTraitList && scrollTop) {
    newTraitList.scrollTop = scrollTop;
  }
}

function _renderNoWheel() {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">🎡</span>
      <p>No wheel selected. Create one to get started!</p>
    </div>
  `;
}

// ─── Rarity Tier Manager ────────────────────────────────────────
function _renderRarityManager(tiers, wheels) {
  return `
    <div class="card" style="padding:20px; margin-bottom:24px;" id="rarity-manager">
      <div style="display:flex; align-items:center; justify-content:space-between; ${rarityManagerOpen ? 'margin-bottom:14px;' : ''}">
        <p class="section-title" style="margin:0;">🏷️ Manage Rarities</p>
        <button class="btn btn-ghost btn-sm" id="toggle-rarity-manager" aria-expanded="${rarityManagerOpen}">
          ${rarityManagerOpen ? '▲ Hide' : '▼ Show'}
        </button>
      </div>
      ${rarityManagerOpen ? `
        <div style="display:flex; flex-direction:column; gap:10px;" role="list" aria-label="Rarity tiers">
          ${tiers.map(t => {
            const inUseCount = countTraitsUsingTier(wheels, t.id);
            return `
              <div class="rarity-tier-row" data-tier-id="${t.id}" role="listitem">
                <input type="color" data-tier-color="${t.id}" value="${t.color}" class="rarity-tier-swatch" aria-label="Color for ${escapeHtml(t.label)}" />
                <input type="text" data-tier-label="${t.id}" value="${escapeHtml(t.label)}" class="input rarity-tier-label-input" maxlength="30" aria-label="Label for ${escapeHtml(t.label)}" />
                <input type="number" data-tier-weight="${t.id}" value="${t.weight}" min="0.1" step="0.5" class="input rarity-tier-weight-input" aria-label="Spin weight for ${escapeHtml(t.label)}" title="Spin probability weight" />
                ${inUseCount > 0
                  ? `<span class="rarity-tier-inuse-label">Used by ${inUseCount} trait${inUseCount !== 1 ? 's' : ''}</span>`
                  : ''
                }
                <button class="btn btn-danger btn-sm btn-icon" data-delete-tier="${t.id}" data-inuse-count="${inUseCount}" aria-label="Delete ${escapeHtml(t.label)} tier">✕</button>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex; gap:8px; margin-top:14px;">
          <input class="input" id="new-tier-label" type="text" placeholder="New tier name…" maxlength="30" style="flex:1;" aria-label="New rarity tier name" />
          <button class="btn btn-primary btn-sm" id="add-tier-btn" aria-label="Add rarity tier">+ Add Tier</button>
        </div>
      ` : ''}
    </div>
  `;
}

function _renderEditor(wheel, tiers) {
  return `
    <!-- Header -->
    <div class="wheel-editor-header">
      <span
        class="wheel-editor-icon"
        id="wheel-icon-picker"
        title="Click to change icon"
        role="button"
        tabindex="0"
        aria-label="Change wheel icon"
      >${wheel.icon}</span>
      <input
        class="wheel-editor-title-input"
        id="wheel-name-input"
        type="text"
        value="${escapeHtml(wheel.name)}"
        placeholder="Wheel name…"
        maxlength="40"
        aria-label="Wheel name"
      />
      <div style="display:flex; gap:8px; align-items:center; margin-left:auto;">
        ${wheel.backupTraits ? `
          <button class="btn btn-secondary btn-sm" id="revert-wheel-btn" style="font-size:10px; padding:4px 8px;" title="Revert to previous traits before regeneration">⏪ Revert</button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" id="regen-wheel-btn" style="font-size:10px; padding:4px 8px;" title="Regenerate traits using AI based on prompt">⚡ AI Regen</button>
        <span style="font-size:12px; color:rgba(255,255,255,0.3);">${wheel.traits.length} traits</span>
      </div>
    </div>

    <!-- Rarity Distribution -->
    <div style="margin-bottom:24px;">
      <p class="section-title">Rarity Distribution</p>
      <div class="rarity-dist" style="height:10px; margin-bottom:8px;" aria-label="Rarity distribution">
        ${computeRarityBarSegments(tiers, wheel.traits).map(seg =>
          `<div class="rarity-dist-segment" style="flex:${seg.fraction}; background:${seg.tier.color}; opacity:0.8;"></div>`
        ).join('')}
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        ${tiers.map(t => {
          const count = wheel.traits.filter(tr => tr.rarity === t.id).length;
          return `<span class="rarity-badge" style="background:${hexToRgba(t.color, 0.15)}; color:${t.color}; border:1px solid ${hexToRgba(t.color, 0.4)};" aria-label="${escapeHtml(t.label)}: ${count} traits"><span class="rarity-dot" style="background:${t.color};"></span> ${escapeHtml(t.label)} (${count})</span>`;
        }).join('')}
      </div>
    </div>

    <!-- Traits List (Sorted Rarest-First) -->
    <p class="section-title">Traits</p>
    <div class="traits-list" id="traits-list" role="list" aria-label="Traits list">
      ${wheel.traits.length === 0
        ? `<div class="empty-state" style="padding:32px;"><span class="empty-state-icon" style="font-size:40px;">📝</span><p style="font-size:14px;">Add your first trait below!</p></div>`
        : [...wheel.traits]
            .sort((a, b) => getTierIntensity(tiers, b.rarity) - getTierIntensity(tiers, a.rarity))
            .map((trait, idx) => {
          const tierColor = getTierById(tiers, trait.rarity).color;
          return `
          <div
            class="trait-item"
            data-trait-id="${trait.id}"
            role="listitem"
            draggable="true"
            data-idx="${idx}"
            aria-label="Trait: ${trait.label}, rarity: ${trait.rarity}"
          >
            <span class="trait-drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
            <input
              class="trait-input"
              type="text"
              value="${escapeHtml(trait.label)}"
              placeholder="Trait name…"
              maxlength="60"
              data-trait-input="${trait.id}"
              aria-label="Trait name"
            />
            <select
              class="input select trait-rarity-select"
              data-trait-rarity="${trait.id}"
              aria-label="Rarity for ${trait.label}"
              style="width:auto; padding:4px 28px 4px 8px; font-size:11px;"
            >
              ${tiers.map(t => `
                <option value="${t.id}" ${trait.rarity === t.id ? 'selected' : ''} style="background:#12121f; color:${t.color};">
                  ● ${escapeHtml(t.label)}
                </option>
              `).join('')}
            </select>
            <span class="rarity-badge ${isDramaticTier(tiers, trait.rarity) ? 'rarity-badge-dramatic' : ''}" style="font-size:9px; padding:2px 6px; background:${hexToRgba(tierColor, 0.15)}; color:${tierColor}; border:1px solid ${hexToRgba(tierColor, 0.4)};">${getTierById(tiers, trait.rarity).weight}%</span>
            <button
              class="trait-delete-btn"
              data-delete-trait="${trait.id}"
              aria-label="Delete trait: ${trait.label}"
            >✕</button>
          </div>
        `;
        }).join('')
      }
    </div>

    <!-- Add Trait Form -->
    <div class="add-trait-form" id="add-trait-form" role="form" aria-label="Add new trait">
      <span style="font-size:18px; color:rgba(255,255,255,0.3);" aria-hidden="true">＋</span>
      <input
        class="add-trait-input"
        id="new-trait-input"
        type="text"
        placeholder="Add a new trait…"
        maxlength="60"
        aria-label="New trait name"
      />
      <select
        class="input select"
        id="new-trait-rarity"
        aria-label="New trait rarity"
        style="width:auto; padding:4px 28px 4px 8px; font-size:12px; background:var(--bg-input);"
      >
        ${tiers.map(t => `
          <option value="${t.id}" style="background:#12121f; color:${t.color};">● ${escapeHtml(t.label)}</option>
        `).join('')}
      </select>
      <button class="btn btn-primary btn-sm" id="add-trait-btn" aria-label="Add trait">Add</button>
    </div>

    <!-- Bulk Actions -->
    <div style="display:flex; gap:12px; margin-top:20px; flex-wrap:wrap;">
      <button class="btn btn-ghost btn-sm" id="sort-by-rarity-btn" aria-label="Sort traits by rarity">↕ Sort by Rarity</button>
      <button class="btn btn-ghost btn-sm" id="shuffle-traits-btn" aria-label="Shuffle traits randomly">🔀 Shuffle</button>
      <button class="btn btn-danger btn-sm" id="clear-traits-btn" aria-label="Clear all traits">🗑 Clear All</button>
    </div>
  `;
}

// ─── Rarity Manager Events ──────────────────────────────────────
function _bindRarityManagerEvents(container, state) {
  container.querySelector('#toggle-rarity-manager')?.addEventListener('click', () => {
    rarityManagerOpen = !rarityManagerOpen;
    _updateBuilderPage(container);
  });

  container.querySelectorAll('[data-tier-color]').forEach(input => {
    input.addEventListener('input', () => {
      store.updateRarityTier(input.dataset.tierColor, { color: input.value });
    });
  });

  container.querySelectorAll('[data-tier-label]').forEach(input => {
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        store.updateRarityTier(input.dataset.tierLabel, { label: input.value });
      }, 400);
    });
  });

  container.querySelectorAll('[data-tier-weight]').forEach(input => {
    input.addEventListener('change', () => {
      const weight = Math.max(0.1, parseFloat(input.value) || 0.1);
      store.updateRarityTier(input.dataset.tierWeight, { weight });
    });
  });

  container.querySelectorAll('[data-delete-tier]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = state.rarityTiers.find(t => t.id === btn.dataset.deleteTier);
      if (!tier) return;
      const inUseCount = parseInt(btn.dataset.inuseCount, 10) || 0;
      const message = inUseCount > 0
        ? `Delete "${tier.label}"? ${inUseCount} trait${inUseCount !== 1 ? 's' : ''} using it will show as "Unknown Rarity" until you reassign them.`
        : `Delete the "${tier.label}" rarity tier?`;
      if (confirm(message)) {
        store.deleteRarityTier(tier.id);
        showToast(`Deleted rarity tier "${tier.label}"`, 'info');
      }
    });
  });

  const newTierInput = container.querySelector('#new-tier-label');
  container.querySelector('#add-tier-btn')?.addEventListener('click', () => {
    const label = newTierInput?.value.trim();
    if (!label) { newTierInput?.focus(); return; }
    const index = state.rarityTiers.length % NEW_TIER_COLORS.length;
    const color = NEW_TIER_COLORS[index];
    store.addRarityTier({ label, weight: 10, color });
    if (newTierInput) newTierInput.value = '';
    showToast(`Added rarity tier "${label}"`, 'success');
  });
  newTierInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('#add-tier-btn')?.click();
  });
}

// ─── Bind Events ───────────────────────────────────────────────
function _bindEvents(container, state) {
  const wheel = state.wheels.find(w => w.id === selectedWheelId);

  // Search inputs (Direct DOM filtering to prevent focus loss)
  const wheelSearchInput = container.querySelector('#wheel-search-input');
  wheelSearchInput?.addEventListener('input', () => {
    wheelSearchQuery = wheelSearchInput.value;
    const q = wheelSearchQuery.toLowerCase().trim();
    container.querySelectorAll('.wheel-list-item').forEach(item => {
      const name = item.querySelector('.wheel-list-item-name')?.textContent.toLowerCase() || '';
      item.style.display = name.includes(q) ? 'flex' : 'none';
    });
  });

  const folderSearchInput = container.querySelector('#folder-search-input');
  folderSearchInput?.addEventListener('input', () => {
    folderSearchQuery = folderSearchInput.value;
    const q = folderSearchQuery.toLowerCase().trim();
    container.querySelectorAll('[data-select-group]').forEach(pill => {
      const name = pill.querySelector('strong')?.textContent.toLowerCase() || '';
      pill.style.display = name.includes(q) ? 'flex' : 'none';
    });
  });

  // Folder toggling & management
  container.querySelectorAll('[data-select-group]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.closest('[data-toggle-group]') || e.target.closest('[data-duplicate-group]') || e.target.closest('[data-delete-group]')) return;
      const groupId = btn.dataset.selectGroup;
      store.selectSingleActiveGroup(groupId);
    });
  });

  container.querySelectorAll('[data-toggle-group]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = btn.dataset.toggleGroup;
      store.toggleWheelGroupActive(groupId);
    });
  });

  container.querySelectorAll('[data-duplicate-group]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = btn.dataset.duplicateGroup;
      const copy = store.duplicateWheelGroup(groupId);
      if (copy) showToast(`Duplicated folder as "${copy.name}"`, 'success');
    });
  });

  container.querySelectorAll('[data-delete-group]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = btn.dataset.deleteGroup;
      const group = (state.wheelGroups || []).find(g => g.id === groupId);
      if (group && confirm(`Delete folder "${group.name}"?`)) {
        store.deleteWheelGroup(groupId);
        showToast(`Deleted folder "${group.name}"`, 'info');
      }
    });
  });

  container.querySelector('#create-group-btn')?.addEventListener('click', () => {
    _showCreateFolderModal(container, state);
  });

  // Select wheel
  container.querySelectorAll('[data-select-wheel]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-wheel]') || e.target.closest('[data-move-wheel-up]') || e.target.closest('[data-move-wheel-down]')) return;
      selectedWheelId = el.dataset.selectWheel;
      _updateBuilderPage(container);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.target.closest('[data-delete-wheel]')) {
        selectedWheelId = el.dataset.selectWheel;
        _updateBuilderPage(container);
      }
    });
  });

  // Move wheel up/down
  container.querySelectorAll('[data-move-wheel-up]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.moveWheelUp, 10);
      store.reorderWheels(idx, idx - 1);
    });
  });

  container.querySelectorAll('[data-move-wheel-down]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.moveWheelDown, 10);
      store.reorderWheels(idx, idx + 1);
    });
  });

  // Drag and drop HTML5 reordering
  let draggedIndex = null;
  container.querySelectorAll('.wheel-list-item[draggable]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedIndex = parseInt(item.dataset.wheelIndex, 10);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedIndex = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIndex = parseInt(item.dataset.wheelIndex, 10);
      if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
        store.reorderWheels(draggedIndex, targetIndex);
      }
    });
  });

  // Add wheel
  container.querySelector('#add-wheel-btn')?.addEventListener('click', () => {
    _showAddWheelModal();
  });

  // AI Generate wheel
  container.querySelector('#ai-generate-wheel-btn')?.addEventListener('click', () => {
    _showAiGenerateWheelModal(container);
  });

  // Delete wheel
  container.querySelectorAll('[data-delete-wheel]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = btn.dataset.deleteWheel;
      const wName = state.wheels.find(w => w.id === wid)?.name ?? 'this wheel';
      if (confirm(`Delete "${wName}"? This cannot be undone.`)) {
        store.deleteWheel(wid);
        if (selectedWheelId === wid) {
          const remaining = store.getState().wheels;
          selectedWheelId = remaining[0]?.id ?? null;
        }
        showToast(`Deleted "${wName}"`, 'info');
      }
    });
  });

  if (!wheel) return;

  // Wheel name edit
  const nameInput = container.querySelector('#wheel-name-input');
  nameInput?.addEventListener('input', () => {
    store.updateWheel(wheel.id, { name: nameInput.value });
  });

  // Icon picker
  container.querySelector('#wheel-icon-picker')?.addEventListener('click', () => {
    _showIconPicker(wheel.id);
  });

  // AI Regen traits
  container.querySelector('#regen-wheel-btn')?.addEventListener('click', () => {
    _showAiRegenTraitsModal(container, wheel);
  });

  // Revert traits
  container.querySelector('#revert-wheel-btn')?.addEventListener('click', () => {
    if (confirm(`Revert wheel "${wheel.name}" to its previous traits before regeneration?`)) {
      store.revertWheelTraits(wheel.id);
      showToast(`Reverted "${wheel.name}" traits`, 'success');
    }
  });

  // Trait label edit (debounced)
  container.querySelectorAll('[data-trait-input]').forEach(input => {
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        store.updateTrait(wheel.id, input.dataset.traitInput, { label: input.value });
      }, 400);
    });
  });

  // Trait rarity change
  container.querySelectorAll('[data-trait-rarity]').forEach(sel => {
    sel.addEventListener('change', () => {
      store.updateTrait(wheel.id, sel.dataset.traitRarity, { rarity: sel.value });
    });
  });

  // Delete trait
  container.querySelectorAll('[data-delete-trait]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.deleteTrait(wheel.id, btn.dataset.deleteTrait);
    });
  });

  // Add trait
  const addTraitInput = container.querySelector('#new-trait-input');
  const addTraitRarity = container.querySelector('#new-trait-rarity');
  const addTraitBtn = container.querySelector('#add-trait-btn');

  const doAddTrait = () => {
    const label = addTraitInput?.value.trim();
    if (!label) { addTraitInput?.focus(); return; }
    const rarity = addTraitRarity?.value ?? 'common';
    store.addTrait(wheel.id, label, rarity);
    if (addTraitInput) addTraitInput.value = '';
    addTraitInput?.focus();
    showToast(`Added trait: "${label}"`, 'success');
  };

  addTraitBtn?.addEventListener('click', doAddTrait);
  addTraitInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doAddTrait();
  });

  // Sort by rarity (rarest first)
  container.querySelector('#sort-by-rarity-btn')?.addEventListener('click', () => {
    const tiers = store.getState().rarityTiers;
    const sorted = [...wheel.traits].sort(
      (a, b) => getTierIntensity(tiers, b.rarity) - getTierIntensity(tiers, a.rarity)
    );
    store.reorderTraits(wheel.id, sorted);
  });

  // Shuffle
  container.querySelector('#shuffle-traits-btn')?.addEventListener('click', () => {
    const shuffled = [...wheel.traits].sort(() => Math.random() - 0.5);
    store.reorderTraits(wheel.id, shuffled);
  });

  // Clear all
  container.querySelector('#clear-traits-btn')?.addEventListener('click', () => {
    if (wheel.traits.length === 0) return;
    if (confirm(`Remove all ${wheel.traits.length} traits from "${wheel.name}"?`)) {
      store.reorderTraits(wheel.id, []);
      showToast('All traits cleared', 'info');
    }
  });

  // Drag-and-drop reordering
  _bindDragDrop(container, wheel);
}

// ─── Drag & Drop ───────────────────────────────────────────────
function _bindDragDrop(container, wheel) {
  const list = container.querySelector('#traits-list');
  if (!list) return;

  let dragSrc = null;

  list.querySelectorAll('.trait-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = 'move';
      item.style.opacity = '0.4';
    });

    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      list.querySelectorAll('.trait-item').forEach(i => i.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.trait-item').forEach(i => i.classList.remove('drag-over'));
      if (item !== dragSrc) {
        item.style.borderColor = 'rgba(0,245,255,0.5)';
      }
    });

    item.addEventListener('dragleave', () => {
      item.style.borderColor = '';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrc === item) return;
      item.style.borderColor = '';

      const allItems = [...list.querySelectorAll('.trait-item')];
      const srcIdx = allItems.indexOf(dragSrc);
      const tgtIdx = allItems.indexOf(item);

      const newTraits = [...wheel.traits];
      const [moved] = newTraits.splice(srcIdx, 1);
      newTraits.splice(tgtIdx, 0, moved);
      store.reorderTraits(wheel.id, newTraits);
    });
  });
}

// ─── Add Wheel Modal ────────────────────────────────────────────
function _showAddWheelModal() {
  openModal({
    title: '🎡 Create New Wheel',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:6px;">Wheel Name</label>
          <input class="input" id="modal-wheel-name" type="text" placeholder="e.g. Weapon, Backstory, Mount…" maxlength="40" autofocus />
        </div>
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:8px;">Icon</label>
          <div style="display:flex; flex-wrap:wrap; gap:8px;" id="icon-grid">
            ${WHEEL_ICONS.map(icon => `
              <button
                class="btn btn-ghost"
                style="font-size:24px; padding:8px; aspect-ratio:1;"
                data-icon="${icon}"
                aria-label="Select icon ${icon}"
              >${icon}</button>
            `).join('')}
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-top:8px;">
          <button class="btn btn-primary" id="modal-create-wheel" style="flex:1;">Create Wheel</button>
          <button class="btn btn-ghost" id="modal-cancel-wheel">Cancel</button>
        </div>
      </div>
    `,
  });

  let selectedIcon = '🎡';

  document.querySelectorAll('[data-icon]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-icon]').forEach(b => b.style.background = '');
      btn.style.background = 'rgba(0,245,255,0.15)';
      btn.style.borderColor = 'var(--cyan)';
      selectedIcon = btn.dataset.icon;
    });
  });

  document.querySelector('#modal-create-wheel')?.addEventListener('click', () => {
    const name = document.querySelector('#modal-wheel-name')?.value.trim();
    if (!name) { document.querySelector('#modal-wheel-name')?.focus(); return; }
    const wheel = store.addWheel(name, selectedIcon);
    selectedWheelId = wheel.id;
    closeModal();
    showToast(`Created wheel: "${name}"`, 'success');
  });

  document.querySelector('#modal-cancel-wheel')?.addEventListener('click', closeModal);
  document.querySelector('#modal-wheel-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.querySelector('#modal-create-wheel')?.click();
  });
}

// ─── Icon Picker Modal ──────────────────────────────────────────
function _showIconPicker(wheelId) {
  const currentWheel = store.getState().wheels.find(w => w.id === wheelId);
  openModal({
    title: 'Choose Icon',
    content: `
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${WHEEL_ICONS.map(icon => `
          <button
            class="btn btn-ghost"
            style="font-size:28px; padding:10px; aspect-ratio:1;"
            data-pick-icon="${icon}"
            aria-label="${icon}"
          >${icon}</button>
        `).join('')}
      </div>
    `,
  });

  document.querySelectorAll('[data-pick-icon]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.updateWheel(wheelId, { icon: btn.dataset.pickIcon });
      closeModal();
    });
  });
}

// ─── Utilities ─────────────────────────────────────────────────
function countTraitsUsingTier(wheels, tierId) {
  return wheels.reduce((sum, w) => sum + w.traits.filter(t => t.rarity === tierId).length, 0);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function getThemedFallbackTraits(theme, count, isNeg) {
  const themeLower = theme.toLowerCase();
  let baseItems = [];
  
  if (isNeg) {
    baseItems = ['Leak', 'Blind Spot', 'Vulnerability', 'Curse', 'Decay', 'Fatigue', 'Lag', 'Malfunction', 'Spasm', 'Drain', 'Phobia', 'Feeble', 'Muted', 'Shattered', 'Sluggish', 'Fragile', 'Defect'];
  } else if (themeLower.includes('weapon') || themeLower.includes('sword') || themeLower.includes('blade') || themeLower.includes('bow') || themeLower.includes('arm')) {
    baseItems = ['Dagger', 'Shortsword', 'Longsword', 'Greatsword', 'Warhammer', 'Halberd', 'Longbow', 'Crossbow', 'Rapier', 'Spear', 'Battleaxe', 'Katana', 'Saber', 'Scythe'];
  } else if (themeLower.includes('pet') || themeLower.includes('mount') || themeLower.includes('companion') || themeLower.includes('beast') || themeLower.includes('animal') || themeLower.includes('familiar')) {
    baseItems = ['Wolf', 'Dire Bear', 'Falcon', 'Griffon', 'Shadow Panther', 'Warhorse', 'Great Stag', 'Snow Owl', 'Wind Drake', 'Giant Spider', 'Pixie', 'Raven'];
  } else if (themeLower.includes('race') || themeLower.includes('species') || themeLower.includes('ancestry') || themeLower.includes('people')) {
    baseItems = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Tiefling', 'Dragonborn', 'Gnome', 'Goblin', 'Undead', 'Centaur', 'Fairy'];
  } else if (themeLower.includes('class') || themeLower.includes('job') || themeLower.includes('profession') || themeLower.includes('special')) {
    baseItems = ['Warrior', 'Mage', 'Rogue', 'Cleric', 'Paladin', 'Ranger', 'Warlock', 'Druid', 'Bard', 'Monk', 'Necromancer', 'Alchemist'];
  } else if (themeLower.includes('spell') || themeLower.includes('magic') || themeLower.includes('element') || themeLower.includes('ability')) {
    baseItems = ['Fireball', 'Water Blast', 'Wind Gust', 'Stone Spike', 'Lightning Shock', 'Ice Freeze', 'Arcane Shield', 'Teleport', 'Heal Aura', 'Invisibility'];
  } else {
    baseItems = ['Strike', 'Aura', 'Ward', 'Blast', 'Infusion', 'Master', 'Shadow', 'Lord', 'Blessing', 'Shield', 'Bane', 'Glow', 'Force', 'Wrath', 'Grace', 'Triumph'];
  }

  const words = theme.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const themeWord = words.join(' ') || 'Mystery';
  
  const traits = [];
  for (let i = 0; i < count; i++) {
    let rarity = 'common';
    if (i === count - 1) rarity = 'mythic';
    else if (i >= Math.floor(count * 0.8)) rarity = 'legendary';
    else if (i >= Math.floor(count * 0.5)) rarity = 'rare';
    
    const baseItem = baseItems[i % baseItems.length];
    
    let label = '';
    if (isNeg) {
      label = i % 3 === 0 ? `${themeWord} ${baseItem}` : (i % 3 === 1 ? `Feeble ${baseItem}` : `Fragile ${themeWord} ${baseItem}`);
    } else {
      if (themeLower.includes('race') || themeLower.includes('class') || themeLower.includes('job')) {
        label = i % 3 === 0 ? `${themeWord} ${baseItem}` : (i % 3 === 1 ? `Noble ${baseItem}` : `Elder ${baseItem}`);
      } else if (themeLower.includes('weapon') || themeLower.includes('sword') || themeLower.includes('pet') || themeLower.includes('mount')) {
        label = i % 3 === 0 ? `${themeWord} ${baseItem}` : (i % 3 === 1 ? `Steel ${baseItem}` : `Mythic ${themeWord} ${baseItem}`);
      } else {
        label = i % 3 === 0 ? `${themeWord} ${baseItem}` : (i % 3 === 1 ? `Lesser ${baseItem}` : `Greater ${themeWord} ${baseItem}`);
      }
    }
    traits.push({ label, rarity });
  }

  return {
    name: `${themeWord} Wheel`,
    icon: isNeg ? '💀' : (themeLower.includes('weapon') || themeLower.includes('sword') ? '⚔️' : '🔮'),
    traits
  };
}

// ─── AI Wheel Generator Modal ──────────────────────────────────
function _showAiGenerateWheelModal(container) {
  openModal({
    title: '⚡ Generate Wheel with AI',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size:12px; color:rgba(255,255,255,0.6); margin:0; line-height:1.4;">
          Describe the theme or concept of the wheel you want to create (e.g., "Post-apocalyptic mutations", "Cyberpunk corporations", "Mythical familiars"). The AI will generate themed traits and assign appropriate weights.
        </p>
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:6px;">Prompt / Theme</label>
          <input class="input" id="ai-wheel-prompt" type="text" placeholder="e.g. Mythical companions, Cursed swords…" maxlength="80" autofocus />
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; color:rgba(255,255,255,0.5);">Number of Traits</label>
            <span style="font-size:12px; font-weight:bold; color:var(--gold);" id="ai-wheel-count-val">10</span>
          </div>
          <input type="range" id="ai-wheel-count" min="2" max="20" value="10" style="width:100%; display:block; margin:0;" />
        </div>
        <div style="display:flex; gap:12px; margin-top:8px;">
          <button class="btn btn-primary" id="modal-ai-generate" style="flex:1;">⚡ AI Generate</button>
          <button class="btn btn-ghost" id="modal-ai-cancel">Cancel</button>
        </div>
      </div>
    `,
  });

  const promptInput = document.querySelector('#ai-wheel-prompt');
  const countSlider = document.querySelector('#ai-wheel-count');
  const countVal = document.querySelector('#ai-wheel-count-val');
  const generateBtn = document.querySelector('#modal-ai-generate');

  countSlider?.addEventListener('input', () => {
    if (countVal) countVal.textContent = countSlider.value;
  });

  generateBtn?.addEventListener('click', async () => {
    const promptValue = promptInput?.value.trim();
    if (!promptValue) { promptInput?.focus(); return; }

    const traitCount = parseInt(countSlider?.value || '10', 10);
    const isNeg = isNegativeWheel(promptValue);

    const runWithApiKey = (apiKey) => {
      openModal({
        title: '⚡ Generating Wheel with AI',
        content: `
          <div style="display:flex; flex-direction:column; gap:16px; align-items:center; text-align:center; padding:16px;">
            <span class="spinner" style="width:30px; height:30px; border-width:3px;"></span>
            <p style="font-size:13px; color:rgba(255,255,255,0.7); margin:0; margin-top:8px;">Generating themed wheel configurations for "${escapeHtml(promptValue)}"...</p>
          </div>
        `
      });

      Promise.resolve().then(async () => {
        try {
          const systemPrompt = `You are a creative game mechanics designer. Generate a themed spinning wheel configuration for the prompt/theme: "${promptValue}".
Important context: This application is a character generator, RPG combat simulator, and fantasy trait builder. If the theme/prompt is ambiguous (like 'race', 'class', etc.), default to fantasy/RPG character context (e.g. 'race' should mean character race/species like Elf, Dwarf, Orc, Human, rather than car racing).
${isNeg ? 'This wheel represents negative attributes, weaknesses, defects, or curses. Every single trait generated MUST be a disadvantage, flaw, weakness, or penalty (e.g. Brittle Bones, Slow Reflexes, Acrophobia, Mana Leak). Do NOT generate positive abilities or powers.' : ''}

The wheel options/entries (the "traits" array in the schema) must be specific instances or examples of the theme itself, not modifiers or traits of the theme. For example, if the theme is 'Weapon', generate specific weapons (e.g., 'Elven Longbow', 'Steel Dagger', 'Vorpal Blade') rather than weapon traits like 'Sharpness' or 'Heavy Hilt'. If the theme is 'Mount', generate specific mounts (e.g., 'Dire Wolf', 'Griffon') rather than mount traits.

Return a raw, unformatted JSON object matching this schema (do NOT wrap in markdown code blocks, do NOT include preamble):
{
  "name": "Wheel Name (max 30 characters)",
  "icon": "Single emoji matching the theme",
  "traits": [
    { "label": "Trait Name (max 50 characters)", "rarity": "common" | "rare" | "legendary" | "mythic" }
  ]
}
Generate exactly ${traitCount} traits total, distributed appropriately across rarities (mostly common, some rare, a few legendary, 1 mythic).`;

          const apiUrl = localStorage.getItem('openai_api_url') || 'https://api.groq.com/openai/v1';
          const modelName = localStorage.getItem('openai_model') || 'llama-3.3-70b-versatile';

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
          const parsed = _parseWheelResponse(content);

          if (parsed && parsed.traits.length > 0) {
            const tiers = [...store.getState().rarityTiers].sort((a, b) => b.weight - a.weight);
            const getMappedRarity = (tag) => {
              if (!tiers.length) return 'common';
              if (tag === 'mythic') return tiers[tiers.length - 1].id;
              if (tag === 'legendary') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.66))].id;
              if (tag === 'rare') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.33))].id;
              return tiers[0].id;
            };

            const newWheel = store.addWheel(parsed.name, parsed.icon || '🎡');
            for (const t of parsed.traits) {
              store.addTrait(newWheel.id, t.label, getMappedRarity(t.rarity));
            }

            selectedWheelId = newWheel.id;
            closeModal();
            showToast(`AI generated wheel: "${parsed.name}"`, 'success');
            
            _renderWithFocusPreserved(container, store.getState());
            _bindEvents(container, store.getState());
          } else {
            throw new Error('No traits found in the model response.');
          }
        } catch (err) {
          console.error(err);
          showToast(`Failed to generate wheel: ${err.message}`, 'error');
          closeModal();
        }
      });
    };

    const runFreeFallback = () => {
      const selected = getThemedFallbackTraits(promptValue, traitCount, isNeg);

      const tiers = [...store.getState().rarityTiers].sort((a, b) => b.weight - a.weight);
      const getMappedRarity = (tag) => {
        if (!tiers.length) return 'common';
        if (tag === 'mythic') return tiers[tiers.length - 1].id;
        if (tag === 'legendary') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.66))].id;
        if (tag === 'rare') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.33))].id;
        return tiers[0].id;
      };

      const newWheel = store.addWheel(`${selected.name} (Simulated)`, selected.icon ?? '🎡');
      for (const t of selected.traits) {
        store.addTrait(newWheel.id, t.label, getMappedRarity(t.rarity));
      }

      selectedWheelId = newWheel.id;
      showToast(`Generated simulated wheel: "${selected.name}"`, 'success');
      _renderWithFocusPreserved(container, store.getState());
      _bindEvents(container, store.getState());
    };

    await requireApiKey(runWithApiKey, runFreeFallback);
  });

  document.querySelector('#modal-ai-cancel')?.addEventListener('click', closeModal);
  promptInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generateBtn?.click();
  });
}

// ─── AI Trait Regeneration Modal ──────────────────────────────
function _showAiRegenTraitsModal(container, wheel) {
  openModal({
    title: `⚡ AI Regenerate Traits: ${escapeHtml(wheel.name)}`,
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size:12px; color:rgba(255,255,255,0.6); margin:0; line-height:1.4;">
          Enter a prompt describing what kind of traits you want for this wheel. The AI will generate a new set of traits to replace the current ones. You can undo/revert this change immediately afterwards if you dislike it.
        </p>
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:6px;">Prompt / Theme</label>
          <input class="input" id="regen-wheel-prompt" type="text" value="${escapeHtml(wheel.name)}" maxlength="80" autofocus />
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; color:rgba(255,255,255,0.5);">Number of Traits</label>
            <span style="font-size:12px; font-weight:bold; color:var(--gold);" id="ai-regen-count-val">10</span>
          </div>
          <input type="range" id="ai-regen-count" min="2" max="20" value="10" style="width:100%; display:block; margin:0;" />
        </div>
        <div style="display:flex; gap:12px; margin-top:8px;">
          <button class="btn btn-primary" id="modal-ai-regen-btn" style="flex:1;">⚡ Regenerate</button>
          <button class="btn btn-ghost" id="modal-ai-regen-cancel">Cancel</button>
        </div>
      </div>
    `,
  });

  const promptInput = document.querySelector('#regen-wheel-prompt');
  const countSlider = document.querySelector('#ai-regen-count');
  const countVal = document.querySelector('#ai-regen-count-val');
  const regenBtn = document.querySelector('#modal-ai-regen-btn');

  countSlider?.addEventListener('input', () => {
    if (countVal) countVal.textContent = countSlider.value;
  });

  regenBtn?.addEventListener('click', async () => {
    const promptValue = promptInput?.value.trim();
    if (!promptValue) { promptInput?.focus(); return; }

    const traitCount = parseInt(countSlider?.value || '10', 10);
    const isNeg = isNegativeWheel(promptValue);

    const runWithApiKey = (apiKey) => {
      openModal({
        title: `⚡ Regenerating Traits: ${escapeHtml(wheel.name)}`,
        content: `
          <div style="display:flex; flex-direction:column; gap:16px; align-items:center; text-align:center; padding:16px;">
            <span class="spinner" style="width:30px; height:30px; border-width:3px;"></span>
            <p style="font-size:13px; color:rgba(255,255,255,0.7); margin:0; margin-top:8px;">Regenerating traits for theme "${escapeHtml(promptValue)}"...</p>
          </div>
        `
      });

      Promise.resolve().then(async () => {
        try {
          const systemPrompt = `You are a creative game mechanics designer. Generate a list of themed traits/entries for the wheel prompt/theme: "${promptValue}".
Important context: This application is a character generator, RPG combat simulator, and fantasy trait builder. If the theme/prompt is ambiguous (like 'race', 'class', etc.), default to fantasy/RPG character context (e.g. 'race' should mean character race/species like Elf, Dwarf, Orc, Human, rather than car racing).
${isNeg ? 'This wheel represents negative attributes, weaknesses, defects, or curses. Every single trait generated MUST be a disadvantage, flaw, weakness, or penalty (e.g. Brittle Bones, Slow Reflexes, Acrophobia, Mana Leak). Do NOT generate positive abilities or powers.' : ''}

The options/entries (the "traits" array in the schema) must be specific instances or examples of the theme itself, not modifiers or traits of the theme. For example, if the theme is 'Weapon', generate specific weapons (e.g., 'Elven Longbow', 'Steel Dagger', 'Vorpal Blade') rather than weapon traits like 'Sharpness' or 'Heavy Hilt'. If the theme is 'Mount', generate specific mounts (e.g., 'Dire Wolf', 'Griffon') rather than mount traits.

Return a raw, unformatted JSON object matching this schema (do NOT wrap in markdown code blocks, do NOT include preamble):
{
  "traits": [
    { "label": "Trait Name (max 50 characters)", "rarity": "common" | "rare" | "legendary" | "mythic" }
  ]
}
Generate exactly ${traitCount} traits total, distributed appropriately across rarities (mostly common, some rare, a few legendary, 1 mythic).`;

          const apiUrl = localStorage.getItem('openai_api_url') || 'https://api.groq.com/openai/v1';
          const modelName = localStorage.getItem('openai_model') || 'llama-3.3-70b-versatile';

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
          const traits = _parseTraitsResponse(content);

          if (traits && traits.length > 0) {
            const tiers = [...store.getState().rarityTiers].sort((a, b) => b.weight - a.weight);
            const getMappedRarity = (tag) => {
              if (!tiers.length) return 'common';
              if (tag === 'mythic') return tiers[tiers.length - 1].id;
              if (tag === 'legendary') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.66))].id;
              if (tag === 'rare') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.33))].id;
              return tiers[0].id;
            };

            const newTraits = traits.map(t => ({
              id: crypto.randomUUID(),
              label: t.label,
              rarity: getMappedRarity(t.rarity)
            }));

            store.regenerateWheelTraits(wheel.id, newTraits);
            closeModal();
            showToast(`Regenerated traits for "${wheel.name}"`, 'success');
          } else {
            throw new Error('No traits found in the model response.');
          }
        } catch (err) {
          console.error(err);
          showToast(`Failed to regenerate traits: ${err.message}`, 'error');
          closeModal();
        }
      });
    };

    const runFreeFallback = () => {
      const selected = getThemedFallbackTraits(promptValue, traitCount, isNeg);

      const tiers = [...store.getState().rarityTiers].sort((a, b) => b.weight - a.weight);
      const getMappedRarity = (tag) => {
        if (!tiers.length) return 'common';
        if (tag === 'mythic') return tiers[tiers.length - 1].id;
        if (tag === 'legendary') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.66))].id;
        if (tag === 'rare') return tiers[Math.min(tiers.length - 1, Math.floor(tiers.length * 0.33))].id;
        return tiers[0].id;
      };

      const newTraits = selected.traits.map(t => ({
        id: crypto.randomUUID(),
        label: t.label,
        rarity: getMappedRarity(t.rarity)
      }));

      store.regenerateWheelTraits(wheel.id, newTraits);
      showToast(`Regenerated simulated traits for "${wheel.name}"`, 'success');
    };

    await requireApiKey(runWithApiKey, runFreeFallback);
  });

  document.querySelector('#modal-ai-regen-cancel')?.addEventListener('click', closeModal);
  promptInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') regenBtn?.click();
  });
}

function _extractTraitsFromRawText(text) {
  const lines = text.split('\n');
  const traits = [];
  const rarities = ['common', 'rare', 'legendary', 'mythic'];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    let label = '';
    // Check if it's a JSON key-value line, e.g. "label": "Flame Boost" or "name": "Flame Boost"
    const jsonPropMatch = line.match(/"(?:label|name|text)"\s*:\s*"([^"]+)"/);
    if (jsonPropMatch) {
      label = jsonPropMatch[1].trim();
    } else {
      // Regular text/markdown bullet point
      const match = line.match(/^[-*+•]?\s*(?:\d+[\.)]\s*)?["']?([^"'\-\*•\d].*?)["']?$/);
      if (match) {
        label = match[1].trim();
        // Remove trailing commas, braces, quotes, or JSON brackets
        label = label.replace(/[,{}\[\]"']/g, '').trim();
      }
    }

    // Clean common prefixes if it got parsed as "label: Flame Boost" or "name: Flame Boost"
    if (label.toLowerCase().startsWith('label:')) {
      label = label.slice(6).trim();
    } else if (label.toLowerCase().startsWith('name:')) {
      label = label.slice(5).trim();
    }
    
    if (label && label.length > 2 && !label.toLowerCase().includes('traits') && !label.toLowerCase().includes('schema')) {
      const rarity = rarities[Math.floor(Math.random() * 1.5)];
      traits.push({ label, rarity });
    }
  }
  return traits;
}

function _parseTraitsResponse(content) {
  try {
    const result = cleanAndParseJson(content);
    let list = null;
    if (Array.isArray(result)) {
      list = result;
    } else if (result && typeof result === 'object') {
      for (const key of Object.keys(result)) {
        if (Array.isArray(result[key])) {
          list = result[key];
          break;
        }
      }
    }
    
    if (list && list.length > 0) {
      return list.map(item => {
        if (typeof item === 'string') {
          return { label: item, rarity: 'common' };
        }
        return {
          label: item.label || item.name || item.text || '',
          rarity: item.rarity || item.tier || 'common'
        };
      }).filter(t => t.label);
    }
  } catch (e) {
    console.warn("JSON parsing failed, falling back to line-by-line regex parsing:", e);
  }
  
  return _extractTraitsFromRawText(content);
}

function _parseWheelResponse(content) {
  let name = 'Custom Wheel';
  let icon = '🎡';
  let traits = [];
  
  try {
    const result = cleanAndParseJson(content);
    if (result && typeof result === 'object') {
      name = result.name || result.title || name;
      icon = result.icon || result.emoji || icon;
      
      let list = null;
      if (Array.isArray(result.traits)) {
        list = result.traits;
      } else {
        for (const key of Object.keys(result)) {
          if (Array.isArray(result[key])) {
            list = result[key];
            break;
          }
        }
      }
      
      if (list) {
        traits = list.map(item => {
          if (typeof item === 'string') return { label: item, rarity: 'common' };
          return {
            label: item.label || item.name || item.text || '',
            rarity: item.rarity || item.tier || 'common'
          };
        }).filter(t => t.label);
      }
    }
  } catch (e) {
    console.warn("JSON parsing failed for wheel, using text parsing fallback:", e);
  }
  
  if (traits.length === 0) {
    traits = _extractTraitsFromRawText(content);
  }
  
  return { name, icon, traits };
}

// ─── Wheel Folders & Packages Helper Functions ─────────────────
function _renderFolderManager(wheelGroups, wheels) {
  let filteredGroups = wheelGroups || [];
  if (folderSearchQuery.trim()) {
    const q = folderSearchQuery.toLowerCase().trim();
    filteredGroups = filteredGroups.filter(g => g.name.toLowerCase().includes(q));
  }

  return `
    <div class="wheel-folders-bar" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:12px 16px; margin:16px 0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex:1;">
        <span style="font-family:var(--font-display); font-weight:700; font-size:13px; color:var(--gold); display:flex; align-items:center; gap:6px; white-space:nowrap;">
          📁 Wheel Folders
        </span>
        <input type="text" id="folder-search-input" class="input" placeholder="🔍 Filter folders..." value="${escapeHtml(folderSearchQuery)}" style="width:140px; font-size:11px; padding:4px 8px; border-radius:6px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${filteredGroups.map(group => {
            const validCount = (group.wheelIds || []).filter(wId => wheels.some(w => w.id === wId)).length;
            return `
              <div
                data-select-group="${group.id}"
                style="display:flex; align-items:center; gap:6px; background:${group.active ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${group.active ? 'var(--cyan)' : 'rgba(255,255,255,0.08)'}; padding:4px 10px; border-radius:20px; font-size:12px; cursor:pointer; transition:all 0.2s ease;"
                title="Click to focus this folder"
              >
                <span>${group.icon ?? '📁'} <strong>${escapeHtml(group.name)}</strong></span>
                <span style="font-size:10px; opacity:0.6;">(${validCount})</span>
                <button class="btn btn-ghost btn-sm" data-toggle-group="${group.id}" style="font-size:10px; padding:1px 6px; font-weight:bold; color:${group.active ? '#00ffaa' : 'rgba(255,255,255,0.4)'};" title="Toggle active ON/OFF">
                  ${group.active ? '● Active' : '○ Off'}
                </button>
                <button class="btn btn-ghost btn-sm btn-icon" data-duplicate-group="${group.id}" title="Duplicate folder" style="font-size:10px; padding:1px 4px; opacity:0.7;">📋</button>
                ${wheelGroups.length > 1 ? `
                  <button class="btn btn-ghost btn-sm btn-icon" data-delete-group="${group.id}" title="Delete folder" style="font-size:10px; padding:1px 4px; opacity:0.7;">🗑</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" id="create-group-btn" style="font-size:11px;">+ New Folder</button>
    </div>
  `;
}

function _showCreateFolderModal(container, state) {
  // Sort wheels by most recently created first
  const sortedWheels = [...state.wheels].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  openModal({
    title: '📁 Create New Wheel Folder',
    content: `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.7); display:block; margin-bottom:4px;">Folder Name</label>
          <input type="text" id="new-group-name" class="input" placeholder="E.g., Cyberpunk Powers, Anime RPG..." value="" style="width:100%;">
        </div>
        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.7); display:block; margin-bottom:4px;">Icon Emoji</label>
          <select id="new-group-icon" class="input" style="width:100%; font-size:14px; padding:6px 10px;">
            <option value="📁">📁 Default Folder</option>
            <option value="⚔️">⚔️ High Fantasy / RPG</option>
            <option value="🚀">🚀 Sci-Fi & Cyberpunk</option>
            <option value="🧙">🧙 Magic & Sorcery</option>
            <option value="⚡">⚡ Superpowers & Mutants</option>
            <option value="🧬">🧬 Race & Lineages</option>
            <option value="💀">💀 Weaknesses & Curses</option>
            <option value="🦸">🦸 Superhero League</option>
            <option value="🐉">🐉 Mythical Beasts</option>
            <option value="🕵️">🕵️ Mystery & Noir</option>
            <option value="🌌">🌌 Cosmic & Eldritch</option>
            <option value="🏆">🏆 Champions & Arena</option>
          </select>
        </div>
        <div>
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; color:var(--cyan);">
            <input type="checkbox" id="single-active-checkbox" checked>
            <span>Set as only active folder (start empty with 0 wheels)</span>
          </label>
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; color:rgba(255,255,255,0.7);">Or Select Existing Wheels to Include (Newest First):</label>
          </div>
          <input type="text" id="modal-wheel-filter" class="input" placeholder="🔍 Filter wheels..." style="width:100%; font-size:11px; padding:4px 8px; margin-bottom:6px;">
          <div id="modal-wheels-container" style="display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:8px; border-radius:8px;">
            ${sortedWheels.map(w => `
              <label class="modal-wheel-item" data-wheel-name="${escapeHtml(w.name).toLowerCase()}" style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" data-group-wheel-id="${w.id}">
                <span>${w.icon} ${escapeHtml(w.name)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <button class="btn btn-primary" id="confirm-create-group-btn" style="width:100%;">Create Folder</button>
      </div>
    `
  });

  const filterInput = document.querySelector('#modal-wheel-filter');
  filterInput?.addEventListener('input', () => {
    const q = filterInput.value.toLowerCase().trim();
    document.querySelectorAll('.modal-wheel-item').forEach(item => {
      const name = item.dataset.wheelName || '';
      item.style.display = name.includes(q) ? 'flex' : 'none';
    });
  });

  document.querySelector('#confirm-create-group-btn')?.addEventListener('click', () => {
    const nameInput = document.querySelector('#new-group-name');
    const iconSelect = document.querySelector('#new-group-icon');
    const singleActiveCheck = document.querySelector('#single-active-checkbox');
    const checkedEls = document.querySelectorAll('[data-group-wheel-id]:checked');
    const wheelIds = Array.from(checkedEls).map(el => el.dataset.groupWheelId);

    const name = nameInput?.value?.trim() || 'New Folder';
    const icon = iconSelect?.value || '📁';
    const makeSingleActive = singleActiveCheck?.checked ?? true;

    const group = store.addWheelGroup({ name, icon, active: true, makeSingleActive, wheelIds });
    closeModal();
    showToast(`Created folder "${group.name}"!`, 'success');
  });
}
