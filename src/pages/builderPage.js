// ============================================================
// builderPage.js — Wheel Builder UI (Full CRUD)
// ============================================================

import { store } from '../utils/store.js';
import { RARITY_TIERS, RARITY_KEYS, getSegmentSizes } from '../utils/rarity.js';
import { showToast, openModal, closeModal } from '../components/toast.js';

const WHEEL_ICONS = ['🎡','🧬','🩸','⚡','💀','🗡️','🛡️','🌊','🔥','❄️','⚡','🌪️','☠️','👁️','🌙','☀️','🎭','🦋','🐉','💎'];

let selectedWheelId = null;
let unsubscribe = null;

export function renderBuilderPage(container) {
  const state = store.getState();
  if (!selectedWheelId && state.wheels.length) {
    selectedWheelId = state.wheels[0].id;
  }

  _render(container, store.getState());

  // Subscribe to store changes
  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe((newState) => {
    _render(container, newState);
    _bindEvents(container, newState);
  });

  _bindEvents(container, state);
}

export function unmountBuilderPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

// ─── Render ────────────────────────────────────────────────────
function _render(container, state) {
  const { wheels } = state;
  const selectedWheel = wheels.find(w => w.id === selectedWheelId) ?? wheels[0] ?? null;

  // Save scroll position for trait list
  const traitList = container.querySelector('.traits-list');
  const scrollTop = traitList ? traitList.scrollTop : 0;

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">🎡 Wheel Builder</h1>
      <p class="page-subtitle">Create and customize spinning wheels with weighted rarity traits.</p>

      <div class="builder-layout">
        <!-- ─── Sidebar: Wheel List ─── -->
        <aside class="builder-sidebar" aria-label="Wheel list">
          <div class="builder-sidebar-header">
            <p class="section-title" style="margin:0;">Your Wheels</p>
            <button class="btn btn-primary btn-sm" id="add-wheel-btn" aria-label="Create new wheel">+ New</button>
          </div>

          <nav class="wheel-list" role="list" aria-label="Wheels">
            ${wheels.map(w => `
              <div
                class="wheel-list-item ${w.id === selectedWheel?.id ? 'active' : ''}"
                data-select-wheel="${w.id}"
                role="listitem"
                tabindex="0"
                aria-selected="${w.id === selectedWheel?.id}"
                aria-label="${w.name}, ${w.traits.length} traits"
              >
                <span class="wheel-list-item-icon" aria-hidden="true">${w.icon}</span>
                <div class="wheel-list-item-info">
                  <div class="wheel-list-item-name">${escapeHtml(w.name)}</div>
                  <div class="wheel-list-item-count">${w.traits.length} trait${w.traits.length !== 1 ? 's' : ''}</div>
                </div>
                <button
                  class="trait-delete-btn"
                  data-delete-wheel="${w.id}"
                  aria-label="Delete ${w.name} wheel"
                  title="Delete wheel"
                >🗑</button>
              </div>
            `).join('')}
          </nav>
        </aside>

        <!-- ─── Editor: Traits ─── -->
        <div class="wheel-editor" role="main" aria-label="Wheel editor">
          ${selectedWheel ? _renderEditor(selectedWheel) : _renderNoWheel()}
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

function _renderEditor(wheel) {
  const totalWeight = wheel.traits.reduce((s, t) => s + (RARITY_TIERS[t.rarity]?.weight ?? 60), 0);

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
        <span style="font-size:12px; color:rgba(255,255,255,0.3);">${wheel.traits.length} traits</span>
      </div>
    </div>

    <!-- Rarity Distribution -->
    <div style="margin-bottom:24px;">
      <p class="section-title">Rarity Distribution</p>
      <div class="rarity-dist" style="height:10px; margin-bottom:8px;" aria-label="Rarity distribution">
        ${buildRarityBar(wheel.traits)}
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        ${RARITY_KEYS.map(k => {
          const count = wheel.traits.filter(t => t.rarity === k).length;
          return `<span class="rarity-badge rarity-${k}" aria-label="${RARITY_TIERS[k].label}: ${count} traits">${RARITY_TIERS[k].icon} ${RARITY_TIERS[k].label} (${count})</span>`;
        }).join('')}
      </div>
    </div>

    <!-- Traits List -->
    <p class="section-title">Traits</p>
    <div class="traits-list" id="traits-list" role="list" aria-label="Traits list">
      ${wheel.traits.length === 0
        ? `<div class="empty-state" style="padding:32px;"><span class="empty-state-icon" style="font-size:40px;">📝</span><p style="font-size:14px;">Add your first trait below!</p></div>`
        : wheel.traits.map((trait, idx) => `
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
              ${RARITY_KEYS.map(k => `
                <option value="${k}" ${trait.rarity === k ? 'selected' : ''} style="background:#12121f;">
                  ${RARITY_TIERS[k].icon} ${RARITY_TIERS[k].label}
                </option>
              `).join('')}
            </select>
            <span class="rarity-badge rarity-${trait.rarity}" style="font-size:9px; padding:2px 6px;">${RARITY_TIERS[trait.rarity].weight}%</span>
            <button
              class="trait-delete-btn"
              data-delete-trait="${trait.id}"
              aria-label="Delete trait: ${trait.label}"
            >✕</button>
          </div>
        `).join('')
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
        ${RARITY_KEYS.map(k => `
          <option value="${k}" style="background:#12121f;">${RARITY_TIERS[k].icon} ${RARITY_TIERS[k].label}</option>
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

// ─── Bind Events ───────────────────────────────────────────────
function _bindEvents(container, state) {
  const wheel = state.wheels.find(w => w.id === selectedWheelId);

  // Select wheel
  container.querySelectorAll('[data-select-wheel]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-wheel]')) return;
      selectedWheelId = el.dataset.selectWheel;
      _render(container, store.getState());
      _bindEvents(container, store.getState());
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.target.closest('[data-delete-wheel]')) {
        selectedWheelId = el.dataset.selectWheel;
        _render(container, store.getState());
        _bindEvents(container, store.getState());
      }
    });
  });

  // Add wheel
  container.querySelector('#add-wheel-btn')?.addEventListener('click', () => {
    _showAddWheelModal();
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

  // Sort by rarity
  container.querySelector('#sort-by-rarity-btn')?.addEventListener('click', () => {
    const order = { mythic: 0, legendary: 1, rare: 2, common: 3 };
    const sorted = [...wheel.traits].sort((a, b) => order[a.rarity] - order[b.rarity]);
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
function buildRarityBar(traits) {
  if (!traits.length) return '';
  const counts = { common: 0, rare: 0, legendary: 0, mythic: 0 };
  traits.forEach(t => { counts[t.rarity] = (counts[t.rarity] || 0) + 1; });
  const total = traits.length;
  const colors = { common: '#8a9ba8', rare: '#00b4ff', legendary: '#ffd700', mythic: '#ff3366' };

  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([key, count]) =>
      `<div class="rarity-dist-segment" style="flex:${count/total}; background:${colors[key]}; opacity:0.8;"></div>`
    ).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
