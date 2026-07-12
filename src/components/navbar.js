// ============================================================
// navbar.js — Navigation Component
// ============================================================

import { router } from '../utils/router.js';

export function renderNavbar(currentPath) {
  const nav = document.getElementById('navbar');

  const navItems = [
    { path: '/',          label: 'Home',       icon: '🏠' },
    { path: '/builder',   label: 'Wheel Builder', icon: '🎡' },
    { path: '/spin',      label: 'Spin',        icon: '⚡' },
    { path: '/characters',label: 'Characters',  icon: '📜' },
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
}
