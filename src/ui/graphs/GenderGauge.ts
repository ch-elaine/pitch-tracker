/** Renders the post-recording voice-character result: positions the marker on
 *  the masculine↔feminine spectrum and fills the stat readouts. View-only. */

import { byId, setVisible } from '../../lib/dom';
import type { GenderResult } from '../../lib/types';

export class GenderGauge {
  private readonly card = byId('gender-card');
  private readonly marker = byId('gender-marker');
  private readonly label = byId('gender-label');
  private readonly f0 = byId('gender-f0');
  private readonly confidence = byId('gender-confidence');
  private readonly formants = byId('gender-formants');

  show(result: GenderResult): void {
    // score -1..+1 -> 0..100% left position
    const left = ((result.score + 1) / 2) * 100;
    this.marker.style.left = `${Math.max(0, Math.min(100, left))}%`;
    this.label.textContent = result.label;
    this.f0.textContent = String(result.medianF0);
    this.confidence.textContent = `${Math.round(result.confidence * 100)}%`;
    this.formants.textContent = result.formants
      ? `Formants F1/F2: ${result.formants.f1} / ${result.formants.f2} Hz · pitch + formant analysis`
      : 'Pitch-only analysis (formants unavailable for this clip)';
    setVisible(this.card, true);
  }

  showInsufficient(): void {
    this.marker.style.left = '50%';
    this.label.textContent = 'Not enough voice';
    this.f0.textContent = '—';
    this.confidence.textContent = '—';
    this.formants.textContent = '';
    setVisible(this.card, true);
  }

  hide(): void {
    setVisible(this.card, false);
  }
}
