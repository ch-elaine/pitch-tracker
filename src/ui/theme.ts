/** Theme controller: persists the user's light/dark choice and syncs the
 *  DaisyUI `data-theme` attribute with the navbar toggle. */

import { byId } from '../lib/dom';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'pitch-tracker:theme';

function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  // Let theme-aware canvas graphs re-read their colors.
  window.dispatchEvent(new Event('themechange'));
}

export function initThemeToggle(): void {
  const toggle = byId<HTMLInputElement>('theme-toggle');
  const initial = resolveInitialTheme();

  applyTheme(initial);
  toggle.checked = initial === 'dark';

  toggle.addEventListener('change', () => {
    const theme: Theme = toggle.checked ? 'dark' : 'light';
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  });
}
