---
name: voice-gender-analysis
description: Post-recording analysis that scores how Male / Androgynous / Female a voice sounds from F0 and formant statistics, and renders the result gauge. Read before implementing GenderAnalyzer or GenderGauge. Heuristic only — includes required framing/disclaimer.
---

# Voice Gender Analysis

After recording stops, score the voice on a continuous **Male ↔ Androgynous ↔
Female** spectrum and render it. This is a **perceptual acoustic heuristic**, not
a determination of a person's gender or identity — see "Framing" below; it must
be presented that way in the UI.

## Inputs

Run on the **whole recording**, not single frames:

1. **F0 statistics** — accumulate every voiced F0 from the live loop (see
   [[pitch-detection]] / [[audio-capture]]'s `genderAnalyzer.collect(hz)`), then
   compute the **median** (robust to octave-error outliers) and IQR.
2. **Formants (optional, improves accuracy)** — especially **F1/F2**, estimated
   from the decoded recording. Formants reflect vocal-tract length and separate
   voices better than F0 alone, particularly in the androgynous overlap band.

Decode the recorded blob to PCM once for any formant work:
`audioCtx.decodeAudioData(arrayBuffer)` → mix to mono `Float32Array`.

## Scoring model (practical, transparent)

### Tier 1 — F0 median (always available)

Typical adult speaking-F0 ranges (Hz), with a deliberate overlap band:

| Class        | Approx median F0 |
|--------------|------------------|
| Male         | ~85–155          |
| Androgynous  | ~155–185 (overlap)|
| Female       | ~185–255         |

Convert to a smooth score in `[-1, +1]` (`-1` = fully masculine-typical,
`+1` = fully feminine-typical) instead of hard buckets — use a logistic/ramp
centered on the androgynous midpoint (~170 Hz):

```ts
// 165–175 Hz reads androgynous; tails saturate toward male/female.
const score = Math.tanh((medianF0 - 170) / 35); // -1..+1
```

Map score → label: `score < -0.33` Male, `|score| <= 0.33` Androgynous,
`score > 0.33` Female. Also expose the raw continuous score for the gauge.

### Tier 2 — formant refinement (optional)

Estimate F1/F2 via LPC (Linear Predictive Coding):
1. Pre-emphasis filter, window the (voiced) segments.
2. Autocorrelation → Levinson-Durbin → LPC coefficients (order ≈ `2 + sampleRate/1000`).
3. Roots of the LPC polynomial → formant frequencies; take the lowest two as F1/F2.

Higher F1/F2 (shorter vocal tract) skews feminine. Blend a formant-derived score
with the F0 score (e.g. `0.6*f0Score + 0.4*formantScore`). Keep this behind the
same `analyze()` interface so it can be added without touching the controller
(Open/Closed — see [[project-architecture]]).

> If implementing LPC is out of scope, ship Tier 1 only and note formants as a
> future enhancement in the changelog. F0-median alone is a reasonable v1.

## Output shape

```ts
interface GenderResult {
  score: number;                 // -1 (male-typ) .. +1 (female-typ)
  label: 'Male' | 'Androgynous' | 'Female';
  confidence: number;            // 0..1, from voiced-frame count + F0 dispersion
  medianF0: number;
  formants?: { f1: number; f2: number };
}
```

Low confidence when: few voiced frames, very wide F0 spread, or very short
recording. Show confidence in the UI and dim/disclaim low-confidence results.

## Rendering (`src/ui/graphs/GenderGauge.ts`)

Visualize the **continuous spectrum**, not just a label:

- A horizontal gradient bar **Male — Androgynous — Female** with a marker at
  `score` (map `[-1,+1]` → `[0%,100%]`). DaisyUI: a `range`-styled track or a
  custom canvas bar; the marker as a `badge`.
- Or three DaisyUI `radial-progress` / `progress` showing the soft membership of
  each class (e.g. from distance to the three centers, normalized to sum to 1).
- Show `medianF0`, label, and confidence in a DaisyUI `stat` block.
- Theme-aware colors via CSS variables.

## Framing (required in UI copy)

Display a short disclaimer near the gauge, e.g.:

> "This estimates acoustic vocal characteristics (pitch/resonance) on a
> feminine–masculine spectrum. It is not a measure of gender identity."

Keep wording neutral and respectful. Do not phrase results as detecting a
person's gender; phrase as how the *voice sounds* acoustically.
