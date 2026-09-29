/**
 * THE WORD THAT IS NOT HERE — the pane's host, faked once for every pane test.
 *
 * `word/client.ts` is the one module that talks to Word, and there is no Word
 * in a jsdom; it is replaced by `clientMock`, whose answers each test sets on
 * `host`. Everything above it is the code under test. Shared so that a second
 * pane test file does not grow a second fake.
 *
 * Use: `vi.mock(CLIENT, async () => (await import('./word-pane-harness.js')).clientMock);`,
 * the same for `word/selection.js` with `selectionMock`,
 * and then `await import` this module. `root` is read through the module
 * namespace (`H.root`), because it is reassigned by every `mount`.
 */
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

export const located = {
  tm: { text: 'oṁ agnim īḷe puraḥ', marks: [] as unknown[] },
  map: [] as unknown[],
  from: 3,
  to: 8,
  style: 'Translit' as string | null,
  isVerse: true,
  unresolved: [] as {
    what: string; raw: string; lossy: boolean; advisory?: boolean;
  }[],
  blocked: [] as string[],
  wordText: 'oṁ agnim īḷe puraḥ',
};
type DocLine = { index: number; tm: { text: string; marks: unknown[] }; style: string; blocked: string[] };
/** What each test sets: the styles the document lacks, the whole-document
 *  read's lines, and the selection handler the pane registered. */
export const host = {
  missing: [] as string[],
  docLines: [] as DocLine[],
  selectionChanged: null as (() => void) | null,
  /** What `Office.context.document.settings` holds. */
  settings: new Map<string, unknown>(),
  /** Further lines of the selection, after `located`. */
  more: [] as (typeof located)[],
};


export const calls = {
  addStyles: [] as boolean[], writeDocument: 0, writeParagraph: 0,
  writeDocumentTotal: 0, written: 0, linesWritten: 0,
  lastWrites: [] as { tm: { text: string; marks: { k: string; v?: string }[] } }[],
  caret: null as { line: number; at: number } | null,
};

/** The selection: `located` is its one line, unless a test sets `more`. */
export const selectionMock = {
  locate: vi.fn(async () => {
    const one = structuredClone(located);
    return { ...one, lines: [one, ...structuredClone(host.more)] };
  }),
  /* A press writes the selection's lines in ONE call; this counts calls. */
  writeLines: vi.fn(async (writes: unknown[], caret?: { line: number; at: number }) => {
    if (writes.length > 0) calls.writeParagraph += 1;
    calls.linesWritten += writes.length;
    calls.lastWrites = writes as typeof calls.lastWrites;
    calls.caret = caret ?? null;
    return writes.length;
  }),
  LineChanged: class extends Error {},
};

export const clientMock = {
  readDocument: vi.fn(async () => ({
    lines: host.docLines,
    /* `total` is every paragraph, not just the mantra ones: `writeDocument`
       compares it with Word's own count and refuses if they disagree. */
    total: 4,
  })),
  writeDocument: vi.fn(async (changed: unknown[], total: number) => {
    calls.writeDocument += 1;
    calls.writeDocumentTotal = total;
    calls.written = changed.length;
    return changed.length;
  }),
  documentStyles: vi.fn(async () => ({ missing: host.missing, total: 16 })),
  addStyles: vi.fn(async (keep: boolean) => { calls.addStyles.push(keep); host.missing = []; }),
};

/*
 * THE HOST, AS FAR AS THE PANE TALKS TO IT DIRECTLY. The pane follows the caret
 * through `DocumentSelectionChanged`; the handler is captured here, so
 * `refresh()` below is exactly what Word does when the reader moves.
 */
(globalThis as { Office?: unknown }).Office = {
  context: {
    officeTheme: { bodyBackgroundColor: '#1B1A19' },
    document: {
      addHandlerAsync: (_e: unknown, h: () => void) => { host.selectionChanged = h; },
      /* The document's own settings, where the pane records its register. */
      settings: {
        get: (k: string) => host.settings.get(k) ?? null,
        set: (k: string, v: unknown) => { host.settings.set(k, v); },
        saveAsync: (done: () => void) => { done(); },
      },
    },
  },
  EventType: { DocumentSelectionChanged: 'documentSelectionChanged' },
};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
}

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
export { ARM_MS } from '../../apps/word-addin/src/ui/dom.js';

/** Let the pane's promises settle, inside React's act so every update lands. */
export const settle = async (): Promise<void> => {
  /* Microtasks AND a real turn of the event loop, three times over: a press is
     a chain of awaits of no fixed length, and counting microtasks alone passed
     on a quiet machine and failed under the full suite's load. Not under fake
     timers, where a real timeout would never fire. */
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      for (let i = 0; i < 12; i += 1) await Promise.resolve();
      if (!vi.isFakeTimers()) await new Promise((r) => { setTimeout(r, 0); });
    });
  }
};

/** The reader moved the caret. */
export const refresh = async (): Promise<void> => {
  await act(async () => { host.selectionChanged?.(); });
};

export let root: HTMLElement;
let unmount: (() => void) | null = null;

export const mount = async (): Promise<void> => {
  root = document.createElement('div');
  document.body.append(root);
  /* Imported here, not at the top: the pane imports the client, whose mock
     is this module — importing it at load time would wait on itself. */
  const { Pane } = await import('../../apps/word-addin/src/ui/Pane.js');
  const r = createRoot(root);
  await act(async () => { r.render(createElement(Pane)); });
  unmount = () => { act(() => r.unmount()); };
  await settle();
};

export const button = (label: string): HTMLButtonElement | undefined =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

export const text = (): string => root.textContent ?? '';

/* THE PANE IS LOADED ONCE, BEFORE ANY TEST, on its own clock. Its first
   import transforms the whole add-in and the engine under it, and under the
   full suite's load that took longer than a test's 5 s — the first test timed
   out and every later one failed after it. */
beforeAll(async () => {
  await import('../../apps/word-addin/src/ui/Pane.js');
}, 120_000);

beforeEach(() => {
  /* `located` is module-level, so every field a test changes has to come back
     — including the text. Leaving one behind made two later tests fail with a
     message about a button, which says nothing about the cause. */
  located.tm = { text: 'oṁ agnim īḷe puraḥ', marks: [] };
  located.wordText = located.tm.text;
  host.missing = [];
  calls.addStyles = [];
  calls.writeDocument = 0;
  calls.writeDocumentTotal = 0;
  calls.writeParagraph = 0;
  calls.linesWritten = 0;
  calls.lastWrites = [];
  calls.caret = null;
  host.more = [];
  host.settings.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  located.from = 3;
  located.to = 8;
  located.unresolved = [];
  located.blocked = [];
  host.docLines = [{ index: 0, tm: { text: 'agnim', marks: [] }, style: 'Translit', blocked: [] }];
});

afterEach(() => {
  unmount?.();
  unmount = null;
  root.remove();
  vi.useRealTimers();
});
