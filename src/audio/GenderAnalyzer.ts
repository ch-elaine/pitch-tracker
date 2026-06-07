/** Accumulates voiced F0 values during a recording, then scores the voice on a
 *  continuous masculine↔androgynous↔feminine spectrum, optionally blending in a
 *  formant (Tier 2) estimate. The scoring model lives in genderModel.ts so the
 *  transparency graphs render the exact same math.
 *
 *  This is a perceptual ACOUSTIC heuristic — not a determination of gender
 *  identity (see the voice-gender-analysis skill). */

import type { GenderResult } from '../lib/types';
import type { FormantEstimate } from './FormantAnalyzer';
import { GENDER_MODEL, f0ToScore, formantsToScore, scoreToLabel } from './genderModel';

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

  /**
   * Score the accumulated recording; null if too few voiced frames.
   * @param formants optional F1/F2 estimate (Tier 2) blended into the score.
   */
  analyze(formants?: FormantEstimate | null): GenderResult | null {
    if (this.f0s.length < MIN_VOICED_FRAMES) return null;

    const sorted = [...this.f0s].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const iqr = percentile(sorted, 0.75) - percentile(sorted, 0.25);

    const f0Score = f0ToScore(median);

    // Blend in the formant score when available (higher F1/F2 ⇒ more feminine).
    let score = f0Score;
    let formantScore: number | undefined;
    let method: GenderResult['method'] = 'f0';
    let agreementConfidence = 1;
    if (formants) {
      formantScore = formantsToScore(formants.f1, formants.f2);
      score = GENDER_MODEL.f0Weight * f0Score + (1 - GENDER_MODEL.f0Weight) * formantScore;
      method = 'f0+formants';
      // The two cues agreeing is itself evidence; disagreement lowers confidence.
      agreementConfidence = 1 - Math.abs(f0Score - formantScore) / 2;
    }

    // Confidence: more voiced frames, tighter pitch spread, and cue agreement.
    const countConfidence = Math.min(1, this.f0s.length / 100);
    const spreadConfidence = Math.max(0, 1 - iqr / 120);
    const confidence = round2(
      0.4 * countConfidence + 0.3 * spreadConfidence + 0.3 * agreementConfidence,
    );

    return {
      score,
      label: scoreToLabel(score),
      confidence,
      medianF0: Math.round(median),
      method,
      ...(formants ? { formants } : {}),
      breakdown: {
        f0Samples: [...this.f0s],
        f0Score,
        ...(formantScore !== undefined ? { formantScore } : {}),
      },
    };
  }
}

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(sortedAsc.length * p)));
  return sortedAsc[idx] ?? 0;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
