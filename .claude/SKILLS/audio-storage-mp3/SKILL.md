---
name: audio-storage-mp3
description: Persisting recordings in the browser (IndexedDB), listing/deleting them, encoding to MP3 with lamejs, and triggering downloads named dd.mm.yyyy-hh:mm:ss. Read before implementing RecordingStore or Mp3Encoder.
---

# Audio Storage + MP3 Export

Recordings are saved **in the browser** (survive reload), listed in the UI, and
downloadable as **.mp3**. No server — everything is client-side.

## Storage: IndexedDB (not localStorage)

`localStorage` is string-only and ~5MB — useless for audio Blobs. Use IndexedDB,
which stores Blobs directly and holds far more.

```ts
interface StoredRecording {
  id: string;          // crypto.randomUUID()
  name: string;        // dd.mm.yyyy-hh:mm:ss  (see lib/time.ts)
  createdAt: number;   // epoch ms
  blob: Blob;          // original recorded container (webm/mp4)
  durationMs: number;
  gender?: GenderResult; // cached analysis (see voice-gender-analysis)
}

interface RecordingStore {
  add(rec: StoredRecording): Promise<void>;
  list(): Promise<StoredRecording[]>;   // newest first
  get(id: string): Promise<StoredRecording | undefined>;
  delete(id: string): Promise<void>;
}
```

Implement against the `RecordingStore` interface (Dependency Inversion). A thin
wrapper over the raw IndexedDB API is fine; the tiny **`idb`** library is an
acceptable dependency if you want cleaner promises. One object store
`recordings`, keyPath `id`, plus an index on `createdAt` for sorting.

Store the **original blob** (cheap, no re-encode on save). Encode to MP3 lazily,
only when the user clicks download.

## Naming

Use `formatRecordingName(new Date())` from `src/lib/time.ts` →
`dd.mm.yyyy-hh:mm:ss` (see [[project-architecture]]). For the actual download
filename, replace `:` with `-` (illegal on Windows) but keep the `:` form as the
UI display name:

```ts
const display = '07.06.2026-14:32:09';
const filename = display.replaceAll(':', '-') + '.mp3'; // 07.06.2026-14-32-09.mp3
```

## MP3 encoding (`src/audio/Mp3Encoder.ts`)

Browsers **cannot natively encode MP3**. Use **`@breezystack/lamejs`** (maintained
fork of lamejs; pure JS, no WASM, works fully client-side and bundles into a
static build).

Pipeline: recorded blob → decode to PCM → Float32 → Int16 → lamejs → MP3 Blob.

```ts
import { Mp3Encoder as Lame } from '@breezystack/lamejs';

export async function encodeToMp3(blob: Blob, kbps = 128): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, 1, 44100); // just for decoding
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer());

  const channels = Math.min(audio.numberOfChannels, 2);
  const sampleRate = audio.sampleRate;
  const enc = new Lame(channels, sampleRate, kbps);

  // Float32 [-1,1] -> Int16
  const toInt16 = (f: Float32Array) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const s = Math.max(-1, Math.min(1, f[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const left = toInt16(audio.getChannelData(0));
  const right = channels > 1 ? toInt16(audio.getChannelData(1)) : undefined;

  const parts: Int8Array[] = [];
  const block = 1152; // MP3 frame size
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const r = right?.subarray(i, i + block);
    const buf = right ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (buf.length) parts.push(buf);
  }
  const end = enc.flush();
  if (end.length) parts.push(end);

  return new Blob(parts, { type: 'audio/mpeg' });
}
```

- For long recordings, run this off the main thread in a **Web Worker** to avoid
  freezing the UI; show a DaisyUI `loading` spinner / `progress` while encoding.
- 128 kbps mono is plenty for voice; expose bitrate as an option if desired.

## Download trigger

```ts
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url); // always revoke to avoid leaks
}
```

## Storage hygiene

- Show total usage via `navigator.storage.estimate()` and let users delete
  recordings (DaisyUI `card` per recording with play / download / delete).
- Handle `QuotaExceededError` on `add()` with a clear DaisyUI alert.
- IndexedDB is origin-scoped and persists across sessions but can be evicted by
  the browser under storage pressure — tell users it's local-only, not a backup.
