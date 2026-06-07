/** Renders the stored recordings as DaisyUI cards with inline playback, MP3
 *  download, and delete. View-only: it calls injected handlers and reflects
 *  loading state; it owns no storage or encoding logic. */

import { byId, setVisible } from '../lib/dom';
import { formatElapsed } from '../lib/time';
import type { StoredRecording } from '../lib/types';

export interface RecordingHandlers {
  /** Encode + download as MP3; the view shows a spinner until it resolves. */
  onDownload(id: string): Promise<void>;
  onDelete(id: string): Promise<void>;
}

export class RecordingsList {
  private readonly listEl = byId<HTMLUListElement>('recordings-list');
  private readonly emptyEl = byId('recordings-empty');
  private readonly countEl = byId('recordings-count');
  private objectUrls: string[] = [];

  constructor(private readonly handlers: RecordingHandlers) {}

  render(recordings: StoredRecording[]): void {
    this.revokeUrls();
    this.listEl.replaceChildren();

    this.countEl.textContent = String(recordings.length);
    const hasAny = recordings.length > 0;
    setVisible(this.emptyEl, !hasAny);
    setVisible(this.listEl, hasAny);

    for (const rec of recordings) {
      this.listEl.appendChild(this.renderCard(rec));
    }
  }

  private renderCard(rec: StoredRecording): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'card card-compact bg-base-200';
    li.dataset['id'] = rec.id;

    const body = document.createElement('div');
    body.className = 'card-body gap-2';
    li.appendChild(body);

    // Header row: name + duration + optional voice badge.
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-2';
    const title = document.createElement('span');
    title.className = 'font-medium text-sm truncate';
    title.textContent = rec.name;
    title.title = rec.name;
    header.appendChild(title);

    const meta = document.createElement('span');
    meta.className = 'text-xs opacity-60 whitespace-nowrap';
    meta.textContent = formatElapsed(rec.durationMs);
    header.appendChild(meta);
    body.appendChild(header);

    if (rec.gender) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-sm badge-outline self-start';
      badge.textContent = `${rec.gender.label} · ${rec.gender.medianF0} Hz`;
      body.appendChild(badge);
    }

    // Playback.
    const url = URL.createObjectURL(rec.blob);
    this.objectUrls.push(url);
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = url;
    audio.className = 'w-full h-9';
    body.appendChild(audio);

    // Actions.
    const actions = document.createElement('div');
    actions.className = 'join self-end';

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn btn-sm btn-primary join-item';
    downloadBtn.textContent = 'MP3';
    downloadBtn.setAttribute('aria-label', `Download ${rec.name} as MP3`);
    downloadBtn.addEventListener('click', () => {
      void this.withLoading(downloadBtn, () => this.handlers.onDownload(rec.id));
    });
    actions.appendChild(downloadBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-sm btn-ghost join-item';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${rec.name}`);
    deleteBtn.addEventListener('click', () => {
      void this.handlers.onDelete(rec.id);
    });
    actions.appendChild(deleteBtn);

    body.appendChild(actions);
    return li;
  }

  private async withLoading(btn: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
    const original = btn.textContent;
    btn.disabled = true;
    btn.classList.add('loading', 'loading-spinner');
    btn.textContent = '';
    try {
      await action();
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading', 'loading-spinner');
      btn.textContent = original;
    }
  }

  private revokeUrls(): void {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
  }
}
