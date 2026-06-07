/** The reading-prompt textarea: defaults to the Rainbow Passage (first
 *  paragraph), persists the user's edits to localStorage, and resets to the
 *  default on demand. View + its own small bit of persistence (no audio logic). */

import { byId } from '../lib/dom';

/** Rainbow Passage, first paragraph — a standard phonetically balanced reading. */
export const DEFAULT_READING_TEXT =
  'When the sunlight strikes raindrops in the air, they act as a prism and form a ' +
  'rainbow. The rainbow is a division of white light into many beautiful colors. ' +
  'These take the shape of a long round arch, with its path high above, and its two ' +
  'ends apparently beyond the horizon. There is, according to legend, a boiling pot ' +
  'of gold at one end. People look, but no one ever finds it. When a man looks for ' +
  'something beyond his reach, his friends say he is looking for the pot of gold at ' +
  'the end of the rainbow.';

const STORAGE_KEY = 'pitch-tracker:reading-text';

export function initReadingPrompt(): void {
  const textarea = byId<HTMLTextAreaElement>('reading-text');
  const resetBtn = byId<HTMLButtonElement>('reading-reset');

  textarea.value = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_READING_TEXT;

  textarea.addEventListener('input', () => {
    localStorage.setItem(STORAGE_KEY, textarea.value);
  });

  resetBtn.addEventListener('click', () => {
    textarea.value = DEFAULT_READING_TEXT;
    localStorage.removeItem(STORAGE_KEY);
    textarea.focus();
  });
}
