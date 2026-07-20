// ============================================================
// toast.js — Toast Notification System
// ============================================================

export function showToast(message, type = 'info', duration = 3000) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  root.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-in 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Modal System ────────────────────────────────────────────

let activeModal = null;

export function openModal({ title, content, onClose, closeOnOverlayClick = true }) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  closeModal(false); // close any existing modal programmatically without triggering onClose boomerang

  root.style.pointerEvents = 'auto';

  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop" aria-hidden="true"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
        <h2 id="modal-title" style="font-family:var(--font-display); font-size:18px; font-weight:700; color:#fff; letter-spacing:1px;">
          ${title}
        </h2>
        <button id="modal-close" class="btn btn-ghost btn-icon" aria-label="Close modal" style="font-size:20px;">✕</button>
      </div>
      <div id="modal-body">${content}</div>
    </div>
  `;

  activeModal = { root, onClose };

  if (closeOnOverlayClick) {
    root.querySelector('#modal-backdrop').addEventListener('click', () => closeModal(true));
  }
  root.querySelector('#modal-close').addEventListener('click', () => closeModal(true));

  // Trap focus
  const focusable = root.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length) focusable[0].focus();

  document.addEventListener('keydown', handleModalKeydown);

  return root.querySelector('#modal-body');
}

export function closeModal(triggerOnClose = true) {
  if (aiLoadingInterval) { clearInterval(aiLoadingInterval); aiLoadingInterval = null; }
  const root = document.getElementById('modal-root');
  if (root) {
    root.innerHTML = '';
    root.style.pointerEvents = 'none';
  }
  document.removeEventListener('keydown', handleModalKeydown);

  const currentModal = activeModal;
  activeModal = null; // Clear activeModal BEFORE running callback to break recursive loops

  if (triggerOnClose && currentModal?.onClose) {
    currentModal.onClose();
  }
}

let aiLoadingInterval = null;

export function showAiLoadingModal({ title = '⚡ AI Processing...', subtitle = 'Connecting to neural network...', onCancel } = {}) {
  if (aiLoadingInterval) clearInterval(aiLoadingInterval);

  const messages = [
    subtitle,
    'Synthesizing trait relationships...',
    'Consulting combat power matrices...',
    'Weaving thematic probabilities...',
    'Finalizing generation...'
  ];
  let msgIdx = 0;

  const content = `
    <div style="display:flex; flex-direction:column; gap:20px; align-items:center; text-align:center; padding:16px 8px;">
      <div style="position:relative; width:60px; height:60px; display:flex; align-items:center; justify-content:center;">
        <span class="spinner" style="width:50px; height:50px; border-width:4px; border-color:var(--gold) transparent var(--gold) transparent;"></span>
        <span style="position:absolute; font-size:20px;">⚡</span>
      </div>
      <div>
        <h3 style="font-size:16px; font-weight:700; color:#fff; margin:0 0 6px 0;">${title}</h3>
        <p id="ai-loading-msg" style="font-size:13px; color:rgba(255,255,255,0.7); margin:0; line-height:1.4;">${subtitle}</p>
      </div>
      <button class="btn btn-ghost btn-sm" id="ai-loading-cancel-btn" style="color:var(--rose); border:1px solid rgba(244,63,94,0.3); font-size:12px; margin-top:8px;">
        ⚡ Cancel & Use Offline Fallback
      </button>
    </div>
  `;

  openModal({
    title: '⚡ AI Engine Active',
    content,
    closeOnOverlayClick: false,
    onClose: () => {
      if (aiLoadingInterval) { clearInterval(aiLoadingInterval); aiLoadingInterval = null; }
      if (onCancel) onCancel();
    }
  });

  aiLoadingInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % messages.length;
    const msgEl = document.querySelector('#ai-loading-msg');
    if (msgEl) msgEl.textContent = messages[msgIdx];
  }, 2200);

  document.querySelector('#ai-loading-cancel-btn')?.addEventListener('click', () => {
    if (aiLoadingInterval) { clearInterval(aiLoadingInterval); aiLoadingInterval = null; }
    closeModal(true);
  });
}

function handleModalKeydown(e) {
  if (e.key === 'Escape') closeModal();
}
