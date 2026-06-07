---
name: volume-detection
description: Real-time loudness/volume measurement (RMS, dBFS) from time-domain audio and rendering the live volume meter + graph. Read before implementing VolumeMeter or VolumeGraph.
---

# Volume Detection

Measures per-frame loudness during recording and renders both an instantaneous
meter and a scrolling graph. Pure DSP in `VolumeMeter`; rendering in
`VolumeGraph` / a DaisyUI meter component.

## Core measurement: RMS -> dBFS

Root-mean-square of the time-domain frame is the honest loudness measure (peak
is too jumpy):

```ts
export class VolumeMeter {
  private smoothed = -Infinity;
  /** Returns smoothed loudness in dBFS (<= 0). -Infinity-ish for silence. */
  measure(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);
    const db = 20 * Math.log10(rms || 1e-8);   // avoid log(0)
    // exponential smoothing so the meter doesn't strobe
    this.smoothed = this.smoothed === -Infinity ? db : this.smoothed * 0.8 + db * 0.2;
    return this.smoothed;
  }
}
```

- **dBFS** (decibels relative to full scale) is `<= 0`. Speech sits roughly
  `-50` (quiet) to `-10` (loud) dBFS. `0` dBFS = clipping.
- Remember mic input had **AGC disabled** (see [[audio-capture]]) so these numbers
  are meaningful.

## Mapping to a 0–100 display value

Pick a usable floor (e.g. `-60` dBFS) and map linearly for meters/graphs:

```ts
export const dbToPercent = (db: number, floor = -60) =>
  Math.max(0, Math.min(100, ((db - floor) / -floor) * 100));
```

## Clipping detection

Track the frame peak; if `Math.max(|x|) >= 0.99` flag clipping and flash the
meter red (DaisyUI `text-error` / `progress-error`). Clipping warns the user the
recording is distorted — useful feedback before they finish.

## Rendering

Two complementary views (both optional but recommended):

1. **Instant meter** — prefer a DaisyUI component:
   - `radial-progress` with `--value` bound to `dbToPercent(db)`, or
   - a `progress` bar (`progress-success` / `progress-warning` / `progress-error`
     by threshold).
   Update via the shared rAF tick from [[audio-capture]].
2. **Scrolling graph** (`src/ui/graphs/VolumeGraph.ts`) — canvas, same ring-buffer
   + DPR pattern as [[pitch-detection]]'s graph. Draw a filled area for amplitude;
   keep the same time window/scroll behavior as the pitch graph so they read as a
   synchronized pair. Y axis in dBFS (e.g. `-60` at bottom, `0` at top).

## Conventions

- No DOM access inside `VolumeMeter` — return numbers only (SRP).
- Reuse buffers; no allocation in the loop.
- Colors from DaisyUI CSS variables so themes apply.
- Keep smoothing constant (`0.8/0.2`) configurable via constructor for testability.
