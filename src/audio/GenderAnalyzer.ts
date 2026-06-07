/** Accumulates voiced F0 values during a recording, then scores the voice on a
 *  continuous masculine↔androgynous↔feminine spectrum from the median pitch.
 *
 *  This is a perceptual ACOUSTIC heuristic (Tier 1: F0 median) — not a
 *  determination of gender identity. Formant (LPC) refinement is a future
 *  enhancement noted in the voice-gender-analysis skill. */

import type { GenderResult } from '../lib/types';
import type { FormantEstimate } from './FormantAnalyzer';

/** Hz center of the androgynous band; F0 tails saturate toward male/female. */
const ANDROGYNOUS_CENTER = 170;
/** Logistic spread (Hz) controlling how quickly the score saturates. */
const SCORE_SPREAD = 35;
/** |score| below this reads as androgynous. */
const ANDROGYNOUS_BAND = 0.33;
/** Minimum voiced frames before a result is meaningful. */
const MIN_VOICED_FRAMES = 12;

/** Weight of the F0 score vs. the formant score when both are available. */
const F0_WEIGHT = 0.6;
/** Formant centers/spreads (Hz) roughly midway between adult male/female means. */
const F1_CENTER = 600;
const F1_SPREAD = 120;
const F2_CENTER = 1650;
const F2_SPREAD = 350;

export class GenderAnalyzer {
  private readonly f0s: number[] = [];

  /** Feed each per-frame pitch reading (nulls are ignored). */
  collect(hz: number | null): void {
    if (hz !== null && hz >= 60 && hz <= 1000) this.f0s.push(hz);
  }

  reset(): void {
    this.f0s.length = 0;
  }

  /**
   * Score the accumulated recording; null if too few voiced frames.
   * @param formants optional F1/F2 estimate (Tier 2) blended into the score.
   */
  analyze(formants?: FormantEstimate | null): GenderResult | null {
    if (this.f0s.length < MIN_VOICED_FRAMES) return null;

    const sorted = [...this.f0s].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const iqr = percentile(sorted, 0.75) - percentile(sorted, 0.25);

    const f0Score = Math.tanh((median - ANDROGYNOUS_CENTER) / SCORE_SPREAD);

    // Blend in the formant score when available (higher F1/F2 ⇒ more feminine).
    let score = f0Score;
    let method: GenderResult['method'] = 'f0';
    let agreementConfidence = 1;
    if (formants) {
      const formantScore = scoreFormants(formants);
      score = F0_WEIGHT * f0Score + (1 - F0_WEIGHT) * formantScore;
      method = 'f0+formants';
      // The two cues agreeing is itself evidence; disagreement lowers confidence.
      agreementConfidence = 1 - Math.abs(f0Score - formantScore) / 2;
    }

    const label: GenderResult['label'] =
      score < -ANDROGYNOUS_BAND ? 'Male' : score > ANDROGYNOUS_BAND ? 'Female' : 'Androgynous';

    // Confidence: more voiced frames, tighter pitch spread, and cue agreement.
    const countConfidence = Math.min(1, this.f0s.length / 100);
    const spreadConfidence = Math.max(0, 1 - iqr / 120);
    const confidence = round2(
      0.4 * countConfidence + 0.3 * spreadConfidence + 0.3 * agreementConfidence,
    );

    return {
      score,
      label,
      confidence,
      medianF0: Math.round(median),
      method,
      ...(formants ? { formants } : {}),
    };
  }
}

/** Map F1/F2 to a -1..+1 score (higher formants ⇒ more feminine-typical). */
function scoreFormants({ f1, f2 }: FormantEstimate): number {
  const combined = 0.5 * ((f1 - F1_CENTER) / F1_SPREAD) + 0.5 * ((f2 - F2_CENTER) / F2_SPREAD);
  return Math.tanh(combined);
}

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(sortedAsc.length * p)));
  return sortedAsc[idx] ?? 0;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
