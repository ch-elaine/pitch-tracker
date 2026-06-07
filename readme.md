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
- Audio capture (`getUserMedia` + Web Audio graph + MediaRecorder) replacing the
  placeholder recorder stub.
- Live pitch + volume graph rendering on the canvases.
- Post-recording gender spectrum analysis feeding the voice-character card.
- IndexedDB recordings list with MP3 download (`dd.mm.yyyy-hh:mm:ss` naming).
