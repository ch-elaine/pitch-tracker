# Pitch Tracker

A **fully client-side, static** web app for **pitch and volume detection**. Record
your voice in the browser and watch live pitch and volume graphs evaluate in real
time. When the recording stops, the app analyzes how **Male / Androgynous /
Female** the voice sounds and shows it on a spectrum gauge. Recordings are stored
locally in your browser and can be downloaded as **MP3**.

No backend, no accounts, no uploads — everything runs in your browser and can be
hosted for free on **GitHub Pages**.

## Features

- 🎙️ **In-browser recording** via `getUserMedia` + `MediaRecorder`.
- 📈 **Live pitch graph** (fundamental frequency) updating in real time while recording.
- 🔊 **Live volume meter + graph** (RMS / dBFS) with clipping warning.
- 🚻 **Voice gender analysis** after recording — a continuous Male ↔ Androgynous ↔
  Female spectrum from pitch (and optionally formant) statistics.
- 💾 **Local storage** of recordings in IndexedDB (survive page reloads).
- ⬇️ **MP3 download** — recordings exported client-side with lamejs.
- 🕒 Recordings named in **`dd.mm.yyyy-hh:mm:ss`** format.
- 📱 **Responsive** for mobile and desktop.
- 🌐 **Fully static** — deployable to GitHub Pages, no server.

> The gender analysis is a perceptual **acoustic heuristic** (pitch/resonance on a
> feminine–masculine spectrum). It is **not** a measure of a person's gender identity.

## Tech stack

- **Vite** + **TypeScript** (strict), no UI framework.
- **TailwindCSS** + **DaisyUI** (component-first UI).
- **Web Audio API** / `MediaRecorder` / `getUserMedia` for audio.
- **pitchy** (pitch), **@breezystack/lamejs** (MP3), **IndexedDB** (storage).

## Getting started

```bash
npm install
npm run dev       # local dev (localhost is a secure context, mic works)
npm run build     # emits static files to dist/
npm run preview   # serve the built dist/ to verify before deploy
```

Microphone access requires a **secure context** (HTTPS or `localhost`). GitHub
Pages serves over HTTPS, so production works out of the box.

## Project structure

See [`.claude/skills/`](.claude/skills/) for the design playbook that guides
implementation:

| Skill | Purpose |
|-------|---------|
| `project-architecture` | Tech stack, folder layout, SOLID/clean-code conventions |
| `audio-capture` | getUserMedia, Web Audio graph, MediaRecorder, lifecycle |
| `pitch-detection` | F0 estimation + live pitch graph |
| `volume-detection` | RMS/dBFS metering + live volume graph |
| `voice-gender-analysis` | Post-recording Male/Androgynous/Female scoring + gauge |
| `audio-storage-mp3` | IndexedDB persistence + MP3 export + download |
| `ui-daisyui-responsive` | Tailwind/DaisyUI setup, components, responsive/a11y |
| `github-pages-deploy` | Static build + GitHub Pages deployment |

## Deployment

Build with Vite and publish `dist/` to GitHub Pages (a ready-to-use Actions
workflow is described in the `github-pages-deploy` skill). Set Vite's `base` to
`/<repo-name>/` for project pages.

## Changelog

All notable changes are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); dates are `YYYY-MM-DD`.

### [Unreleased]

#### Added
- **2026-06-07** — Voice-analysis transparency panel. The result card gained a
  "How this was calculated" section (`GenderDetails`) with three graphs showing
  the actual inputs to the estimate: (1) a pitch-distribution histogram of every
  voiced frame, colored by the male/androgynous/female bands with the median
  marked; (2) the measured F1/F2 plotted against the masculine→feminine
  reference ranges; (3) a score breakdown showing the F0 sub-score, formant
  sub-score, their weights, and the blended result on one −1…+1 axis. All
  scoring constants/functions were extracted to `genderModel.ts` as a single
  source of truth so the graphs and the math can't diverge. `ResponsiveCanvas`
  now redraws on resize (so the canvases render correctly when the collapsed
  panel is expanded).
- **2026-06-07** — Interactive graphs. Both the pitch and volume graphs now draw
  Y-axis tick labels (Hz/note for pitch, dBFS for volume) and show a hover
  crosshair + tooltip reading the exact value at the cursor (reusable
  `GraphPointer`/`HoverTooltip` helpers).
- **2026-06-07** — Advanced (Tier 2) voice-character analysis. New
  `FormantAnalyzer` estimates F1/F2 via LPC (decode → resample to 11 kHz →
  pre-emphasis → Hamming framing → autocorrelation → Levinson-Durbin → spectral-
  envelope peak-picking, median across voiced frames). `GenderAnalyzer` blends
  the formant score with the F0 score (0.6 F0 / 0.4 formant) and factors cue
  agreement into confidence; the result card now reports F1/F2 and which method
  was used. Falls back to F0-only when formants can't be extracted.

#### Changed
- **2026-06-07** — Stabilized the live readouts. Added `PitchStabilizer` (median
  over a short rolling window + a ~200ms "hold" that bridges natural breaths/
  pauses so the pitch no longer blanks mid-speech), and throttled the numeric
  Time/Pitch/Volume readouts to ~10 Hz so the digits stay readable while the
  graphs keep rendering every frame. Gender analysis still consumes the raw
  pitch stream so held values don't bias its median.

#### Fixed
- **2026-06-07** — Recording playback seek bar. `MediaRecorder` WebM/Opus blobs
  report `duration: Infinity`, breaking the native `<audio>` progress bar; the
  list now forces the browser to compute the real duration on metadata load.

#### Added
- **2026-06-07** — Recording & analysis functionality (the full audio pipeline).
  - `AudioCapture`: `getUserMedia` (echo-cancel/noise-suppress/AGC disabled for
    accurate measurement) + Web Audio `AnalyserNode` + `MediaRecorder` with
    container feature-detection, plus strict lifecycle cleanup and typed
    `CaptureError`s (denied / no-device / busy / insecure).
  - `PitchDetector` (McLeod Pitch Method via `pitchy`, clarity-gated, voice-band
    clamped), `VolumeMeter` (RMS→dBFS, smoothing, clipping detection), and
    `GenderAnalyzer` (median-F0 → continuous masculine↔feminine score + label +
    confidence).
  - Live, theme-aware canvas graphs: `PitchGraph` (log-frequency, gapped on
    unvoiced frames, octave gridlines) and `VolumeGraph` (dBFS area), both DPR-
    aware via `ResponsiveCanvas`; single rAF loop in `RecorderController`.
  - `IndexedDbRecordingStore` (Blob persistence via `idb`) and `Mp3Encoder`
    (decode → PCM → `@breezystack/lamejs`) with client-side download named
    `dd.mm.yyyy-hh:mm:ss.mp3`.
  - `RecordingsList` view (inline playback, MP3 download with spinner, delete),
    `GenderGauge` result card, and an `AppState` lifecycle machine wiring it all
    through `RecorderController` (dependency-injected in `main.ts`).
- **2026-06-07** — UI shell, build tooling & deployment.
  - Vite + TypeScript (strict) project scaffold with TailwindCSS 4 + DaisyUI 5
    (CSS-based config, light/dark themes).
  - Responsive (mobile/desktop) UI shell built from DaisyUI components: navbar
    with dark-mode `theme-controller`, recorder panel with record button + live
    `stat` readouts (time/pitch/volume), pitch & volume graph cards (canvas
    placeholders), volume `radial-progress` meter, voice-character spectrum card
    with disclaimer, and a sticky recordings list with empty state.
  - View modules following the architecture skill (`RecorderView`, theme, alerts,
    DOM/time helpers incl. the `dd.mm.yyyy-hh:mm:ss` name formatter).
  - GitHub Actions workflow (`.github/workflows/deploy.yml`) building to `dist/`
    and publishing via the Pages artifact flow; `vite.config.ts` switches the
    `base` path to `/<repo>/` under CI.
- **2026-06-07** — Project design & skills scaffolding. Added eight SKILL playbooks
  under `.claude/skills/` (architecture, audio capture, pitch detection, volume
  detection, voice gender analysis, audio storage + MP3 export, DaisyUI/responsive
  UI, GitHub Pages deploy) and this README describing the project, stack, and
  requirements.

#### Planned
- Move MP3 encoding (and LPC formant analysis) to a Web Worker for long recordings.
- Storage-usage display (`navigator.storage.estimate()`).
