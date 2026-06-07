/** Tiny typed DOM helpers so view modules don't repeat null-checks everywhere. */

/** Query a required element by id; throws if missing (fail fast at startup). */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Expected element #${id} in the DOM`);
  return el as T;
}

/** Toggle an element's visibility via the Tailwind `hidden` class. */
export function setVisible(el: HTMLElement, visible: boolean): void {
  el.classList.toggle('hidden', !visible);
}
