/** Renders dismissible DaisyUI alerts into the page's aria-live region.
 *  View-only: takes a message + kind, owns no business logic. */

import { byId } from '../lib/dom';

type AlertKind = 'info' | 'success' | 'warning' | 'error';

const KIND_CLASS: Record<AlertKind, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

/** Show an alert; returns a dismiss function. Auto-dismisses non-errors. */
export function showAlert(message: string, kind: AlertKind = 'info'): () => void {
  const region = byId('alert-region');

  const alert = document.createElement('div');
  alert.className = `alert ${KIND_CLASS[kind]} shadow-sm`;
  alert.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  const text = document.createElement('span');
  text.textContent = message;
  alert.appendChild(text);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-ghost btn-xs btn-circle ml-auto';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '✕';
  alert.appendChild(closeBtn);

  const dismiss = (): void => alert.remove();
  closeBtn.addEventListener('click', dismiss);
  region.appendChild(alert);

  if (kind !== 'error') window.setTimeout(dismiss, 4000);
  return dismiss;
}
