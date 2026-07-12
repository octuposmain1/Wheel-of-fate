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

export function openModal({ title, content, onClose }) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  closeModal(); // close any existing modal

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

  root.querySelector('#modal-backdrop').addEventListener('click', closeModal);
  root.querySelector('#modal-close').addEventListener('click', closeModal);

  // Trap focus
  const focusable = root.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length) focusable[0].focus();

  document.addEventListener('keydown', handleModalKeydown);

  return root.querySelector('#modal-body');
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) {
    root.innerHTML = '';
    root.style.pointerEvents = 'none';
  }
  document.removeEventListener('keydown', handleModalKeydown);
  if (activeModal?.onClose) activeModal.onClose();
  activeModal = null;
}

function handleModalKeydown(e) {
  if (e.key === 'Escape') closeModal();
}
