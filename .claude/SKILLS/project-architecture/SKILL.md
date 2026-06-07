---
name: project-architecture
description: Core architecture, tech stack, folder layout, and clean-code/SOLID conventions for the Pitch Tracker app. Read this FIRST before adding any feature, creating modules, or deciding where code lives.
---

# Project Architecture

Pitch Tracker is a **fully client-side, static** web app for live pitch + volume
detection during recording, with post-recording voice-gender analysis, local
storage of recordings, and MP3 download. **No backend. No server. No network
calls at runtime.** It must run as static files on GitHub Pages.

## Tech stack (locked)

- **Build:** Vite (`vite`), output to `dist/` — static, deployable to GitHub Pages.
- **Language:** TypeScript, `strict: true`. No `any` unless justified with a comment.
- **UI/styling:** TailwindCSS + DaisyUI. Prefer DaisyUI components over hand-rolled
  markup (see [[ui-daisyui-responsive]]).
- **Audio:** Web Audio API + MediaRecorder + getUserMedia (see [[audio-capture]]).
- **No UI framework** (no React/Vue). Plain TS modules + DOM. Keep DOM access
  isolated behind small view/controller modules so logic stays testable.

## Folder layout

```
src/
  main.ts                 # composition root: wires modules, no business logic
  app/
    RecorderController.ts  # orchestrates recording lifecycle + UI state machine
    AppState.ts            # single source of truth for UI state (idle/recording/done)
  audio/
    AudioCapture.ts        # getUserMedia + AudioContext graph (see audio-capture)
    PitchDetector.ts       # frequency estimation (see pitch-detection)
    VolumeMeter.ts         # RMS/dBFS (see volume-detection)
    GenderAnalyzer.ts      # post-record F0/formant scoring (see voice-gender-analysis)
    Mp3Encoder.ts          # PCM -> MP3 (see audio-storage-mp3)
  storage/
    RecordingStore.ts      # IndexedDB CRUD for recordings (see audio-storage-mp3)
  ui/
    components/            # thin DaisyUI-based render helpers
    graphs/
      PitchGraph.ts        # canvas renderer
      VolumeGraph.ts       # canvas renderer
      GenderGauge.ts       # canvas/DaisyUI renderer
  lib/
    notes.ts               # Hz <-> musical note helpers
    time.ts                # filename + timestamp formatting
    types.ts               # shared interfaces
index.html
```

## Naming format for recordings (hard requirement)

Every recording's display name and download filename use **`dd.mm.yyyy-hh:mm:ss`**
(24-hour, local time). Centralize this in `src/lib/time.ts`:

```ts
export function formatRecordingName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}-${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```

> Note: `:` is illegal in filenames on Windows. For the **downloaded file** keep
> the displayed name but provide a filesystem-safe variant (replace `:` with `-`)
> for the actual `download` attribute, while showing `dd.mm.yyyy-hh:mm:ss` in the UI.

## SOLID + clean-code conventions

- **Single Responsibility:** one module = one concern. `PitchDetector` only
  estimates pitch; it never touches the DOM or canvas. Graphs only render; they
  never compute audio features. Controllers wire things; they hold no DSP math.
- **Open/Closed:** new analyzers (e.g. a better gender model) plug in behind an
  interface without editing the controller.
- **Liskov / Interface Segregation:** define small interfaces in `lib/types.ts`,
  e.g. `interface FrameAnalyzer { analyze(frame: Float32Array, sampleRate: number): T }`.
  Pitch, volume, and gender analyzers each implement narrow contracts.
- **Dependency Inversion:** `RecorderController` depends on interfaces
  (`AudioSource`, `RecordingStore`, `FrameAnalyzer`), not concrete classes.
  Wire concretes only in `main.ts`.
- **No globals / no hidden state.** Pass dependencies in via constructors.
- **Pure where possible.** DSP functions take buffers + sampleRate and return
  numbers — no side effects, easy to unit test.
- **Resource hygiene:** always `stop()` tracks, `close()` AudioContext, cancel
  `requestAnimationFrame`, and revoke object URLs. Provide a `dispose()` on any
  module that owns resources.
- **Errors are explicit:** handle `getUserMedia` rejection (denied permission,
  no device, insecure context) with user-facing DaisyUI alerts, never silent.

## State machine (recording lifecycle)

`idle -> requesting-permission -> recording -> analyzing -> done -> idle`

Keep this in `AppState.ts` as a tiny typed state enum + transition guard. The UI
subscribes and re-renders; analyzers start/stop based on transitions. See
[[audio-capture]] for who owns the AudioContext across these states.

## Non-negotiables checklist

- [ ] No runtime network requests. Everything bundled or computed locally.
- [ ] Works over HTTPS (GitHub Pages) — required for `getUserMedia`.
- [ ] Responsive on mobile + desktop (see [[ui-daisyui-responsive]]).
- [ ] Update `readme.md` changelog on every feature (see repo readme).
