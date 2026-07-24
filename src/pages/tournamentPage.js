// ============================================================
// tournamentPage.js — Character Tournament Bracket Mode
// ============================================================

import { store } from '../utils/store.js';
import { getPowerScore, isNegativeWheel, getTierIntensity, getTierById, proceduralFallbackPowerSystem, getTiersForCharacter } from '../utils/rarity.js';
import { showToast, openModal, closeModal, showAiLoadingModal } from '../components/toast.js';
import { requireApiKey, callAiChat, cleanAndParseJson } from '../utils/ai.js';
import { router } from '../utils/router.js';
import { SpinWheel } from '../components/spinWheel.js';

let unsubscribe = null;
let fighterSearchQuery = '';

let tState = {
  phase: 'select', // 'select' | 'bracket'
  selectedIds: new Set(),
  rounds: [], // rounds[i] = [{ a, b, winner }]
  currentRoundIndex: 0,
  champion: null,
};

export function renderTournamentPage(container) {
  _renderAndBind(container);

  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe(() => {
    if (tState.phase === 'select') {
      _renderAndBind(container);
    }
  });
}

export function unmountTournamentPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function _resetTournament() {
  tState = {
    phase: 'select',
    selectedIds: new Set(),
    rounds: [],
    currentRoundIndex: 0,
    champion: null,
  };
}

/// ─── Power Score & Effective PL (PL matters heavily) ────────────
function computePower(character) {
  if (character.powerSystem?.stats?.combatPower) {
    return character.powerSystem.stats.combatPower;
  }
  const state = store.getState();
  const tiers = getTiersForCharacter(character, state);
  const wheels = state.wheels;
  const sys = proceduralFallbackPowerSystem(character.traits, tiers, wheels);
  return sys.stats.combatPower;
}

function computeRawPower(character) {
  if (character.powerSystem?.rawPower) {
    return character.powerSystem.rawPower;
  }
  const state = store.getState();
  const tiers = getTiersForCharacter(character, state);
  const wheels = state.wheels;
  const sys = proceduralFallbackPowerSystem(character.traits, tiers, wheels);
  return sys.rawPower;
}

// Effective Combat Rating: Raw PL (1.0x) + Potential (0.5x)
function computeEffectivePL(character) {
  return computeRawPower(character) + (computePower(character) * 0.5);
}

function getTraitRarityBonus(trait, tiers) {
  if (!trait || !trait.rarity) return 0;
  const intensity = getTierIntensity(tiers, trait.rarity);
  if (intensity >= 0.9) return 15; // Mythic (Godkiller Strike, Reality Bend, etc.)
  if (intensity >= 0.6) return 8;  // Legendary
  if (intensity >= 0.3) return 4;  // Rare
  return 0;
}

function resolveMatch(a, b) {
  if (!a) return b;
  if (!b) return a;
  const swing = () => 0.9 + Math.random() * 0.2; // +/-10% tactical swing
  const scoreA = computeEffectivePL(a) * swing();
  const scoreB = computeEffectivePL(b) * swing();
  return scoreA >= scoreB ? a : b;
}

// ─── Local Clash Generator ─────────────────────────────────────
function getMultiTraitCombo(traits) {
  if (!traits || traits.length === 0) {
    return { label: 'Ability', summary: 'Ability' };
  }
  if (traits.length === 1) {
    return { label: traits[0].trait.label, summary: traits[0].trait.label };
  }
  const posTraits = traits.filter(t => !isNegativeWheel(t.wheelName));
  const pool = posTraits.length >= 2 ? posTraits : traits;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const count = Math.min(shuffled.length, Math.random() > 0.3 ? 2 : 3);
  const picked = shuffled.slice(0, count);
  const labels = picked.map(p => p.trait.label);

  return {
    label: labels.slice(0, 2).join('+'),
    summary: labels.join(' & ')
  };
}

// ─── Local Clash Generator ─────────────────────────────────────
function generateLocalClashSegments(a, b, count, startIndex) {
  const wheelTraits = [];
  const traitsA = a.traits.length > 0 ? a.traits : [{ trait: { label: 'Physical Might', rarity: 'common' } }];
  const traitsB = b.traits.length > 0 ? b.traits : [{ trait: { label: 'Willpower', rarity: 'common' } }];
  const state = store.getState();
  const tiers = getTiersForCharacter(a, state);

  const effA = computeEffectivePL(a);
  const effB = computeEffectivePL(b);
  const plGapA = effA - effB;

  // 8 Consequence Rarity Wedge slots (Severity of Outcome)
  const slots = [
    { tier: 'common', points: 8 },
    { tier: 'common', points: 10 },
    { tier: 'common', points: 10 },
    { tier: 'common', points: 12 },
    { tier: 'rare', points: 16 },
    { tier: 'rare', points: 18 },
    { tier: 'legendary', points: 25 },
    { tier: 'mythic', points: 40 } // Miracle One-Shot Wedge
  ];

  for (let i = 0; i < Math.min(count, slots.length); i++) {
    const slot = slots[i];
    const ta = traitsA[Math.floor(Math.random() * traitsA.length)];
    const tb = traitsB[Math.floor(Math.random() * traitsB.length)];

    const comboA = getMultiTraitCombo(traitsA);
    const comboB = getMultiTraitCombo(traitsB);

    const bonusA = getTraitRarityBonus(ta.trait, tiers);
    const bonusB = getTraitRarityBonus(tb.trait, tiers);

    const roleA = a.powerSystem?.traitRoles?.[ta.trait.label];
    const roleB = b.powerSystem?.traitRoles?.[tb.trait.label];

    const hasCounterA = (roleB === 'negative' || isNegativeWheel(tb.wheelName));
    const hasCounterB = (roleA === 'negative' || isNegativeWheel(ta.wheelName));

    let winner = 'draw';
    let label = '';
    let combatLog = '';
    let points = slot.points;
    let isGlitched = false;

    let rollA = plGapA + bonusA + (hasCounterA ? 30 : 0) + (Math.random() * 10 - 5);
    let rollB = -plGapA + bonusB + (hasCounterB ? 30 : 0) + (Math.random() * 10 - 5);

    if (slot.tier === 'mythic') {
      if (plGapA > 30 && !hasCounterB) {
        winner = 'a';
        label = `${comboA.label} Overpower`;
        combatLog = `${a.name}'s massive Raw Power (${computeRawPower(a)} PL) overpowers ${b.name} with ${comboA.summary}!`;
      } else if (hasCounterB || rollB > rollA + 40) {
        winner = 'b';
        label = `${comboB.label} Counter`;
        combatLog = `${b.name} executes a fatal counter with ${comboB.summary}, exploiting ${a.name}'s weakness!`;
      } else {
        winner = 'a';
        label = `${comboA.label} Overpower`;
        combatLog = `${a.name} unleashes immense power (${computeRawPower(a)} PL), crushing ${b.name} with ${comboA.summary}!`;
      }
    } else if (slot.tier === 'legendary') {
      let rollA = plGapA + bonusA + (hasCounterA ? 30 : 0) + (Math.random() * 10 - 5);
      let rollB = -plGapA + bonusB + (hasCounterB ? 30 : 0) + (Math.random() * 10 - 5);
      if (rollA >= rollB) {
        winner = 'a';
        label = `${comboA.label} Finisher`;
        combatLog = `${a.name} uses ${comboA.summary} into an unstoppable finisher overwhelming ${b.name}!`;
      } else {
        winner = 'b';
        label = `${comboB.label} Finisher`;
        combatLog = `${b.name} uses ${comboB.summary} into an unstoppable finisher overwhelming ${a.name}!`;
      }
    } else if (slot.tier === 'rare') {
      let rollA = plGapA + bonusA + (Math.random() * 10 - 5);
      let rollB = -plGapA + bonusB + (Math.random() * 10 - 5);
      if (rollA > rollB + 5) {
        winner = 'a';
        label = `${comboA.label} Combo`;
        combatLog = `${a.name} uses ${comboA.summary} to outmaneuver ${b.name}!`;
      } else if (rollB > rollA + 5) {
        winner = 'b';
        label = `${comboB.label} Combo`;
        combatLog = `${b.name} uses ${comboB.summary} to outmaneuver ${a.name}!`;
      } else {
        winner = 'draw';
        label = `Clash Stalemate`;
        combatLog = `A high-intensity exchange between ${a.name}'s ${ta.trait.label} and ${b.name}'s ${tb.trait.label} ends in a deadlock!`;
      }
    } else {
      let rollA = plGapA + bonusA + (Math.random() * 10 - 5);
      let rollB = -plGapA + bonusB + (Math.random() * 10 - 5);
      if (rollA > rollB + 5) {
        winner = 'a';
        label = `${ta.trait.label} Strike`;
        combatLog = `${a.name} lands a solid hit using ${ta.trait.label}.`;
      } else if (rollB > rollA + 5) {
        winner = 'b';
        label = `${tb.trait.label} Strike`;
        combatLog = `${b.name} lands a solid hit using ${tb.trait.label}.`;
      } else {
        winner = 'draw';
        label = `Tactical Trade`;
        combatLog = `${a.name} and ${b.name} trade swift blows in a balanced exchange.`;
      }
    }

    if (winner === 'a') {
      const pl = computeRawPower(a);
      const plScale = Math.max(0.5, Math.min(2.5, 1 + (pl - 50) / 100));
      points = Math.round(points * plScale);
    } else if (winner === 'b') {
      const pl = computeRawPower(b);
      const plScale = Math.max(0.5, Math.min(2.5, 1 + (pl - 50) / 100));
      points = Math.round(points * plScale);
    }

    wheelTraits.push({
      id: `local-seg-${startIndex + i}-${Math.random().toString(36).substr(2, 4)}`,
      label: label.substring(0, 18),
      rarity: slot.tier,
      winner,
      points,
      isGlitched,
      combatLog
    });
  }

  return wheelTraits.sort(() => Math.random() - 0.5);
}

function lerpPowerPoints(tiers, rarityId) {
  const intensity = getTierIntensity(tiers, rarityId);
  return 10 + intensity * 20; // 10 to 30 points based on rarity
}

// ─── Interactive Fight Canvas & AI Clash ────────────────────────
async function _startFight(match, matchIndex, container) {
  const { a, b } = match;
  if (!b) return;

  const runWithApiKey = async (apiKey) => {
      let isCancelled = false;

      showAiLoadingModal({
        title: `⚔️ Simulating AI Clash`,
        subtitle: `Analyzing combat interactions between ${a.name} and ${b.name}...`,
        onCancel: () => {
          isCancelled = true;
          runFreeFallback();
        }
      });

      Promise.resolve().then(async () => {
        let wheelTraits = [];

        try {
          const traitSummaryA = a.traits.map(t => `${t.trait.label} (${t.trait.rarity})`).join(', ');
          const traitSummaryB = b.traits.map(t => `${t.trait.label} (${t.trait.rarity})`).join(', ');
          const rawA = computeRawPower(a);
          const rawB = computeRawPower(b);
          const effA = computeEffectivePL(a);
          const effB = computeEffectivePL(b);
          const leader = effA >= effB ? `Fighter A ("a")` : `Fighter B ("b")`;

          const systemPrompt = `You are a creative writer and RPG combat designer. Generate a list of custom clash matchup interactions between two fighters:
Fighter A ("a"): "${a.name}" (Power Level: ${rawA} PL, Effective PL: ${effA}) with traits: ${traitSummaryA}. Backstory: ${a.backstory || ''}.
Fighter B ("b"): "${b.name}" (Power Level: ${rawB} PL, Effective PL: ${effB}) with traits: ${traitSummaryB}. Backstory: ${b.backstory || ''}.

STRICT COMBAT & TRAIT RULES:
1. EXCLUSIVE TRAIT RULE: You MUST ONLY use the EXACT traits listed for each fighter above. NEVER invent, hallucinate, or insert unlisted abilities, generic energy terms (like 'Ki', 'Mana', 'Chakra', 'Nen'), or martial arts systems not present in the character's traits. If a fighter has only 1 trait listed, ALL of their combat actions MUST stem exclusively from that single trait.
2. POWER LEVEL (PL) RULE: ${leader} has higher PL (${Math.max(rawA, rawB)} vs ${Math.min(rawA, rawB)}) and MUST win at least 6 of the 8 clash segments.
3. MULTI-TRAIT SYNERGY: ONLY fuse multiple traits together if the fighter actually possesses more than 1 trait. If a fighter has only 1 trait, state that exact trait directly without inventing secondary abilities.
4. STRICT NAMES RULE: You MUST refer to Fighter A ONLY as "${a.name}" and Fighter B ONLY as "${b.name}". NEVER make up or substitute third-party character names (such as "Aria", "Arthur", "Kael", etc.) in the combat logs or labels.

Return a raw, unformatted JSON object matching this schema (do NOT wrap in markdown code blocks, do NOT include preamble):
{
  "segments": [
    {
      "label": "Clean interaction title (max 25 chars, DO NOT start with A: or B:)",
      "winner": "a" | "b" | "draw",
      "points": 8-40,
      "combatLog": "An exciting, high-quality narrative sentence describing how they clashed and how their exact traits resolved."
    }
  ]
}
Generate exactly 8 segments total matching the consequence schema.`;

          const apiUrl = localStorage.getItem('openai_api_url') || 'https://api.groq.com/openai/v1';
          const modelName = localStorage.getItem('openai_model') || 'llama-3.1-8b-instant';

          const requestBody = {
            model: modelName,
            max_tokens: 1200,
            messages: [{
              role: 'user',
              content: systemPrompt,
            }],
          };

          if (apiUrl.includes('api.openai.com') || apiUrl.includes('groq.com') || apiUrl.includes('openrouter.ai')) {
            requestBody.response_format = { type: "json_object" };
          }

          // Timeout safety: 10s maximum for AI response
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI request timed out')), 10000));
          const content = await Promise.race([callAiChat(apiUrl, apiKey, requestBody), timeoutPromise]);
          const result = cleanAndParseJson(content);

          if (isCancelled) return;
          
          if (Array.isArray(result.segments) && result.segments.length > 0) {
            wheelTraits = result.segments.map((seg, i) => {
              let rarity = 'common';
              if (seg.points >= 25) rarity = 'mythic';
              else if (seg.points >= 20) rarity = 'legendary';
              else if (seg.points >= 15) rarity = 'rare';

              let label = (seg.label || 'Clash').replace(/^(a|b|draw):\s*/i, '');
              if (label.length > 18) {
                label = label.substring(0, 16) + '..';
              }

              let points = seg.points;
              if (seg.winner === 'a') {
                const pl = computeRawPower(a);
                const plScale = Math.max(0.5, Math.min(2.5, 1 + (pl - 50) / 100));
                points = Math.round(points * plScale);
              } else if (seg.winner === 'b') {
                const pl = computeRawPower(b);
                const plScale = Math.max(0.5, Math.min(2.5, 1 + (pl - 50) / 100));
                points = Math.round(points * plScale);
              }

              return {
                id: `fight-seg-${i}`,
                label: label,
                rarity: rarity,
                winner: seg.winner,
                points: points,
                combatLog: seg.combatLog
              };
            });

            // Safeguard backfill if < 6
            if (wheelTraits.length < 6) {
              const needed = 8 - wheelTraits.length;
              const fallbackSegments = generateLocalClashSegments(a, b, needed, wheelTraits.length);
              wheelTraits.push(...fallbackSegments);
            }

            closeModal(false);
            _renderFightModal(wheelTraits, a, b, match, container);
          } else {
            throw new Error('Invalid segment array from AI response');
          }
        } catch (err) {
          if (isCancelled) return;
          console.error('Failed to generate AI clash segments, falling back to offline simulation:', err);
          showToast(`AI Notice: ${err.message}`, 'info', 5000);
          runFreeFallback();
        }
      });
    };

  const runFreeFallback = () => {
    openModal({
      title: `⚔️ Fight Simulation: ${escapeHtml(a.name)} VS ${escapeHtml(b.name)}`,
      closeOnOverlayClick: false,
      content: `
        <div style="display:flex; flex-direction:column; gap:16px; align-items:center; width:100%; color:#fff;">
          <div style="display:flex; justify-content:space-between; width:100%; text-align:center; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
            <div style="flex:1;">
              <div style="font-family:var(--font-display); font-size:16px; font-weight:900; color:#00f5ff;">${escapeHtml(a.name)}</div>
              <div style="font-size:11px; opacity:0.6; margin-top:2px;">Power Level: ${computeRawPower(a)} PL</div>
              <div style="font-size:24px; font-weight:bold; color:#00f5ff; margin-top:6px;" id="score-a-val">0</div>
            </div>
            <div style="display:flex; align-items:center; justify-content:center; padding:0 12px; font-size:18px; font-family:var(--font-display); color:rgba(255,255,255,0.2);">VS</div>
            <div style="flex:1;">
              <div style="font-family:var(--font-display); font-size:16px; font-weight:900; color:#bf00ff;">${escapeHtml(b.name)}</div>
              <div style="font-size:11px; opacity:0.6; margin-top:2px;">Power Level: ${computeRawPower(b)} PL</div>
              <div style="font-size:24px; font-weight:bold; color:#bf00ff; margin-top:6px;" id="score-b-val">0</div>
            </div>
          </div>

          <div id="fight-wheel-status" style="font-size:13px; color:rgba(255,255,255,0.7); text-align:center; padding:10px;">Constructing simulation parameters...</div>
          <div id="fight-wheel-container" style="display:none; justify-content:center; align-items:center; position:relative; min-height:330px; width:100%;"></div>

          <label style="font-size:11px; color:rgba(255,255,255,0.6); display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none; margin-bottom:4px;">
            <input type="checkbox" id="tournament-skip-animation-toggle" ${localStorage.getItem('skip_wheel_animation') === '1' ? 'checked' : ''} style="cursor:pointer;" />
            <span>⚡ Skip Spin Animation</span>
          </label>

          <div style="display:flex; gap:12px; width:100%; justify-content:center;">
            <button class="btn btn-primary" id="spin-fight-btn" disabled style="display:none; padding:10px 24px; font-weight:bold; font-size:15px;">⚔️ Spin Round 1</button>
            <button class="btn btn-ghost" id="declare-fight-btn" style="display:none; padding:10px 24px; width:100%;">Declare Winner</button>
          </div>

          <div style="width:100%; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; max-height:140px; overflow-y:auto; font-size:12px; line-height:1.5; text-align:left;" id="combat-log-box">
            <div style="color:rgba(255,255,255,0.4); text-align:center; font-style:italic;">Logs will appear as combat rounds resolve.</div>
          </div>
        </div>
      `
    });

    const wheelTraits = generateLocalClashSegments(a, b, 8, 0);
    _initializeFightWheel(wheelTraits, a, b, match, container);
  };

  await requireApiKey(runWithApiKey, runFreeFallback);
}

function _renderFightModal(wheelTraits, a, b, match, container) {
  openModal({
    title: `⚔️ Fight: ${escapeHtml(a.name)} VS ${escapeHtml(b.name)}`,
    content: `
      <div style="display:flex; flex-direction:column; gap:16px; align-items:center; width:100%; color:#fff;">
        <div style="display:flex; justify-content:space-between; width:100%; text-align:center; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="flex:1;">
            <div style="font-family:var(--font-display); font-size:16px; font-weight:900; color:#00f5ff;">${escapeHtml(a.name)}</div>
            <div style="font-size:11px; opacity:0.6; margin-top:2px;">Power Level: ${computeRawPower(a)} PL</div>
            <div style="font-size:24px; font-weight:bold; color:#00f5ff; margin-top:6px;" id="score-a-val">0</div>
          </div>
          <div style="display:flex; align-items:center; justify-content:center; padding:0 12px; font-size:18px; font-family:var(--font-display); color:rgba(255,255,255,0.2);">VS</div>
          <div style="flex:1;">
            <div style="font-family:var(--font-display); font-size:16px; font-weight:900; color:#bf00ff;">${escapeHtml(b.name)}</div>
            <div style="font-size:11px; opacity:0.6; margin-top:2px;">Power Level: ${computeRawPower(b)} PL</div>
            <div style="font-size:24px; font-weight:bold; color:#bf00ff; margin-top:6px;" id="score-b-val">0</div>
          </div>
        </div>

        <div id="fight-wheel-status" style="font-size:13px; color:rgba(255,255,255,0.7); text-align:center; padding:10px;">Get ready...</div>
        <div id="fight-wheel-container" style="display:none; justify-content:center; align-items:center; position:relative; min-height:330px; width:100%;"></div>

        <label style="font-size:11px; color:rgba(255,255,255,0.6); display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none; margin-bottom:4px;">
          <input type="checkbox" id="tournament-skip-animation-toggle" ${localStorage.getItem('skip_wheel_animation') === '1' ? 'checked' : ''} style="cursor:pointer;" />
          <span>⚡ Skip Spin Animation</span>
        </label>

        <div style="display:flex; gap:12px; width:100%; justify-content:center;">
          <button class="btn btn-primary" id="spin-fight-btn" disabled style="display:none; padding:10px 24px; font-weight:bold; font-size:15px;">⚔️ Spin Round 1</button>
          <button class="btn btn-ghost" id="declare-fight-btn" style="display:none; padding:10px 24px; width:100%;">Declare Winner</button>
        </div>

        <div style="width:100%; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; max-height:140px; overflow-y:auto; font-size:12px; line-height:1.5; text-align:left;" id="combat-log-box">
          <div style="color:rgba(255,255,255,0.4); text-align:center; font-style:italic;">Logs will appear as combat rounds resolve.</div>
        </div>
      </div>
    `
  });

  _initializeFightWheel(wheelTraits, a, b, match, container);
}

function _initializeFightWheel(wheelTraits, a, b, match, container) {
  const canvasContainer = document.querySelector('#fight-wheel-container');
  const spinBtn = document.querySelector('#spin-fight-btn');
  const logBox = document.querySelector('#combat-log-box');
  const scoreAEl = document.querySelector('#score-a-val');
  const scoreBEl = document.querySelector('#score-b-val');
  const declareBtn = document.querySelector('#declare-fight-btn');

  if (!canvasContainer || !spinBtn || !scoreAEl || !scoreBEl || !declareBtn || !logBox) return;

  // Clean up any existing fight wheel instance to prevent duplicate animation loops
  if (canvasContainer._spinWheelInstance) {
    try { canvasContainer._spinWheelInstance.destroy(); } catch (e) {}
    canvasContainer._spinWheelInstance = null;
  }

  let fightRound = 1;
  let scoreA = 0;
  let scoreB = 0;

  const normalizedTraits = wheelTraits.map(t => {
    return { ...t, points: Number(t.points) || 10 };
  });

  const currentWheelObj = {
    id: 'fight-matchup-wheel',
    name: 'Dynamic Clash',
    icon: '⚔️',
    traits: normalizedTraits
  };

  const spinWheel = new SpinWheel(canvasContainer, currentWheelObj, {
    tiers: store.getState().rarityTiers,
    size: 320,
    compressWeights: true
  });
  canvasContainer._spinWheelInstance = spinWheel;

  const skipToggle = document.querySelector('#tournament-skip-animation-toggle');
  if (skipToggle) {
    skipToggle.onchange = () => {
      localStorage.setItem('skip_wheel_animation', skipToggle.checked ? '1' : '0');
    };
  }

  // Ensure all traits start enabled
  currentWheelObj.traits.forEach(t => t.disabled = false);

  document.querySelector('#fight-wheel-status').style.display = 'none';
  canvasContainer.style.display = 'flex';
  spinBtn.style.display = 'block';
  spinBtn.disabled = false;

  spinBtn.onclick = async () => {
    spinBtn.disabled = true;

    try {
      // Auto-reset disabled traits if all have been spun
      if (currentWheelObj.traits.every(t => t.disabled)) {
        currentWheelObj.traits.forEach(t => t.disabled = false);
      }

      const skipAnimation = localStorage.getItem('skip_wheel_animation') === '1';
      const landResult = await spinWheel.spin(null, skipAnimation);
      if (!landResult || !landResult.trait) {
        showToast('Spin missed slice, try again.', 'info');
        spinBtn.disabled = false;
        return;
      }

      const winningTrait = landResult.trait;
      const pts = Number(winningTrait.points) || 0;

      if (winningTrait.winner === 'a') {
        scoreA += pts;
      } else if (winningTrait.winner === 'b') {
        scoreB += pts;
      }

      scoreAEl.textContent = scoreA;
      scoreBEl.textContent = scoreB;

      if (logBox.querySelector('.italic')) {
        logBox.innerHTML = '';
      }

      const logP = document.createElement('div');
      logP.style.marginBottom = '8px';
      const pointsText = (pts > 0 && winningTrait.winner !== 'draw') ? ` (+${pts} pts)` : '';
      logP.innerHTML = `<span style="color:var(--gold); font-weight:bold;">Round ${fightRound}:</span> ${escapeHtml(winningTrait.combatLog || winningTrait.label)} <span style="color:var(--cyan); font-weight:bold;">${pointsText}</span>`;
      logBox.appendChild(logP);
      logBox.scrollTop = logBox.scrollHeight;

      // Mark the selected segment as disabled
      const landedTrait = currentWheelObj.traits.find(t => t.id === winningTrait.id);
      if (landedTrait) {
        landedTrait.disabled = true;
      }

      // Check if it's a true fatal blow (only explicit mythic miracle slices or execution keywords)
      const isFatalBlow = winningTrait.winner !== 'draw' && (
        winningTrait.rarity === 'mythic' ||
        /fatal execution|instant kill|obliterate|absolute destruction/i.test(winningTrait.combatLog || winningTrait.label)
      );

      // Check if any round so far was legendary/mythic
      const hasBigOutcome = currentWheelObj.traits.some(t => t.disabled && (t.rarity === 'legendary' || t.rarity === 'mythic'));

      let shouldContinue = false;
      const totalTraits = currentWheelObj.traits.length;
      const disabledTraitsCount = currentWheelObj.traits.filter(t => t.disabled).length;
      const hasUnspunTraits = disabledTraitsCount < totalTraits;

      if (isFatalBlow) {
        shouldContinue = false;
      } else {
        if (fightRound < 3) {
          shouldContinue = true;
        } else if (!hasBigOutcome && hasUnspunTraits && fightRound < 8) {
          // Keep going up to 8 rounds if no decisive (legendary/mythic) blow landed yet
          shouldContinue = true;
        } else if (scoreA === scoreB && hasUnspunTraits) {
          shouldContinue = true;
        }
      }

      fightRound++;

      if (shouldContinue) {
        const isTiebreaker = scoreA === scoreB && fightRound > 3;
        const isExtended = !hasBigOutcome && fightRound > 3;
        spinBtn.textContent = isTiebreaker 
          ? `⚔️ Spin Sudden Death` 
          : (isExtended ? `⚔️ Spin Extended Round ${fightRound}` : `⚔️ Spin Round ${fightRound}`);
        spinWheel.currentAngle = 0;
        spinWheel._drawWheel(0);
        spinBtn.disabled = false;
      } else {
        spinBtn.style.display = 'none';
        declareBtn.style.display = 'block';

        let winner = null;
        let conclusionText = '';
        if (isFatalBlow) {
          winner = winningTrait.winner === 'a' ? a : b;
          const winnerColor = winningTrait.winner === 'a' ? '#00f5ff' : '#bf00ff';
          conclusionText = `🏆 DECISIVE BLOW: <span style="color:${winnerColor}; font-weight:bold;">${escapeHtml(winner.name)}</span> delivers a fatal hit and wins the battle!`;
        } else {
          winner = scoreA > scoreB ? a : b;
          if (scoreA === scoreB) {
            const rawA = computeRawPower(a);
            const rawB = computeRawPower(b);
            winner = rawA > rawB ? a : (rawA < rawB ? b : (Math.random() > 0.5 ? a : b));
          }
          const winnerColor = winner.id === a.id ? '#00f5ff' : '#bf00ff';
          conclusionText = `🏆 CONCLUSION: <span style="color:${winnerColor}; font-weight:bold;">${escapeHtml(winner.name)}</span> wins the battle (${Math.max(scoreA, scoreB)} vs ${Math.min(scoreA, scoreB)})!`;
        }

        const concludeP = document.createElement('div');
        concludeP.style.marginTop = '10px';
        concludeP.style.fontWeight = 'bold';
        concludeP.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        concludeP.style.paddingTop = '8px';
        concludeP.innerHTML = conclusionText;
        logBox.appendChild(concludeP);
        logBox.scrollTop = logBox.scrollHeight;

        declareBtn.onclick = () => {
          match.winner = winner;
          closeModal();
          _renderAndBind(container);
        };
      }
    } catch (err) {
      console.error(err);
      showToast('Clash spin failed.', 'error');
      spinBtn.disabled = false;
    }
  };
}

function buildRound(competitors) {
  const shuffled = [...competitors].sort(() => Math.random() - 0.5);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1] ?? null; // odd one out gets a bye
    matches.push({ a, b, winner: b === null ? a : null });
  }
  return matches;
}

function roundName(matchCount) {
  if (matchCount === 1) return '🏆 Final';
  if (matchCount === 2) return 'Semifinals';
  if (matchCount === 4) return 'Quarterfinals';
  return `Round of ${matchCount * 2}`;
}

// ─── Render ───────────────────────────────────────────────────
function _render(container, state) {
  if (tState.phase === 'select') {
    _renderSelect(container, state);
  } else {
    _renderBracket(container);
  }
}

function _renderSelect(container, state) {
  const { characters } = state;
  
  let filteredChars = characters;
  if (fighterSearchQuery.trim()) {
    const q = fighterSearchQuery.toLowerCase().trim();
    filteredChars = characters.filter(c => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchClass = (c.powerSystem?.classOrType || '').toLowerCase().includes(q);
      const matchTrait = c.traits.some(t => t.trait.label.toLowerCase().includes(q));
      return matchName || matchClass || matchTrait;
    });
  }

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">⚔️ Tournament</h1>
      <p class="page-subtitle">Pick your characters and let fate decide a champion.</p>

      ${characters.length < 2 ? `
        <div class="empty-state" style="margin-top:80px;">
          <span class="empty-state-icon">⚔️</span>
          <p>You need at least 2 saved characters to run a tournament.</p>
          <button class="btn btn-primary btn-lg" id="go-spin-btn">⚡ Go Generate Characters</button>
        </div>
      ` : `
        <div class="card" style="padding:20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:12px;">
            <p class="section-title" style="margin:0;">Select Fighters (${tState.selectedIds.size} selected)</p>
            <input type="text" id="fighter-search-input" class="input" placeholder="🔍 Filter fighters..." value="${escapeHtml(fighterSearchQuery)}" style="width:200px; font-size:11px; padding:4px 8px; border-radius:6px;">
          </div>
          
          <div class="wheel-checkbox-grid">
            ${filteredChars.map(char => {
              const power = computePower(char);
              const checked = tState.selectedIds.has(char.id);
              return `
                <label class="wheel-checkbox-item ${checked ? 'checked' : ''}" aria-label="${escapeHtml(char.name)}">
                  <input
                    type="checkbox"
                    ${checked ? 'checked' : ''}
                    data-char-toggle="${char.id}"
                    class="sr-only"
                    aria-label="Include ${escapeHtml(char.name)}"
                  />
                  <span class="wheel-checkbox-icon" aria-hidden="true">⚔️</span>
                  <span class="wheel-checkbox-name">${escapeHtml(char.name)}</span>
                  <div class="custom-checkbox" aria-hidden="true">${checked ? '✓' : ''}</div>
                  <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:4px;">Power ${power}</div>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <button
          class="btn btn-primary btn-lg"
          id="start-tournament-btn"
          ${tState.selectedIds.size < 2 ? 'disabled' : ''}
          aria-label="Start tournament"
        >
          ⚔️ Start Tournament (${tState.selectedIds.size})
        </button>
      `}
    </div>
  `;
}

function _renderBracket(container) {
  const round = tState.rounds[tState.currentRoundIndex] ?? [];
  const allResolved = round.every(m => m.winner);
  const isFinal = tState.champion !== null;

  container.innerHTML = `
    <div class="page">
      <h1 class="page-title">⚔️ Tournament</h1>

      ${isFinal ? `
        <div class="card" style="padding:40px; text-align:center; margin-top:20px;">
          <div style="font-size:64px; margin-bottom:16px; animation:float 2s ease-in-out infinite;">🏆</div>
          <div style="font-family:var(--font-display); font-size:22px; color:var(--gold); letter-spacing:2px; margin-bottom:8px;">
            CHAMPION
          </div>
          <div style="font-family:var(--font-display); font-size:32px; font-weight:900; margin-bottom:8px;">
            ${escapeHtml(tState.champion.name)}
          </div>
          <div style="color:rgba(255,255,255,0.5); font-size:13px; margin-bottom:24px;">
            Power ${computePower(tState.champion)}
          </div>
          <button class="btn btn-secondary" id="rematch-btn">🔄 New Tournament</button>
        </div>
      ` : `
        <p class="page-subtitle">${roundName(round.length)}</p>

        <div style="display:flex; flex-direction:column; gap:16px; margin-top:12px;">
          ${round.map((match, i) => _renderMatch(match, i)).join('')}
        </div>

        <div style="margin-top:24px; display:flex; gap:12px;">
          ${allResolved ? `
            <button class="btn btn-primary btn-lg" id="next-round-btn">Next Round ▶</button>
          ` : ''}
          <button class="btn btn-ghost" id="rematch-btn">🔄 Start Over</button>
        </div>
      `}
    </div>
  `;
}

function _renderMatch(match, index) {
  const { a, b, winner } = match;

  if (!b) {
    // Bye — auto-advance, still shown for clarity
    return `
      <div class="card" style="padding:16px 20px; display:flex; align-items:center; justify-content:space-between;">
        <span style="font-family:var(--font-display); font-size:15px;">${escapeHtml(a.name)}</span>
        <span class="rarity-badge rarity-mythic" style="font-size:10px;">BYE — ADVANCES</span>
      </div>
    `;
  }

  return `
    <div class="card" style="padding:16px 20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="flex:1; text-align:left; ${winner === a ? 'color:var(--gold);' : winner ? 'opacity:0.4;' : ''}">
          <div style="font-family:var(--font-display); font-size:15px; font-weight:700;">${escapeHtml(a.name)}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">Power ${computePower(a)}</div>
        </div>

        <div style="flex-shrink:0;">
          ${winner
            ? `<span style="font-size:20px;">${winner === a ? '⬅️' : '➡️'}</span>`
            : `<button class="btn btn-secondary btn-sm" data-fight="${index}" aria-label="Fight!">⚔️ FIGHT!</button>`
          }
        </div>

        <div style="flex:1; text-align:right; ${winner === b ? 'color:var(--gold);' : winner ? 'opacity:0.4;' : ''}">
          <div style="font-family:var(--font-display); font-size:15px; font-weight:700;">${escapeHtml(b.name)}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">Power ${computePower(b)}</div>
        </div>
      </div>
      ${winner ? `
        <div style="text-align:center; margin-top:10px; font-size:12px; color:var(--gold);">
          🏆 ${escapeHtml(winner.name)} wins!
        </div>
      ` : ''}
    </div>
  `;
}

function _renderAndBind(container) {
  _render(container, store.getState());
  _bindEvents(container);
}

// ─── Events ───────────────────────────────────────────────────
function _bindEvents(container) {
  const goSpinBtn = container.querySelector('#go-spin-btn');
  if (goSpinBtn) goSpinBtn.onclick = () => router.navigate('/spin');

  const fighterSearchInput = container.querySelector('#fighter-search-input');
  if (fighterSearchInput) {
    fighterSearchInput.oninput = () => {
      fighterSearchQuery = fighterSearchInput.value;
      const q = fighterSearchQuery.toLowerCase().trim();
      container.querySelectorAll('.wheel-checkbox-item').forEach(item => {
        const name = item.querySelector('.wheel-checkbox-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(q) ? 'flex' : 'none';
      });
    };
  }

  container.querySelectorAll('[data-char-toggle]').forEach(checkbox => {
    checkbox.onchange = () => {
      const id = checkbox.dataset.charToggle;
      if (checkbox.checked) tState.selectedIds.add(id);
      else tState.selectedIds.delete(id);
      _renderAndBind(container);
    };
  });

  const startBtn = container.querySelector('#start-tournament-btn');
  if (startBtn) {
    startBtn.onclick = () => {
      const characters = store.getState().characters.filter(c => tState.selectedIds.has(c.id));
      if (characters.length < 2) {
        showToast('Select at least 2 characters.', 'error');
        return;
      }
      tState.phase = 'bracket';
      tState.rounds = [buildRound(characters)];
      tState.currentRoundIndex = 0;
      tState.champion = characters.length === 1 ? characters[0] : null;
      _renderAndBind(container);
    };
  }

  container.querySelectorAll('[data-fight]').forEach(btn => {
    btn.onclick = () => {
      const index = Number(btn.dataset.fight);
      const round = tState.rounds[tState.currentRoundIndex];
      const match = round ? round[index] : null;
      if (match) {
        _startFight(match, index, container);
      }
    };
  });

  const nextRoundBtn = container.querySelector('#next-round-btn');
  if (nextRoundBtn) {
    nextRoundBtn.onclick = () => {
      const round = tState.rounds[tState.currentRoundIndex];
      if (!round) return;
      const winners = round.map(m => m.winner).filter(Boolean);

      if (winners.length === 1) {
        tState.champion = winners[0];
      } else if (winners.length > 1) {
        tState.rounds.push(buildRound(winners));
        tState.currentRoundIndex++;
      } else {
        showToast('No winners found to advance the round.', 'error');
        return;
      }
      _renderAndBind(container);
    };
  }

  const rematchBtn = container.querySelector('#rematch-btn');
  if (rematchBtn) {
    rematchBtn.onclick = () => {
      _resetTournament();
      _renderAndBind(container);
    };
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
