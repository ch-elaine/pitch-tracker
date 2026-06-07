/** Frequency <-> musical-note helpers (equal temperament, A4 = 440 Hz). */

const A4 = 440;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / A4);

export const midiToHz = (midi: number): number => A4 * 2 ** ((midi - 69) / 12);

/** Nearest note name with octave, e.g. 261.6 -> "C4". */
export function hzToNoteName(hz: number): string {
  const midi = Math.round(hzToMidi(hz));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? '?';
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** Signed cents the frequency is off from its nearest note (-50..+50). */
export function centsOffPitch(hz: number): number {
  const midi = hzToMidi(hz);
  return Math.round((midi - Math.round(midi)) * 100);
}
