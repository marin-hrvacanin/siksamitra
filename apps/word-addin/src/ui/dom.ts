/**
 * THE TWO DOM HELPERS THE PANE IS BUILT FROM.
 *
 * `el` was a closure inside `pane.ts` until a second group needed it. It is
 * here rather than duplicated because the interesting thing about it is what
 * it does NOT do: there is no `innerHTML` anywhere in this add-in, and there
 * is not going to be one.
 *
 * WHY THAT MATTERS MORE HERE THAN IN A WEB PAGE. This pane runs inside Word
 * with `ReadWriteDocument`, so a script that gets into it can rewrite the
 * document the person has open. And the strings it displays come out of THAT
 * DOCUMENT: the selected text, the paragraph's style name, whatever the
 * importer could not account for. A document is untrusted input — somebody
 * mails you a `.docx` — so `<img src=x onerror=…>` typed into a paragraph
 * must reach the pane as eighteen characters and not as an element.
 * `document.createTextNode`, which is what `append` of a string does, is the
 * whole defence, and `tests/security/word-addin.test.ts` holds it.
 */

/** An element, its attributes, and its children. Strings become TEXT nodes. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...kids);
  return node;
};

/**
 * How long an armed button stays armed, in milliseconds.
 *
 * Long enough to read the question and press again; short enough that a
 * button left armed while somebody answered the phone is not still armed when
 * they come back and click where a harmless button used to be.
 */
export const ARM_MS = 6000;

/**
 * A button that asks before doing something that cannot be undone.
 *
 * WHY NOT A DIALOG. A task pane has no modal to put a question in — `confirm()`
 * is blocked in an add-in's iframe on some hosts and ignored on others, and
 * Office's own dialog API opens a separate browser window with its own message
 * channel, which is a lot of machinery to ask one question. The button asking
 * it itself is the pattern task panes actually use.
 *
 * WHAT IT PROTECTS. "Run over the document" rewrites every mantra paragraph in
 * the file. `insertOoxml` over a paragraph replaces the whole paragraph, so a
 * comment, a bookmark or a tracked change inside one does not survive — and
 * that is not undone by pressing Ctrl+Z once. It is worth a second press.
 */
export function arming(
  button: HTMLButtonElement,
  { calm, ask, run }: { calm: string; ask: string; run: () => Promise<void> },
  now: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis,
): { disarm: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const disarm = (): void => {
    if (timer !== null) now.clearTimeout(timer);
    timer = null;
    button.replaceChildren(calm);
    button.removeAttribute('data-armed');
  };
  disarm();
  button.addEventListener('click', () => {
    if (button.getAttribute('data-armed') === 'yes') {
      disarm();
      void run();
      return;
    }
    button.replaceChildren(ask);
    button.setAttribute('data-armed', 'yes');
    timer = now.setTimeout(disarm, ARM_MS);
  });
  return { disarm };
}
