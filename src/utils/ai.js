// ============================================================
// ai.js — Centralized client-side AI Integration & Helpers
// ============================================================

import { openModal, closeModal, showToast } from '../components/toast.js';

/**
 * Checks if an API key exists locally or on the server.
 * Prompts the user if neither exists.
 */
export async function requireApiKey(onSuccess, onFreeFallback = null) {
  const currentKey = localStorage.getItem('openai_api_key') ?? '';
  if (currentKey) {
    onSuccess(currentKey);
    return;
  }

  // Check if the server has a key configured (optional environment fallback)
  try {
    const configRes = await fetch('/api/ai/config');
    if (configRes.ok) {
      const config = await configRes.json();
      if (config.hasServerKey) {
        onSuccess('');
        return;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch AI server config:', err);
  }

  // Prompt the user for a key if none exists
  openModal({
    title: '⚡ Connect AI Key (Groq / OpenRouter / OpenAI)',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size:12px; color:rgba(255,255,255,0.7); margin:0; line-height:1.4;">
          For fast, 100% free AI generation with high rate-limits, we recommend using a <strong>Groq API key</strong>.
        </p>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; color:var(--gold); font-weight:bold;">API Key</label>
            <a href="https://console.groq.com" target="_blank" rel="noopener" style="font-size:11px; color:var(--cyan); text-decoration:underline;">Get Free Groq Key (console.groq.com) ↗</a>
          </div>
          <input class="input" id="modal-api-key-input" type="password" placeholder="gsk_..." style="width:100%;" autofocus />
          <span style="font-size:10px; color:rgba(255,255,255,0.3); display:block; margin-top:6px;">Your API key is saved locally in your browser only.</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <button class="btn btn-primary" id="modal-save-key-btn" style="width:100%;">💾 Save & Continue</button>
          ${onFreeFallback ? `<button class="btn btn-ghost" id="modal-free-fallback-btn" style="width:100%; border: 1px dashed rgba(255,255,255,0.15);">🎮 Use Free Offline Simulation</button>` : ''}
          <button class="btn btn-ghost" id="modal-cancel-key-btn" style="width:100%;">Cancel</button>
        </div>
      </div>
    `
  });

  const saveBtn = document.querySelector('#modal-save-key-btn');
  const inputEl = document.querySelector('#modal-api-key-input');

  saveBtn?.addEventListener('click', () => {
    const val = inputEl?.value.trim() ?? '';
    if (!val) { inputEl?.focus(); return; }
    localStorage.setItem('openai_api_key', val);
    
    // Automatically set default provider to Groq if key starts with gsk_
    if (val.startsWith('gsk_')) {
      localStorage.setItem('openai_api_url', 'https://api.groq.com/openai/v1');
      localStorage.setItem('openai_model', 'llama-3.1-8b-instant');
    }
    
    showToast('API Key saved!', 'success');
    closeModal();
    onSuccess(val);
  });

  if (onFreeFallback) {
    document.querySelector('#modal-free-fallback-btn')?.addEventListener('click', () => {
      closeModal();
      onFreeFallback();
    });
  }

  document.querySelector('#modal-cancel-key-btn')?.addEventListener('click', closeModal);
}

/**
 * Standardizes API base URL to a chat completion endpoint URL.
 */
export function getChatCompletionsUrl(baseUrl) {
  let url = (baseUrl || '').trim();
  if (!url) return 'https://openrouter.ai/api/v1/chat/completions';
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (url.endsWith('/chat/completions')) {
    return url;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return `${url}/chat/completions`;
}

/**
 * Strips formatting wrappers and parses a JSON string.
 * Supports auto-recovery of truncated JSON and trailing comma cleanups.
 */
export function cleanAndParseJson(str) {
  let cleaned = (str || '').trim();
  
  // Find first brace
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    throw new Error("No JSON object found in response.");
  }
  
  let lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else {
    cleaned = cleaned.slice(firstBrace);
  }

  // Remove common markdown wrapper elements if they survived
  cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '');

  // Strip trailing commas before closing braces/brackets (invalid in standard JSON)
  cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // If standard parsing fails, try to repair truncated JSON by appending closing characters
    try {
      let temp = cleaned;
      // Count open/close braces and brackets
      let openBraces = (temp.match(/{/g) || []).length;
      let closeBraces = (temp.match(/}/g) || []).length;
      let openBrackets = (temp.match(/\[/g) || []).length;
      let closeBrackets = (temp.match(/\]/g) || []).length;
      
      // If we have unclosed brackets inside, close them first
      while (openBrackets > closeBrackets) {
        temp += ']';
        closeBrackets++;
      }
      // Then close unclosed braces
      while (openBraces > closeBraces) {
        temp += '}';
        closeBraces++;
      }
      
      // Try parsing the repaired string
      return JSON.parse(temp);
    } catch (err) {
      // Re-throw original error with context if repair fails
      throw new Error(`Invalid JSON output: ${e.message}. Context: ${cleaned.substring(cleaned.length - 80)}`);
    }
  }
}

/**
 * Dispatches an AI chat completion request through the local server proxy.
 */
export async function callAiChat(apiUrl, apiKey, requestBody) {
  const proxyUrl = '/api/ai/chat';
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: getChatCompletionsUrl(apiUrl),
      apiKey,
      requestBody
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    let msg = 'AI request failed';
    if (typeof data.error === 'string') msg = data.error;
    else if (data.error?.message) msg = data.error.message;
    else if (data.message) msg = data.message;
    else msg = `API returned status ${response.status}`;
    throw new Error(msg);
  }

  return data.choices?.[0]?.message?.content || '{}';
}
