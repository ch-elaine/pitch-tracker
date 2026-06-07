/** View for the recorder panel: the record button, status line, timer, and live
 *  stat readouts. Pure view — it renders state and emits a toggle event; it holds
 *  no audio logic (that belongs to the controller, wired in main.ts later). */

import { byId, setVisible } from '../lib/dom';
import { formatElapsed } from '../lib/time';

export type RecorderState = 'idle' | 'recording';

export class RecorderView {
  private readonly btn = byId<HTMLButtonElement>('record-btn');
  private readonly label = byId('record-label');
  private readonly status = byId('rec-status');
  private readonly statusDot = byId('rec-status-dot');
  private readonly statTime = byId('stat-time');
  private readonly statPitch = byId('stat-pitch');
  private readonly statNote = byId('stat-note');
  private readonly statVolume = byId('stat-volume');
  private readonly volumeMeter = byId('volume-meter');

  constructor(private readonly onToggle: () => void) {
    this.btn.addEventListener('click', () => this.onToggle());
  }

  setState(state: RecorderState): void {
    const recording = state === 'recording';
    this.btn.classList.toggle('btn-primary', !recording);
    this.btn.classList.toggle('btn-error', recording);
    this.btn.classList.toggle('animate-pulse', recording);
    this.btn.setAttribute('aria-pressed', String(recording));
    this.btn.setAttribute('aria-label', recording ? 'Stop recording' : 'Start recording');
    this.label.textContent = recording ? 'Stop' : 'Record';
    this.status.textContent = recording ? 'Recording…' : 'Ready to record';
    setVisible(this.statusDot, recording);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  updateTime(elapsedMs: number): void {
    this.statTime.textContent = formatElapsed(elapsedMs);
  }

  updatePitch(hz: number | null, note: string | null): void {
    this.statPitch.textContent = hz === null ? '—' : `${Math.round(hz)}`;
    this.statNote.textContent = note ?? 'no note';
  }

  updateVolume(db: number | null, percent: number): void {
    this.statVolume.textContent = db === null ? '—' : `${Math.round(db)}`;
    this.volumeMeter.style.setProperty('--value', String(Math.round(percent)));
    this.volumeMeter.textContent = `${Math.round(percent)}%`;
  }

  /** Reset live readouts back to the idle placeholder values. */
  resetLive(): void {
    this.updateTime(0);
    this.updatePitch(null, null);
    this.updateVolume(null, 0);
  }
}
