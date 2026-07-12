// ============================================================
// main.js — Application Entry Point & Router
// ============================================================

import { router } from './utils/router.js';
import { renderNavbar } from './components/navbar.js';
import { renderHomePage } from './pages/homePage.js';
import { renderBuilderPage, unmountBuilderPage } from './pages/builderPage.js';
import { renderSpinPage, unmountSpinPage } from './pages/spinPage.js';
import { renderCharactersPage, unmountCharactersPage } from './pages/charactersPage.js';

const pageRoot = document.getElementById('page-root');
let currentPath = null;

// ─── Route Definitions ────────────────────────────────────────
const routes = {
  '/':           { render: renderHomePage,        unmount: null },
  '/builder':    { render: renderBuilderPage,     unmount: unmountBuilderPage },
  '/spin':       { render: renderSpinPage,        unmount: unmountSpinPage },
  '/characters': { render: renderCharactersPage,  unmount: unmountCharactersPage },
};

// ─── Router Subscription ──────────────────────────────────────
router.subscribe((path) => {
  // Unmount previous page
  if (currentPath && routes[currentPath]?.unmount) {
    routes[currentPath].unmount();
  }

  currentPath = path;

  // Resolve route (fallback to home)
  const route = routes[path] ?? routes['/'];

  // Update navbar active state
  renderNavbar(path);

  // Scroll to top
  window.scrollTo(0, 0);

  // Render new page
  if (route?.render) {
    route.render(pageRoot);
  } else {
    pageRoot.innerHTML = `
      <div class="page" style="text-align:center; padding:80px 20px;">
        <div style="font-size:64px; margin-bottom:16px;">🌀</div>
        <h2 style="font-family:var(--font-display); color:var(--cyan); margin-bottom:8px;">404 — Not Found</h2>
        <p style="color:rgba(255,255,255,0.4); margin-bottom:24px;">This page doesn't exist in any timeline.</p>
        <button class="btn btn-primary" onclick="router.navigate('/')">Go Home</button>
      </div>
    `;
  }
});

// ─── Initialize ───────────────────────────────────────────────
router.init();

// ─── Keyboard Shortcut: B = Builder, S = Spin, H = Home ──────
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'b' || e.key === 'B') router.navigate('/builder');
  if (e.key === 's' || e.key === 'S') router.navigate('/spin');
  if (e.key === 'h' || e.key === 'H') router.navigate('/');
  if (e.key === 'c' || e.key === 'C') router.navigate('/characters');
});

// ─── OpenAI Key Shortcut ──────────────────────────────────────
// Press ? to open API key setup
document.addEventListener('keydown', (e) => {
  if (e.key === '?' && !e.target.matches('input, textarea, select')) {
    const current = localStorage.getItem('openai_api_key') ?? '';
    const key = prompt(
      'Enter your OpenAI API key for AI backstory generation:\n(Leave blank to use local backstory generator)',
      current
    );
    if (key !== null) {
      if (key.trim()) {
        localStorage.setItem('openai_api_key', key.trim());
        alert('✅ OpenAI key saved! AI backstory generation is now active.');
      } else {
        localStorage.removeItem('openai_api_key');
        alert('🗑 OpenAI key removed. Using local backstory generator.');
      }
    }
  }
});

console.log('%c🎡 Wheel of Fate', 'font-size:20px; font-weight:bold; color:#00f5ff;');
console.log('%cKeyboard shortcuts: H=Home, B=Builder, S=Spin, C=Characters, ?=Set API Key', 'color:#8a9ba8;');
