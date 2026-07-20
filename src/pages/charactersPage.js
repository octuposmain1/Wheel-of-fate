// ============================================================
// charactersPage.js — Character History & Library
// ============================================================

import { store } from '../utils/store.js';
import { getTierById, getTierIntensity, isDramaticTier, hexToRgba, renderRpgStatsSheet, proceduralFallbackPowerSystem } from '../utils/rarity.js';
import { showToast, openModal, closeModal, showAiLoadingModal } from '../components/toast.js';
import { requireApiKey, callAiChat, cleanAndParseJson } from '../utils/ai.js';
import { router } from '../utils/router.js';

let unsubscribe = null;
const expandedCharIds = new Set();
let charSearchQuery = '';

function _updateCharactersPage(container) {
  _render(container, store.getState());
  _bindEvents(container);
}

export function renderCharactersPage(container) {
  _updateCharactersPage(container);

  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe(() => {
    _updateCharactersPage(container);
  });
}

export function unmountCharactersPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function _render(container, state) {
  const { characters } = state;
  const sorted = [...characters].sort((a, b) => b.createdAt - a.createdAt);
  
  let filtered = sorted;
  if (charSearchQuery.trim()) {
    const q = charSearchQuery.toLowerCase().trim();
    filtered = sorted.filter(c => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchClass = (c.powerSystem?.classOrType || '').toLowerCase().includes(q);
      const matchSystem = (c.powerSystem?.systemName || '').toLowerCase().includes(q);
      const matchTrait = c.traits.some(t => t.trait.label.toLowerCase().includes(q));
      return matchName || matchClass || matchSystem || matchTrait;
    });
  }

  const allExpanded = characters.length > 0 && characters.every(c => expandedCharIds.has(c.id));

  container.innerHTML = `
    <div class="page">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 class="page-title">📜 Character Library</h1>
          <p class="page-subtitle">${filtered.length} of ${characters.length} character${characters.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          ${characters.length > 0 ? `
            <button class="btn btn-secondary btn-sm" id="toggle-all-chars-btn" aria-label="Toggle collapse all characters">
              ${allExpanded ? '📂 Collapse All' : '📖 Expand All'}
            </button>
            <button class="btn btn-danger btn-sm" id="clear-all-chars-btn" aria-label="Delete all characters">🗑 Clear All</button>
          ` : ''}
          <button class="btn btn-primary" id="new-char-btn" aria-label="Generate new character">⚡ New Character</button>
        </div>
      </div>

      ${characters.length > 0 ? `
        <div style="margin-bottom:16px;">
          <input type="text" id="char-search-input" class="input" placeholder="🔍 Search characters by name, class, or trait..." value="${escapeHtml(charSearchQuery)}" style="width:100%; max-width:420px; font-size:12px; padding:8px 12px; border-radius:8px;">
        </div>
      ` : ''}

      ${filtered.length === 0 ? `
        <div class="empty-state" style="margin-top:60px;">
          <span class="empty-state-icon">${characters.length === 0 ? '🏆' : '🔍'}</span>
          <p>${characters.length === 0 ? 'No characters yet! Head to the Spin page to generate your first character.' : `No characters found matching "${escapeHtml(charSearchQuery)}".`}</p>
          ${characters.length === 0 ? `<button class="btn btn-primary btn-lg" id="go-spin-btn">⚡ Start Spinning</button>` : ''}
        </div>
      ` : `
        <div class="char-grid" role="list" aria-label="Character library">
          ${filtered.map(char => _renderCharCard(char, state.wheels, state.rarityTiers)).join('')}
        </div>
      `}
    </div>
  `;
}

function _renderCharCard(char, wheels, tiers) {
  const isExpanded = expandedCharIds.has(char.id);
  const date = new Date(char.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Clean legacy hardcoded anime systems (Ki Circuit, Nen, Chakra) from old saved cards
  if (char.powerSystem && (char.powerSystem.systemName?.includes('Ki Circuit') || char.powerSystem.systemName?.includes('Nen') || char.powerSystem.systemName?.includes('Chakra') || char.powerSystem.systemName?.includes('Stand Power'))) {
    char.powerSystem = proceduralFallbackPowerSystem(char.traits, tiers, wheels);
  }

  // Find highest rarity
  const highest = char.traits.reduce((best, lt) => {
    return getTierIntensity(tiers, lt.trait.rarity) > getTierIntensity(tiers, best?.trait?.rarity) ? lt : best;
  }, null);

  const borderColor = highest ? getTierById(tiers, highest.trait.rarity).color : 'transparent';
  const potentialScore = char.powerSystem?.stats?.combatPower ?? 50;

  return `
    <div
      class="char-card"
      data-char-id="${char.id}"
      role="listitem"
      aria-label="${char.name}"
      style="border-top-color: ${borderColor}; border-top-width: 3px; transition: all 0.3s ease;"
    >
      <!-- Compact Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:${isExpanded ? '12px' : '4px'};">
        <div>
          <div class="char-card-name" style="display:flex; align-items:center; gap:8px;">
            ${escapeHtml(char.name)}
            <span style="font-size:10px; padding:2px 8px; border-radius:12px; background:rgba(255,215,0,0.12); color:var(--gold); font-weight:700; border:1px solid rgba(255,215,0,0.3);">
              ✨ ${potentialScore} Potential
            </span>
          </div>
          ${char.powerSystem ? `
            <div style="font-size:10px; color:var(--cyan); font-weight:600; margin-top:2px;">
              ⚡ ${escapeHtml(char.powerSystem.systemName)}: ${escapeHtml(char.powerSystem.classOrType)}
            </div>
          ` : ''}
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button
            class="btn btn-ghost btn-sm"
            data-toggle-card="${char.id}"
            style="font-size:11px; padding:4px 8px;"
            title="${isExpanded ? 'Collapse' : 'Expand'}"
          >
            ${isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
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

      ${!isExpanded ? `
        <!-- Condensed View -->
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">
          ${char.traits.map(({ trait }) => {
            const tier = getTierById(tiers, trait.rarity);
            return `
              <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:${hexToRgba(tier.color, 0.12)}; color:${tier.color}; border:1px solid ${hexToRgba(tier.color, 0.3)};">
                ${escapeHtml(trait.label)}
              </span>
            `;
          }).join('')}
        </div>
        <div class="char-card-date" style="margin-top:8px;">Created ${date}</div>
      ` : `
        <!-- Expanded Full View -->
        <div class="char-card-traits" style="margin-top:12px;">
          ${char.traits.map(({ wheelId, trait }) => {
            const whl = wheels.find(w => w.id === wheelId);
            const tier = getTierById(tiers, trait.rarity);
            return `
              <div class="char-card-trait">
                <span class="char-card-trait-wheel">${whl?.icon ?? ''} ${whl?.name ?? 'Unknown'}</span>
                <div style="display:flex; align-items:center; gap:6px;">
                  <span class="char-card-trait-value">${escapeHtml(trait.label)}</span>
                  <span class="rarity-badge ${isDramaticTier(tiers, trait.rarity) ? 'rarity-badge-dramatic' : ''}" style="font-size:9px; padding:1px 5px; background:${hexToRgba(tier.color, 0.15)}; color:${tier.color}; border:1px solid ${hexToRgba(tier.color, 0.4)};"><span class="rarity-dot" style="background:${tier.color};"></span></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${char.backstory ? `
          <div class="char-card-backstory" style="margin-top:12px;">"${escapeHtml(char.backstory)}"</div>
        ` : ''}

        <div class="char-card-date" style="margin-top:10px;">Created ${date}</div>

        <div style="display:flex; gap:6px; margin-top:12px;">
          <button class="btn btn-secondary btn-sm" data-view-power="${char.id}" style="flex:1; font-size:11px;">
            📊 Power Sheet
          </button>
          <button class="btn btn-primary btn-sm" data-gen-story="${char.id}" style="flex:1; font-size:11px;">
            📖 ${char.backstory ? 'Re-weave Story' : 'Generate Story'}
          </button>
        </div>
      `}

      ${highest && isDramaticTier(tiers, highest.trait.rarity) ? `
        <div style="position:absolute; top:12px; right:12px;" aria-hidden="true">
          <span class="rarity-dot" style="width:14px; height:14px; background:${getTierById(tiers, highest.trait.rarity).color}; box-shadow:0 0 10px ${getTierById(tiers, highest.trait.rarity).color};"></span>
        </div>
      ` : ''}
    </div>
  `;
}

function _bindEvents(container) {
  container.querySelector('#new-char-btn')?.addEventListener('click', () => router.navigate('/spin'));
  container.querySelector('#go-spin-btn')?.addEventListener('click', () => router.navigate('/spin'));

  container.querySelector('#toggle-all-chars-btn')?.addEventListener('click', () => {
    const chars = store.getState().characters;
    const allExpanded = chars.length > 0 && chars.every(c => expandedCharIds.has(c.id));
    if (allExpanded) {
      expandedCharIds.clear();
    } else {
      chars.forEach(c => expandedCharIds.add(c.id));
    }
    _render(container, store.getState());
    _bindEvents(container);
  });

  const searchInput = container.querySelector('#char-search-input');
  searchInput?.addEventListener('input', () => {
    charSearchQuery = searchInput.value;
    const q = charSearchQuery.toLowerCase().trim();
    container.querySelectorAll('.char-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? 'flex' : 'none';
    });
  });

  container.querySelectorAll('[data-toggle-card]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = btn.dataset.toggleCard;
      if (expandedCharIds.has(charId)) {
        expandedCharIds.delete(charId);
      } else {
        expandedCharIds.add(charId);
      }
      _updateCharactersPage(container);
    });
  });

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

  container.querySelectorAll('[data-view-power]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = btn.dataset.viewPower;
      const char = store.getState().characters.find(c => c.id === charId);
      if (!char) return;

      const tiers = store.getState().rarityTiers;
      if (!char.powerSystem) {
        const generatedPower = proceduralFallbackPowerSystem(char.traits, tiers);
        store.updateCharacterPower(char.id, generatedPower);
        char.powerSystem = generatedPower;
      }

      openModal({
        title: `📊 RPG Power Sheet: ${escapeHtml(char.name)}`,
        content: `
          <div style="background:rgba(255,255,255,0.02); backdrop-filter:blur(20px); border-radius:12px; padding:4px;">
            ${renderRpgStatsSheet(char.powerSystem, char.backstory)}
            <button class="btn btn-primary" id="close-power-modal-btn" style="margin-top:20px; width:100%;">Close</button>
          </div>
        `,
      });
      document.querySelector('#close-power-modal-btn')?.addEventListener('click', closeModal);
    });
  });

  container.querySelectorAll('[data-gen-story]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = btn.dataset.genStory;
      const char = store.getState().characters.find(c => c.id === charId);
      if (!char) return;
      _generateCharacterStory(char, container);
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
        store.updateCharacter(charId, { name: newName });
        closeModal();
        showToast(`Renamed to "${newName}"`, 'success');
      });

      document.querySelector('#cancel-rename')?.addEventListener('click', closeModal);
      document.querySelector('#rename-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.querySelector('#confirm-rename')?.click();
      });
    });
  });
}

function _generateCharacterStory(char, container) {
  const tiers = store.getState().rarityTiers;
  const traitSummary = char.traits
    .map(({ wheelId, trait }) => {
      const whl = store.getState().wheels.find(w => w.id === wheelId);
      const tier = getTierById(tiers, trait.rarity);
      return `${whl?.name ?? 'Trait'}: ${trait.label} (${tier.label})`;
    })
    .join(', ');

  const precalculated = proceduralFallbackPowerSystem(char.traits, tiers, store.getState().wheels);
  const baselinePower = precalculated.stats.combatPower;

  const runWithApiKey = (apiKey) => {
    showAiLoadingModal({
      title: `📖 Weaving Story for ${char.name}`,
      subtitle: `Analyzing character traits and generating narrative...`,
      onCancel: () => runFreeFallback()
    });

    Promise.resolve().then(async () => {
      try {
        const systemPrompt = `You are a creative writer and RPG rules designer. Generate a combined fantasy backstory and power system evaluation for a character named "${char.name}" with these traits: ${traitSummary}.
Important context: This application is a character generator, RPG combat simulator, and fantasy trait builder. If any trait category represents a theme that is ambiguous (like 'race', 'class', etc.), interpret it strictly in a fantasy/RPG character context (e.g. 'race' refers to fantasy species like Elf, Dwarf, Orc, Human, rather than car racing).

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
    "ratingExpl": "A 2-sentence explanation focusing explicitly on combat utility."
  }
}`;

        const apiUrl = localStorage.getItem('openai_api_url') || 'https://api.groq.com/openai/v1';
        const modelName = localStorage.getItem('openai_model') || 'llama-3.1-8b-instant';

        const requestBody = {
          model: modelName,
          max_tokens: 800,
          messages: [{ role: 'user', content: systemPrompt }],
        };

        if (apiUrl.includes('api.openai.com') || apiUrl.includes('groq.com') || apiUrl.includes('openrouter.ai')) {
          requestBody.response_format = { type: "json_object" };
        }

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI request timed out')), 10000));
        const content = await Promise.race([callAiChat(apiUrl, apiKey, requestBody), timeoutPromise]);
        const parsed = cleanAndParseJson(content);

        if (parsed && parsed.backstory) {
          store.updateCharacter(char.id, {
            backstory: parsed.backstory,
            powerSystem: {
              ...precalculated,
              ...(parsed.powerSystem || {}),
              stats: {
                ...precalculated.stats,
                ...(parsed.powerSystem?.stats || {}),
                combatPower: baselinePower
              },
              rawPower: precalculated.rawPower,
              maxPotentialPL: precalculated.maxPotentialPL,
              breakdown: precalculated.breakdown
            }
          });
          closeModal();
          showToast(`Story generated for "${char.name}"!`, 'success');
        } else {
          throw new Error('Invalid backstory from model');
        }
      } catch (err) {
        console.error(err);
        showToast(`AI Notice: ${err.message}`, 'info', 5000);
        runFreeFallback();
      }
    });
  };

  const runFreeFallback = () => {
    const powerSystem = proceduralFallbackPowerSystem(char.traits, tiers);
    const traitLabels = char.traits.map(t => t.trait.label).join(', ');
    const backstory = `${char.name} is a legendary adventurer known throughout the realm. Wielding traits such as ${traitLabels}, they have mastered their unique power system: ${powerSystem.systemName}.`;

    store.updateCharacter(char.id, { backstory, powerSystem });
    closeModal();
    showToast(`Offline story generated for "${char.name}"!`, 'success');
  };

  requireApiKey(runWithApiKey, runFreeFallback);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
