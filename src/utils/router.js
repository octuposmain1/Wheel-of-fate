// ============================================================
// router.js — Minimal Hash-Based SPA Router
// ============================================================

const routes = {};
let currentRoute = null;
const listeners = new Set();

export const router = {
  register(path, handler) {
    routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = path;
  },

  getCurrentPath() {
    return window.location.hash.slice(1) || '/';
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  init() {
    const dispatch = () => {
      const path = this.getCurrentPath();
      currentRoute = path;
      listeners.forEach(fn => fn(path));
    };
    window.addEventListener('hashchange', dispatch);
    dispatch();
  },
};
