/** Decodes a recorded blob and re-encodes it to MP3 entirely client-side using
 *  @breezystack/lamejs (pure JS, no WASM — bundles into the static build).
 *  Browsers cannot natively encode MP3, hence the decode -> PCM -> lamejs path. */

import { Mp3Encoder as Lame } from '@breezystack/lamejs';
import type { Mp3Encode } from '../lib/types';

const MP3_FRAME_SIZE = 1152; // samples per MP3 frame (lamejs block size)

/** Convert Float32 [-1,1] PCM to Int16. */
function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function decodeToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  // OfflineAudioContext is used purely to access decodeAudioData off the main graph.
  const ctx = new OfflineAudioContext(1, 1, 44100);
  return ctx.decodeAudioData(await blob.arrayBuffer());
}

export const encodeToMp3: Mp3Encode = async (blob, kbps = 128) => {
  const audio = await decodeToAudioBuffer(blob);
  const channels = Math.min(audio.numberOfChannels, 2);
  const encoder = new Lame(channels, audio.sampleRate, kbps);

  const left = floatToInt16(audio.getChannelData(0));
  const right = channels > 1 ? floatToInt16(audio.getChannelData(1)) : undefined;

  const parts: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += MP3_FRAME_SIZE) {
    const l = left.subarray(i, i + MP3_FRAME_SIZE);
    const chunk = right
      ? encoder.encodeBuffer(l, right.subarray(i, i + MP3_FRAME_SIZE))
      : encoder.encodeBuffer(l);
    if (chunk.length > 0) parts.push(chunk);
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) parts.push(flushed);

  return new Blob(parts as BlobPart[], { type: 'audio/mpeg' });
};
