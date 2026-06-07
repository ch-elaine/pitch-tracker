---
name: pitch-detection
description: Client-side fundamental-frequency (pitch) detection from time-domain audio and rendering the live pitch graph. Read before implementing PitchDetector or PitchGraph. Covers autocorrelation/YIN/MPM algorithms and confidence gating.
---

# Pitch Detection

Estimates the fundamental frequency (F0, in Hz) of each audio frame in real time
and renders it as a scrolling graph during recording. Pure DSP — **no DOM, no
canvas in `PitchDetector`** (rendering lives in `PitchGraph`).

## Algorithm choice

For monophonic voice, in order of accuracy/robustness:

1. **MPM (McLeod Pitch Method)** — best default for voice. Normalized square
   difference + parabolic interpolation. This is what the **`pitchy`** library
   implements; prefer it unless you have a reason not to.
2. **YIN** — difference function + cumulative mean normalization + absolute
   threshold. Very robust, slightly heavier.
3. **Autocorrelation (ACF)** — simplest; fine as a from-scratch fallback but
   noisier on the octave.

**Recommendation:** use `pitchy` (`PitchDetector.forFloat32Array(fftSize)`),
which returns `[pitchHz, clarity]`. It keeps the codebase clean and avoids
hand-tuned DSP bugs. Wrap it behind our own `PitchDetector` interface so it's
swappable (Dependency Inversion — see [[project-architecture]]).

```ts
import { PitchDetector as Pitchy } from 'pitchy';

export class PitchDetector {
  private readonly detector: Pitchy<Float32Array>;
  constructor(fftSize: number) { this.detector = Pitchy.forFloat32Array(fftSize); }

  /** Returns F0 in Hz, or null if signal is too unvoiced/quiet to trust. */
  detect(frame: Float32Array, sampleRate: number): number | null {
    const [hz, clarity] = this.detector.findPitch(frame, sampleRate);
    if (clarity < 0.85) return null;          // gate out noise/silence
    if (hz < 60 || hz > 1000) return null;     // human voice range guard
    return hz;
  }
}
```

## From-scratch autocorrelation (reference / no-dependency fallback)

```
1. Compute RMS; if below a silence floor, return null (no pitch).
2. For lag τ in [minLag, maxLag]: corr(τ) = Σ x[i]·x[i+τ].
3. Find τ at the first strong local max after the zero-lag peak.
4. Parabolic-interpolate around that τ for sub-sample accuracy.
5. F0 = sampleRate / τ.
```
`minLag = sampleRate/1000Hz`, `maxLag = sampleRate/60Hz` bounds the human range.

## Confidence gating (do this — avoids garbage graphs)

- Require a **clarity/periodicity threshold** (~0.85 for MPM) before trusting a value.
- Clamp to the human voice band (~60–1000 Hz) to reject octave errors and hiss.
- On a rejected frame, push `null` (gap in the graph) rather than 0 — a 0 would
  draw a misleading line to the bottom.

## Hz <-> note helpers (`src/lib/notes.ts`)

```ts
const A4 = 440;
export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / A4);
export const midiToNoteName = (m: number) =>
  ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][Math.round(m) % 12]
  + (Math.floor(Math.round(m) / 12) - 1);
```
Show the current note + cents-off-pitch in a DaisyUI `stat` next to the graph.

## Live pitch graph (`src/ui/graphs/PitchGraph.ts`)

- **Canvas**, not SVG/DOM — it updates ~60fps for the whole recording.
- Ring buffer of the last N frames; `push(hz | null)` then draw on the rAF tick
  from [[audio-capture]] (the graph does not own its own loop).
- **Y axis on a log scale** (musical pitch is logarithmic) spanning ~65 Hz (C2)
  to ~1000 Hz; draw faint horizontal gridlines at octave notes.
- Skip line segments where the value is `null` so unvoiced gaps show as breaks.
- Auto-scale time window so the full recording stays visible, or scroll a fixed
  window — pick one and keep it consistent with [[volume-detection]]'s graph.
- Respect device pixel ratio: size the canvas backing store by `devicePixelRatio`
  for crispness on mobile/retina.
- Colors via CSS variables so DaisyUI themes apply (read `--p`, `--bc`, etc.).

## Performance

- `fftSize = 2048` is a good latency/accuracy balance at 44.1k (~46ms window).
- Reuse one `Float32Array`; never allocate inside the rAF loop.
- All math is O(n) or O(n·lags); fine on mobile. Do not run detection on the main
  thread *and* re-render heavy DOM — keep graph drawing to canvas.
