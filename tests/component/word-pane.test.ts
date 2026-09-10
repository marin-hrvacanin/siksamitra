/**
 * THE TASK PANE, AS A PERSON MEETS IT.
 *
 * The pane has no framework — it is `document.createElement` and attribute
 * changes — so the only way to find out what somebody sees is to build it into
 * a DOM and read it. `word/client.ts` is replaced here, because it is the one
 * module that talks to Word and there is no Word in a jsdom; everything above
 * it is the code under test.
 *
 * FOUR THINGS THIS ANSWERS, and nothing else in the repository can:
 *
 *   1. THE PANE SHOWS THE DOCUMENT'S TEXT, AND THE DOCUMENT IS UNTRUSTED. A
 *      `.docx` is a file somebody emails you, and the pane displays the
 *      selection and the importer's complaints. `<img src=x onerror=…>` typed
 *      into a Word paragraph must arrive as characters. The pane runs inside
 *      Word with `ReadWriteDocument`, so a script that got in could rewrite the
 *      open document.
 *   2. A FRESH DOCUMENT IS LED, NOT BLOCKED. It has none of the seventeen
 *      styles, so the group that fixes that comes first — and says so in
 *      words, not by disabling things.
 *   3. THE DESTRUCTIVE BUTTON ASKS FIRST. "Run over the document" rewrites
 *      every mantra paragraph, and `insertOoxml` over a paragraph replaces the
 *      whole paragraph — a comment or a bookmark inside one does not come back.
 *   4. A BUTTON'S STATE FOLLOWS THE SELECTION. A holding needs a range; a
 *      pause is placed at a caret. Pressing one that cannot apply is the
 *      commonest way an add-in looks broken.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ── the Word that is not here ──────────────────────────────────────────── */

const located = {
  tm: { text: 'oṁ agnim īḷe puraḥ', marks: [] as unknown[] },
  map: [] as unknown[],
  from: 3,
  to: 8,
  style: 'Translit' as string | null,
  isVerse: true,
  unresolved: [] as { what: string; raw: string; lossy: boolean }[],
};

/** What the faked document reports as missing. Set per test. */
let missing: string[] = [];
const calls = { addStyles: [] as boolean[], writeDocument: 0, writeParagraph: 0 };

vi.mock('../../apps/word-addin/src/word/client.js', () => ({
  locate: vi.fn(async () => structuredClone(located)),
  writeParagraph: vi.fn(async () => { calls.writeParagraph += 1; }),
  readDocument: vi.fn(async () => [
    { index: 0, tm: { text: 'agnim', marks: [] }, style: 'Translit' },
  ]),
  writeDocument: vi.fn(async () => { calls.writeDocument += 1; return 1; }),
  documentStyles: vi.fn(async () => ({ missing, total: 16 })),
  addStyles: vi.fn(async (keep: boolean) => { calls.addStyles.push(keep); missing = []; }),
}));

/* Imported AFTER the mock, so the pane binds to it. */
const { build, refresh } = await import('../../apps/word-addin/src/ui/pane.js');
const { ARM_MS } = await import('../../apps/word-addin/src/ui/dom.js');

/** Let the pane's promises settle — it builds synchronously and then reads. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};

let root: HTMLElement;

const mount = async (): Promise<void> => {
  root = document.createElement('div');
  document.body.append(root);
  build(root);
  await settle();
};

const button = (label: string): HTMLButtonElement | undefined =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

const text = (): string => root.textContent ?? '';

beforeEach(() => {
  /* `located` is module-level, so every field a test changes has to come back
     — including the text. Leaving one behind made two later tests fail with a
     message about a button, which says nothing about the cause. */
  located.tm = { text: 'oṁ agnim īḷe puraḥ', marks: [] };
  missing = [];
  calls.addStyles = [];
  calls.writeDocument = 0;
  calls.writeParagraph = 0;
  located.from = 3;
  located.to = 8;
  located.unresolved = [];
});

afterEach(() => {
  root.remove();
  vi.useRealTimers();
});

describe('what is in the pane', () => {
  it('the marking buttons, the rules, the document group and the version', async () => {
    await mount();
    for (const label of ['Short', 'Long', 'Anudātta', 'Svarita', 'Pause', 'Clear']) {
      expect(button(label), label).toBeDefined();
    }
    expect(text()).toContain('This document');
    expect(text()).toContain('The rules');
    /* The version, because a task pane is a CACHED page: Word holds one for
       days and nothing in Office says which build is loaded. */
    expect(text()).toMatch(/v\d+\.\d+\.\d+/);
  });

  it('and a link to what the marks mean, which opens outside the pane', async () => {
    await mount();
    const link = root.querySelector('a');
    expect(link?.getAttribute('href')).toMatch(/^https:\/\//);
    /* `noopener` because the pane is a privileged context: a page it opens
       must not get a handle back to it. */
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});

describe('the document’s text is displayed and never interpreted', () => {
  const HOSTILE = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<svg onload=alert(1)>',
    '</strong><iframe src=javascript:alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
  ];

  for (const payload of HOSTILE) {
    it(`a selection of ${payload.slice(0, 22)}… stays characters`, async () => {
      located.tm = { text: payload, marks: [] };
      located.from = 0;
      located.to = payload.length;
      await mount();
      await refresh();
      await settle();

      /* It is ON SCREEN — otherwise this would pass by showing nothing. */
      expect(text()).toContain(payload);
      /* And nothing the payload asked for became an element. */
      for (const tag of ['img', 'script', 'svg', 'iframe', 'a[href^="javascript:"]']) {
        expect(root.querySelectorAll(tag).length, `${payload} created ${tag}`).toBe(0);
      }
    });
  }

  it('and so does what the importer could not account for', async () => {
    /* The other string that comes out of the document: the importer's own
       report of what it could not place, shown as a list. */
    located.tm = { text: 'agnim', marks: [] };
    located.unresolved = [
      { what: 'inline comment', raw: '<script>alert(1)</script>', lossy: true },
    ];
    await mount();
    await refresh();
    await settle();
    expect(text()).toContain('<script>alert(1)</script>');
    expect(root.querySelectorAll('script')).toHaveLength(0);
  });

  it('and a paragraph carrying text the reader cannot place refuses the write', async () => {
    /* Marking would replace the paragraph, and the unplaceable letters are not
       in what would be written back — so pressing Short would DELETE them. */
    located.unresolved = [{ what: 'inline comment', raw: 'a note', lossy: true }];
    await mount();
    await refresh();
    await settle();
    button('Short')?.click();
    await settle();
    expect(calls.writeParagraph).toBe(0);
    expect(text()).toContain('Refusing to write');
  });
});

describe('a fresh document', () => {
  it('is led with the group that prepares it, and says what is missing', async () => {
    missing = ['Translit', 'Holding', '2Holding', 'Svara'];
    await mount();
    const group = root.querySelector('[data-group="document"]');
    expect(group?.getAttribute('data-ready')).toBe('false');
    expect(text()).toContain('styles are in this document');
  });

  it('and a document with everything says so, quietly', async () => {
    missing = [];
    await mount();
    const group = root.querySelector('[data-group="document"]');
    expect(group?.getAttribute('data-ready')).toBe('true');
    expect(text()).toContain('has all 16 śikṣāmitra styles');
  });

  it('and one with none of them says marking still works', async () => {
    /* Because it does: every insertion carries the style sheet. Telling
       somebody they cannot mark yet would be false, and they would stop. */
    missing = Array.from({ length: 16 }, (_, i) => `S${i}`);
    await mount();
    expect(text()).toContain('Marking still works');
  });

  it('“Add the styles” puts them in and leaves nothing behind', async () => {
    missing = ['Translit'];
    await mount();
    button('Add the styles')?.click();
    await settle();
    expect(calls.addStyles).toEqual([false]);
    expect(text()).toContain('styles are in the document now');
    expect(text()).not.toContain('The specimen is at the end');
  });

  it('“Insert a specimen” leaves it, and says it can be deleted', async () => {
    missing = ['Translit'];
    await mount();
    button('Insert a specimen')?.click();
    await settle();
    expect(calls.addStyles).toEqual([true]);
    expect(text()).toContain('delete it when you have read it');
  });
});

describe('the button that rewrites the whole document', () => {
  it('asks before it does it', async () => {
    await mount();
    const all = button('Run over the document');
    expect(all).toBeDefined();
    all?.click();
    await settle();
    /* Nothing has happened yet, and the button now holds the question. */
    expect(calls.writeDocument).toBe(0);
    expect(all?.textContent).toContain('Rewrite every mantra line?');
    expect(all?.getAttribute('data-armed')).toBe('yes');
  });

  it('and does it on the second press', async () => {
    await mount();
    const all = button('Run over the document');
    all?.click();
    await settle();
    all?.click();
    await settle();
    expect(calls.writeDocument).toBe(1);
    expect(all?.getAttribute('data-armed')).toBeNull();
  });

  it('and forgets the question if it is left unanswered', async () => {
    /* A button left armed while somebody answered the phone must not still be
       armed when they come back and click where a harmless button used to be. */
    vi.useFakeTimers();
    await mount();
    const all = button('Run over the document');
    all?.click();
    expect(all?.getAttribute('data-armed')).toBe('yes');
    vi.advanceTimersByTime(ARM_MS + 1);
    expect(all?.getAttribute('data-armed')).toBeNull();
    expect(all?.textContent).toContain('Run over the document');
  });

  it('while running over the SELECTION asks nothing', async () => {
    /* It touches one paragraph, which one Ctrl+Z takes back. */
    await mount();
    const here = button('Run over the selection');
    here?.click();
    await settle();
    expect(calls.writeParagraph).toBe(1);
  });
});

describe('a button’s state follows the selection', () => {
  it('a holding needs letters; a pause does not', async () => {
    located.from = 5;
    located.to = 5;
    await mount();
    await refresh();
    await settle();
    expect(button('Short')?.disabled, 'Short with no range').toBe(true);
    /* A point marking is placed AT the caret, so it is the one thing that
       still works there. */
    expect(button('Pause')?.disabled, 'Pause at a caret').toBe(false);
    expect(text()).toContain('The caret is at letter 5');
  });

  it('and with a range, both work and the selection is shown', async () => {
    located.from = 3;
    located.to = 8;
    await mount();
    await refresh();
    await settle();
    expect(button('Short')?.disabled).toBe(false);
    expect(text()).toContain('agnim');
    expect(root.querySelector('.where')?.getAttribute('data-state')).toBe('range');
  });

  it('and pressing Short writes the paragraph once', async () => {
    await mount();
    await refresh();
    await settle();
    button('Short')?.click();
    await settle();
    expect(calls.writeParagraph).toBe(1);
  });
});
