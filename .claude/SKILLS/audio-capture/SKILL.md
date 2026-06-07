---
name: audio-capture
description: How to capture microphone audio with getUserMedia, build the Web Audio graph (AnalyserNode), and record with MediaRecorder. Read before implementing recording, the live-analysis loop, or anything touching AudioContext lifecycle.
---

# Audio Capture

Owns microphone access and the audio graph. Two parallel consumers of the mic
stream: (1) **MediaRecorder** produces the saved file; (2) an **AnalyserNode**
feeds the live pitch/volume graphs. Both read the same `MediaStream`.

## Secure context requirement

`getUserMedia` only works on **HTTPS or localhost**. GitHub Pages is HTTPS, so
production is fine. Dev uses Vite's localhost. If `window.isSecureContext` is
false, show a DaisyUI alert and bail early.

## Requesting the mic

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,  // keep raw signal for accurate pitch
    noiseSuppression: false,  // suppression distorts F0/formants
    autoGainControl: false,   // AGC ruins volume measurement
    channelCount: 1,
  },
});
```

Disable `echoCancellation`/`noiseSuppression`/`autoGainControl` — they are tuned
for speech intelligibility and actively corrupt pitch and volume measurement.

Handle rejections explicitly: `NotAllowedError` (permission denied),
`NotFoundError` (no mic), `NotReadableError` (device busy). Surface each as a
distinct user message.

## Audio graph

```
MediaStream ──> MediaStreamAudioSourceNode ──> AnalyserNode   (live analysis, NOT connected to destination)
            └─> MediaRecorder                                  (file capture, separate path)
```

```ts
const ctx = new AudioContext();
const source = ctx.createMediaStreamSource(stream);
const analyser = ctx.createAnalyser();
analyser.fftSize = 2048;            // 2048 time-domain samples per frame
analyser.smoothingTimeConstant = 0; // we smooth ourselves; raw frames for pitch
source.connect(analyser);
// Do NOT connect analyser to ctx.destination — that would echo the mic to speakers.
```

- Use `analyser.getFloatTimeDomainData(buf)` for pitch + RMS (time domain).
- `ctx.sampleRate` (usually 44100/48000) is needed by every detector — pass it
  through, never hardcode.
- Browsers may start the `AudioContext` suspended; call `await ctx.resume()` on
  the user gesture that starts recording.

## Recording the file with MediaRecorder

```ts
const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/webm';
const recorder = new MediaRecorder(stream, { mimeType: mime });
const chunks: Blob[] = [];
recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: mime });
  // -> hand blob to RecordingStore + GenderAnalyzer (decode for analysis)
};
recorder.start(100); // timeslice ms; emit chunks periodically
```

Safari historically lacks WebM; it records `audio/mp4`. Feature-detect with
`isTypeSupported` and fall back. The recorded container is irrelevant to the user
because MP3 export decodes + re-encodes (see [[audio-storage-mp3]]).

## The live analysis loop

Drive pitch + volume from a single `requestAnimationFrame` loop while recording —
do not create one loop per metric.

```ts
const buf = new Float32Array(analyser.fftSize);
let raf = 0;
const tick = () => {
  analyser.getFloatTimeDomainData(buf);
  const hz = pitchDetector.detect(buf, ctx.sampleRate);  // see pitch-detection
  const db = volumeMeter.measure(buf);                    // see volume-detection
  pitchGraph.push(hz);
  volumeGraph.push(db);
  genderAnalyzer.collect(hz);                             // accumulate F0 for later
  raf = requestAnimationFrame(tick);
};
```

Stop the loop with `cancelAnimationFrame(raf)` on stop, and accumulate per-frame
pitch values so [[voice-gender-analysis]] can score the whole recording.

## Lifecycle + cleanup (critical)

On stop / unmount:
1. `recorder.stop()`
2. `cancelAnimationFrame(raf)`
3. `stream.getTracks().forEach(t => t.stop())` — releases the mic indicator
4. `await ctx.close()`

Expose this as `dispose()`. Leaking tracks leaves the mic "on" and drains
mobile batteries. This module owns the `AudioContext` for the whole
`recording -> analyzing` window; the controller calls `dispose()` after gender
analysis finishes consuming the decoded buffer.
