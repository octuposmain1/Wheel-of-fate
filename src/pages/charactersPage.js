// ============================================================
// charactersPage.js — Character History & Library
// ============================================================

import { store } from '../utils/store.js';
import { RARITY_TIERS } from '../utils/rarity.js';
import { showToast, openModal, closeModal } from '../components/toast.js';
import { router } from '../utils/router.js';

let unsubscribe = null;

export function renderCharactersPage(container) {
  const state = store.getState();
  _render(container, state);
  _bindEvents(container);

  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe((newState) => {
    _render(container, newState);
    _bindEvents(container);
  });
}

export function unmountCharactersPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function _render(container, state) {
  const { characters } = state;
  const sorted = [...characters].sort((a, b) => b.createdAt - a.createdAt);

  container.innerHTML = `
    <div class="page">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 class="page-title">📜 Character Library</h1>
          <p class="page-subtitle">${characters.length} character${characters.length !== 1 ? 's' : ''} generated</p>
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          ${characters.length > 0 ? `
            <button class="btn btn-danger btn-sm" id="clear-all-chars-btn" aria-label="Delete all characters">🗑 Clear All</button>
          ` : ''}
          <button class="btn btn-primary" id="new-char-btn" aria-label="Generate new character">⚡ New Character</button>
        </div>
      </div>

      ${characters.length === 0 ? `
        <div class="empty-state" style="margin-top:80px;">
          <span class="empty-state-icon">🏆</span>
          <p>No characters yet! Head to the Spin page to generate your first character.</p>
          <button class="btn btn-primary btn-lg" id="go-spin-btn">⚡ Start Spinning</button>
        </div>
      ` : `
        <div class="char-grid" role="list" aria-label="Character library">
          ${sorted.map(char => _renderCharCard(char, state.wheels)).join('')}
        </div>
      `}
    </div>
  `;
}

function _renderCharCard(char, wheels) {
  const date = new Date(char.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Find highest rarity
  const rarityOrder = { mythic: 4, legendary: 3, rare: 2, common: 1 };
  const highest = char.traits.reduce((best, lt) => {
    return (rarityOrder[lt.trait.rarity] ?? 0) > (rarityOrder[best?.trait?.rarity] ?? 0) ? lt : best;
  }, null);

  const borderColor = highest ? RARITY_TIERS[highest.trait.rarity]?.color : 'transparent';

  return `
    <div
      class="char-card"
      data-char-id="${char.id}"
      role="listitem"
      aria-label="${char.name}"
      style="border-top-color: ${borderColor}; border-top-width: 3px;"
    >
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div class="char-card-name">${escapeHtml(char.name)}</div>
        <div style="display:flex; gap:6px;">
          <button
            class="btn btn-ghost btn-sm btn-icon"
            data-rename-char="${char.id}"
            aria-label="Rename ${char.name}"
            title="Rename"
          >✏️</button>
          <button
            class="btn btn-danger btn-sm btn-icon"
            data-delete-char="${char.id}"
            aria-label="Delete ${char.name}"
            title="Delete"
          >✕</button>
        </div>
      </div>

      <div class="char-card-traits">
        ${char.traits.map(({ wheelId, trait }) => {
          const whl = wheels.find(w => w.id === wheelId);
          return `
            <div class="char-card-trait">
              <span class="char-card-trait-wheel">${whl?.icon ?? ''} ${whl?.name ?? 'Unknown'}</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="char-card-trait-value">${escapeHtml(trait.label)}</span>
                <span class="rarity-badge rarity-${trait.rarity}" style="font-size:9px; padding:1px 5px;">${RARITY_TIERS[trait.rarity].icon}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${char.backstory ? `
        <div class="char-card-backstory">"${escapeHtml(char.backstory)}"</div>
      ` : ''}

      <div class="char-card-date">Created ${date}</div>

      ${highest && (highest.trait.rarity === 'mythic' || highest.trait.rarity === 'legendary') ? `
        <div style="position:absolute; top:12px; right:12px; font-size:20px; opacity:0.6;" aria-hidden="true">
          ${RARITY_TIERS[highest.trait.rarity].icon}
        </div>
      ` : ''}
    </div>
  `;
}

function _bindEvents(container) {
  container.querySelector('#new-char-btn')?.addEventListener('click', () => router.navigate('/spin'));
  container.querySelector('#go-spin-btn')?.addEventListener('click', () => router.navigate('/spin'));

  container.querySelector('#clear-all-chars-btn')?.addEventListener('click', () => {
    const state = store.getState();
    if (state.characters.length === 0) return;
    if (confirm(`Delete all ${state.characters.length} characters? This cannot be undone.`)) {
      state.characters.forEach(c => store.deleteCharacter(c.id));
      showToast('All characters deleted', 'info');
    }
  });

  container.querySelectorAll('[data-delete-char]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = btn.dataset.deleteChar;
      const char = store.getState().characters.find(c => c.id === charId);
      if (char && confirm(`Delete "${char.name}"?`)) {
        store.deleteCharacter(charId);
        showToast(`Deleted "${char.name}"`, 'info');
      }
    });
  });

  container.querySelectorAll('[data-rename-char]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = btn.dataset.renameChar;
      const char = store.getState().characters.find(c => c.id === charId);
      if (!char) return;

      openModal({
        title: '✏️ Rename Character',
        content: `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <input class="input" id="rename-input" type="text" value="${escapeHtml(char.name)}" maxlength="60" autofocus />
            <div style="display:flex; gap:12px;">
              <button class="btn btn-primary" id="confirm-rename" style="flex:1;">Rename</button>
              <button class="btn btn-ghost" id="cancel-rename">Cancel</button>
            </div>
          </div>
        `,
      });

      document.querySelector('#confirm-rename')?.addEventListener('click', () => {
        const newName = document.querySelector('#rename-input')?.value.trim();
        if (!newName) return;
        // Update character name in store
        const state = store.getState();
        const updated = state.characters.map(c =>
          c.id === charId ? { ...c, name: newName } : c
        );
        // Directly update localStorage since store doesn't have updateCharacter
        try {
          const raw = localStorage.getItem('wheel_of_fate_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.characters = updated;
            localStorage.setItem('wheel_of_fate_v1', JSON.stringify(parsed));
          }
        } catch (e) {}
        closeModal();
        // Force reload from storage
        window.dispatchEvent(new Event('storage'));
        showToast(`Renamed to "${newName}"`, 'success');
        // Re-render
        _render(container, { ...state, characters: updated });
        _bindEvents(container);
      });

      document.querySelector('#cancel-rename')?.addEventListener('click', closeModal);
      document.querySelector('#rename-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.querySelector('#confirm-rename')?.click();
      });
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
