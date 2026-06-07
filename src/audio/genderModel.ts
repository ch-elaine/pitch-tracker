/** Single source of truth for the voice-character model: the constants and the
 *  scoring functions. Both GenderAnalyzer (compute) and the transparency graphs
 *  (display) import from here, so the visuals can never drift from the math. */

export const GENDER_MODEL = {
  /** Hz center of the androgynous band; F0 tails saturate toward male/female. */
  androgynousCenter: 170,
  /** Logistic spread (Hz) controlling how quickly the F0 score saturates. */
  scoreSpread: 35,
  /** |score| below this reads as androgynous. */
  androgynousBand: 0.33,
  /** Weight of the F0 score vs. the formant score when both are available. */
  f0Weight: 0.6,
  /** Formant centers/spreads (Hz), roughly midway between adult male/female means. */
  f1Center: 600,
  f1Spread: 120,
  f2Center: 1650,
  f2Spread: 350,
} as const;

export type GenderLabel = 'Male' | 'Androgynous' | 'Female';

/** F0 (Hz) → -1..+1 score (lower = masculine-typical, higher = feminine-typical). */
export function f0ToScore(hz: number): number {
  return Math.tanh((hz - GENDER_MODEL.androgynousCenter) / GENDER_MODEL.scoreSpread);
}

/** F1/F2 (Hz) → -1..+1 score (higher formants = more feminine-typical). */
export function formantsToScore(f1: number, f2: number): number {
  const combined =
    0.5 * ((f1 - GENDER_MODEL.f1Center) / GENDER_MODEL.f1Spread) +
    0.5 * ((f2 - GENDER_MODEL.f2Center) / GENDER_MODEL.f2Spread);
  return Math.tanh(combined);
}

export function scoreToLabel(score: number): GenderLabel {
  if (score < -GENDER_MODEL.androgynousBand) return 'Male';
  if (score > GENDER_MODEL.androgynousBand) return 'Female';
  return 'Androgynous';
}

/** The F0 (Hz) values where the score crosses the androgynous-band thresholds —
 *  used to color the pitch histogram into male / androgynous / female regions. */
export function f0BandThresholds(): { maleMax: number; femaleMin: number } {
  const half = Math.atanh(GENDER_MODEL.androgynousBand) * GENDER_MODEL.scoreSpread;
  return {
    maleMax: GENDER_MODEL.androgynousCenter - half,
    femaleMin: GENDER_MODEL.androgynousCenter + half,
  };
}
