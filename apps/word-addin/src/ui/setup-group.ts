/**
 * "THIS DOCUMENT" — the group that answers the question a fresh Word file
 * poses before any of the marking buttons mean anything.
 *
 * THE FAULT IT FIXES. Open Word, press Short: it works, because every
 * insertion carries the style sheet. What it leaves behind is a document whose
 * Styles pane holds exactly the one style the machine just used — so a person
 * cannot apply a holding themselves, cannot restyle one, cannot set a heading
 * or a translation, and has no way to find out what the vocabulary IS. The
 * add-in worked and the document was not usable without it.
 *
 * SO THE GROUP SAYS WHERE THE DOCUMENT STANDS, in one line, read out of the
 * document rather than remembered: `Body.getOoxml()` carries the document's
 * own `styles.xml`, so "seventeen of seventeen" is a measurement. It sits
 * FIRST in the pane while anything is missing, because that is the order the
 * work happens in, and drops to a quiet line once the document is ready.
 *
 * TWO BUTTONS, BECAUSE THERE ARE TWO WANTS. Somebody preparing a template
 * wants the vocabulary and no visible trace of it. Somebody meeting the
 * notation for the first time wants to SEE a holding, an accent and a pause
 * with their names beside them, and then delete the block. Same insertion,
 * one boolean.
 */
import { addStyles, documentStyles, type DocStyles } from '../word/client.js';
import { STYLE_MEANS } from '../model/setup.js';
import { el } from './dom.js';

/** What the pane needs from its owner: a place to say things, and a redraw. */
export interface SetupDeps {
  say(text: string, kind?: 'plain' | 'warn', lines?: string[]): void;
  guard(what: string, run: () => Promise<void>): Promise<void>;
  /** Called after the document changed, so the pane re-reads the selection. */
  changed(): Promise<void>;
}

export interface SetupGroup {
  readonly element: HTMLElement;
  /** Re-read the document and repaint the line. */
  refresh(): Promise<void>;
  /** Is anything missing? The pane reads this to decide the order. */
  ready(): boolean;
}

/** The line the group leads with. Its own function so a test can read it. */
export function describe(state: DocStyles | null): string {
  if (state === null) return 'Reading the document…';
  const { missing, total } = state;
  if (missing.length === 0) {
    return `This document has all ${total} śikṣāmitra styles.`;
  }
  if (missing.length >= total) {
    return `This document has none of the ${total} śikṣāmitra styles yet. `
      + 'Marking still works — every change brings the style it needs — but you '
      + 'cannot apply one by hand until they are in.';
  }
  return `${total - missing.length} of ${total} styles are in this document. `
    + `Missing: ${missing.map((id) => `${id} (${STYLE_MEANS[id] ?? '?'})`).join(', ')}.`;
}

export function setupGroup(deps: SetupDeps): SetupGroup {
  let state: DocStyles | null = null;
  const line = el('p', { class: 'says' });
  const host = el('div', { class: 'group', 'data-group': 'document' });

  /*
   * `data-ready` on the GROUP, not on the line, because it is what moves the
   * group: while anything is missing the stylesheet lifts it above the marking
   * buttons, which is the order the work happens in. Once the document is
   * ready it drops back to being one quiet line at the bottom.
   */
  const paint = (): void => {
    line.replaceChildren(describe(state));
    host.setAttribute('data-ready', String(state !== null && state.missing.length === 0));
  };

  const put = (keep: boolean, what: string): (() => void) => () => {
    void deps.guard(what, async () => {
      await addStyles(keep);
      state = await documentStyles();
      paint();
      /*
       * THE REDRAW FIRST, THEN THE MESSAGE. `changed()` re-reads the selection
       * and clears the note line as it goes — it owns that line, and a note
       * about a paragraph the person has left is worse than none. Saying this
       * before the redraw meant the redraw wiped it, which is what the
       * component test caught.
       */
      await deps.changed();
      deps.say(state.missing.length === 0
        ? `${state.total} styles are in the document now.${keep
          ? ' The specimen is at the end — delete it when you have read it; '
          + 'the styles stay.'
          : ''}`
        : `Still missing: ${state.missing.join(', ')}.`,
      state.missing.length === 0 ? 'plain' : 'warn');
    });
  };

  const add = el('button', {
    type: 'button', id: 'sm-add-styles',
    title: 'Put every śikṣāmitra style into this document. Nothing visible '
      + 'changes: the specimen that carries them in is removed again.',
  }, 'Add the styles');
  add.addEventListener('click', put(false, 'the styles would not go in'));

  const show = el('button', {
    type: 'button', id: 'sm-specimen',
    title: 'Insert a short block using every style, with its name beside it. '
      + 'Read it, then delete it — the styles stay in the document.',
  }, 'Insert a specimen');
  show.addEventListener('click', put(true, 'the specimen would not go in'));

  host.append(el('h2', {}, 'This document'), line, el('div', { class: 'row' }, add, show));
  paint();

  return {
    element: host,
    async refresh() {
      await deps.guard('cannot read the document’s styles', async () => {
        state = await documentStyles();
        paint();
      });
    },
    ready: () => state !== null && state.missing.length === 0,
  };
}
