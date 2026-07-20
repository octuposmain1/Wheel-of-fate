// ============================================================
// navbar.js — Navigation Component
// ============================================================

import { router } from '../utils/router.js';
import { openModal, closeModal, showToast } from './toast.js';

export function renderNavbar(currentPath) {
  const nav = document.getElementById('navbar');

  const navItems = [
    { path: '/',          label: 'Home',       icon: '🏠' },
    { path: '/builder',   label: 'Wheel Builder', icon: '🎡' },
    { path: '/spin',      label: 'Spin',        icon: '⚡' },
    { path: '/characters',label: 'Characters',  icon: '📜' },
    { path: '/tournament',label: 'Tournament',  icon: '⚔️' },
  ];

  nav.innerHTML = `
    <nav class="navbar" role="navigation" aria-label="Main navigation">
      <div class="navbar-brand" id="nav-brand" role="link" tabindex="0" aria-label="Wheel of Fate Home">
        <span class="navbar-logo" aria-hidden="true">🎡</span>
        <span class="navbar-title">WHEEL OF FATE</span>
      </div>
      <div class="navbar-nav" role="menubar">
        ${navItems.slice(1, 3).map(item => `
          <button
            class="nav-btn ${currentPath === item.path ? 'active' : ''} ${item.path === '/spin' ? 'nav-btn-spin' : ''}"
            data-path="${item.path}"
            role="menuitem"
            aria-current="${currentPath === item.path ? 'page' : 'false'}"
          >
            <span aria-hidden="true">${item.icon}</span>
            ${item.label}
          </button>
        `).join('')}
        <button
          class="nav-btn ${currentPath === '/characters' ? 'active' : ''}"
          data-path="/characters"
          role="menuitem"
        >
          <span aria-hidden="true">📜</span>
          <span class="nav-label">Characters</span>
        </button>
        <button
          class="nav-btn ${currentPath === '/builder' ? 'active' : ''}"
          data-path="/builder"
          role="menuitem"
        >
          <span aria-hidden="true">🎡</span>
          <span class="nav-label">Builder</span>
        </button>
        <button
          class="nav-btn ${currentPath === '/tournament' ? 'active' : ''}"
          data-path="/tournament"
          role="menuitem"
        >
          <span aria-hidden="true">⚔️</span>
          <span class="nav-label">Tournament</span>
        </button>
        <button
          class="nav-btn"
          id="nav-ai-settings-btn"
          role="menuitem"
          title="OpenAI API Configuration"
          style="margin-left:12px; border: 1px dashed rgba(0, 245, 255, 0.4); border-radius: 6px; color: var(--cyan); background: rgba(0, 245, 255, 0.04);"
        >
          <span aria-hidden="true">🤖</span>
          <span class="nav-label">AI Settings</span>
        </button>
      </div>
    </nav>
  `;

  // ─── Event Listeners ────────────────────────────────────
  nav.querySelector('#nav-brand').addEventListener('click', () => router.navigate('/'));
  nav.querySelector('#nav-brand').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') router.navigate('/');
  });

  nav.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.path));
  });

  nav.querySelector('#nav-ai-settings-btn')?.addEventListener('click', () => {
    _showAiSettingsModal();
  });
}

function _showAiSettingsModal() {
  const currentKey = localStorage.getItem('openai_api_key') ?? '';
  const currentUrl = localStorage.getItem('openai_api_url') ?? 'https://api.groq.com/openai/v1';
  const currentModel = localStorage.getItem('openai_model') ?? 'llama-3.3-70b-versatile';

  openModal({
    title: '🤖 AI Configuration Settings',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size:12px; color:rgba(255,255,255,0.6); margin:0; line-height:1.4;">
          Configure your AI API connection below. We recommend <strong>Groq</strong> for ultra-fast, 100% free AI generation with high rate-limits.
        </p>
        
        <div>
          <label style="font-size:12px; color:var(--gold); display:block; margin-bottom:6px; font-weight:bold;">⚡ Quick Provider Presets</label>
          <select class="input" id="provider-preset-select" style="width:100%; font-size:12px;">
            <option value="groq" selected>⚡ Groq (Free & Ultra-Fast - Recommended)</option>
            <option value="openrouter">🌐 OpenRouter Free</option>
            <option value="openai">🔮 OpenAI Official (Paid)</option>
            <option value="ollama">💻 Local Ollama (Offline)</option>
          </select>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; color:rgba(255,255,255,0.5);">API Key</label>
            <a href="https://console.groq.com" target="_blank" rel="noopener" id="get-key-link" style="font-size:11px; color:var(--cyan); text-decoration:underline;">Get Free Groq Key ↗</a>
          </div>
          <input class="input" id="settings-api-key-input" type="password" placeholder="gsk_..." value="${currentKey}" style="width:100%;" autofocus />
          <span style="font-size:10px; color:rgba(255,255,255,0.3); display:block; margin-top:6px;">Your API key is saved locally in your browser only.</span>
        </div>

        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:6px;">API Base URL (Endpoint)</label>
          <input class="input" id="settings-api-url-input" type="text" placeholder="https://api.groq.com/openai/v1" value="${currentUrl}" style="width:100%;" />
        </div>

        <div>
          <label style="font-size:12px; color:rgba(255,255,255,0.5); display:block; margin-bottom:6px;">Model Name</label>
          <input class="input" id="settings-api-model-input" type="text" placeholder="llama-3.3-70b-versatile" value="${currentModel}" style="width:100%;" />
        </div>

        <div style="display:flex; gap:12px; margin-top:8px;">
          <button class="btn btn-primary" id="save-settings-btn" style="flex:1;">💾 Save Settings</button>
          <button class="btn btn-ghost" id="cancel-settings-btn">Cancel</button>
        </div>
      </div>
    `
  });

  const presetSelect = document.querySelector('#provider-preset-select');
  const urlInput = document.querySelector('#settings-api-url-input');
  const modelInput = document.querySelector('#settings-api-model-input');
  const keyLink = document.querySelector('#get-key-link');
  const keyInput = document.querySelector('#settings-api-key-input');

  presetSelect?.addEventListener('change', () => {
    const val = presetSelect.value;
    if (val === 'groq') {
      if (urlInput) urlInput.value = 'https://api.groq.com/openai/v1';
      if (modelInput) modelInput.value = 'llama-3.3-70b-versatile';
      if (keyInput) keyInput.placeholder = 'gsk_...';
      if (keyLink) {
        keyLink.href = 'https://console.groq.com';
        keyLink.textContent = 'Get Free Groq Key ↗';
      }
    } else if (val === 'openrouter') {
      if (urlInput) urlInput.value = 'https://openrouter.ai/api/v1';
      if (modelInput) modelInput.value = 'openrouter/free';
      if (keyInput) keyInput.placeholder = 'sk-or-v1-...';
      if (keyLink) {
        keyLink.href = 'https://openrouter.ai/keys';
        keyLink.textContent = 'Get OpenRouter Key ↗';
      }
    } else if (val === 'openai') {
      if (urlInput) urlInput.value = 'https://api.openai.com/v1';
      if (modelInput) modelInput.value = 'gpt-4o-mini';
      if (keyInput) keyInput.placeholder = 'sk-proj-...';
      if (keyLink) {
        keyLink.href = 'https://platform.openai.com/api-keys';
        keyLink.textContent = 'Get OpenAI Key ↗';
      }
    } else if (val === 'ollama') {
      if (urlInput) urlInput.value = 'http://localhost:11434/v1';
      if (modelInput) modelInput.value = 'llama3';
      if (keyInput) keyInput.placeholder = 'not-needed';
      if (keyLink) {
        keyLink.href = 'https://ollama.com';
        keyLink.textContent = 'Download Ollama ↗';
      }
    }
  });

  document.querySelector('#save-settings-btn')?.addEventListener('click', () => {
    const key = document.querySelector('#settings-api-key-input')?.value.trim() ?? '';
    const url = document.querySelector('#settings-api-url-input')?.value.trim() ?? '';
    const model = document.querySelector('#settings-api-model-input')?.value.trim() ?? '';

    if (key) {
      localStorage.setItem('openai_api_key', key);
    } else {
      localStorage.removeItem('openai_api_key');
    }

    localStorage.setItem('openai_api_url', url || 'https://api.groq.com/openai/v1');
    localStorage.setItem('openai_model', model || 'llama-3.3-70b-versatile');

    showToast('AI Settings saved successfully!', 'success');
    closeModal();
  });

  document.querySelector('#cancel-settings-btn')?.addEventListener('click', closeModal);
}
