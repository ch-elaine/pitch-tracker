/** Accumulates voiced F0 values during a recording, then scores the voice on a
 *  continuous masculine↔androgynous↔feminine spectrum from the median pitch.
 *
 *  This is a perceptual ACOUSTIC heuristic (Tier 1: F0 median) — not a
 *  determination of gender identity. Formant (LPC) refinement is a future
 *  enhancement noted in the voice-gender-analysis skill. */

import type { GenderResult } from '../lib/types';

/** Hz center of the androgynous band; F0 tails saturate toward male/female. */
const ANDROGYNOUS_CENTER = 170;
/** Logistic spread (Hz) controlling how quickly the score saturates. */
const SCORE_SPREAD = 35;
/** |score| below this reads as androgynous. */
const ANDROGYNOUS_BAND = 0.33;
/** Minimum voiced frames before a result is meaningful. */
const MIN_VOICED_FRAMES = 12;

export class GenderAnalyzer {
  private readonly f0s: number[] = [];

  /** Feed each per-frame pitch reading (nulls are ignored). */
  collect(hz: number | null): void {
    if (hz !== null && hz >= 60 && hz <= 1000) this.f0s.push(hz);
  }

  reset(): void {
    this.f0s.length = 0;
  }

  /** Score the accumulated recording; null if too few voiced frames. */
  analyze(): GenderResult | null {
    if (this.f0s.length < MIN_VOICED_FRAMES) return null;

    const sorted = [...this.f0s].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const iqr = percentile(sorted, 0.75) - percentile(sorted, 0.25);

    const score = Math.tanh((median - ANDROGYNOUS_CENTER) / SCORE_SPREAD);
    const label: GenderResult['label'] =
      score < -ANDROGYNOUS_BAND ? 'Male' : score > ANDROGYNOUS_BAND ? 'Female' : 'Androgynous';

    // Confidence: more voiced frames and a tighter pitch spread = more reliable.
    const countConfidence = Math.min(1, this.f0s.length / 100);
    const spreadConfidence = Math.max(0, 1 - iqr / 120);
    const confidence = round2(0.5 * countConfidence + 0.5 * spreadConfidence);

    return { score, label, confidence, medianF0: Math.round(median) };
  }
}

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(sortedAsc.length * p)));
  return sortedAsc[idx] ?? 0;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
