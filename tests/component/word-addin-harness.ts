/**
 * THE WORD THAT IS NOT HERE — faked once, for every test of the add-in's
 * runtime, its dialogs and its Settings panel.
 *
 * The modules that talk to Word — `word/selection.ts`, `word/client.ts`,
 * `word/parts.ts` — and the one that opens windows, `word/dialog.ts`, are
 * replaced by the mocks below, whose answers each test sets on `host`.
 * Everything between them and the ribbon is the code under test: the actions,
 * the rules, the scripts, the register. Shared so that a second test file does
 * not grow a second fake.
 *
 * Use, with the paths written out (`vi.mock` is hoisted above every import):
 *
 *   vi.mock('../../apps/word-addin/src/word/selection.js',
 *     async () => (await import('./word-addin-harness.js')).selectionMock);
 *
 * and the same for `client.js` (`clientMock`), `parts.js` (`partsMock`) and
 * `dialog.js` (`dialogMock`).
 */
import { beforeEach, vi } from 'vitest';
import type { ScriptKey } from '@siksamitra/engine';

interface FakeLine {
  tm: { text: string; marks: unknown[] };
  map: unknown;
  from: number;
  to: number;
  style: string | null;
  isVerse: boolean;
  unresolved: { what: string; raw: string; lossy: boolean; advisory?: boolean }[];
  blocked: string[];
  wordText: string;
  part: { register: string } | null;
  script: ScriptKey;
  notes: unknown[];
}

export const line = (text: string, from: number, to = from, more: Partial<FakeLine> = {}): FakeLine => ({
  tm: { text, marks: [] }, map: null, from, to, style: 'Translit', isVerse: true, unresolved: [], blocked: [],
  wordText: text, part: null, script: 'iast', notes: [], ...more,
});

interface DocLine {
  index: number; tm: { text: string; marks: unknown[] }; style: string; blocked: string[];
  part: { register: string } | null; script: ScriptKey;
}

/** What each test sets. */
export const host = {
  /** The selection, line by line. */
  lines: [line('agnim īḻe', 9)],
  /** The whole document's mantra lines, for a whole-document run. */
  docLines: [] as DocLine[],
  missing: [] as string[],
  /** His older style ids the document still uses. */
  older: [] as string[],
  /** The part the caret is in, if any. */
  part: null as { register: string } | null,
  /** What `Office.context.document.settings` holds. */
  settings: new Map<string, unknown>(),
  /** How the next question is answered. */
  answer: true,
};

/** What the code under test did. */
export const calls = {
  writes: [] as { writes: { line: number; tm: { text: string; marks: { k: string; v?: string; from: number; to: number }[] }; script?: ScriptKey }[]; caret?: unknown }[],
  documentWrites: [] as { changed: DocLine[]; total: number }[],
  told: [] as { text: string; kind: string; lines: string[] }[],
  asked: [] as string[],
  dialogs: [] as string[],
  addStyles: [] as boolean[],
  converted: 0,
  associated: [] as string[],
  taskpane: 0,
  browser: [] as string[],
};

export const selectionMock = {
  locate: vi.fn(async () => {
    const lines = structuredClone(host.lines);
    return { ...lines[0]!, lines };
  }),
  writeLines: vi.fn(async (writes: (typeof calls.writes)[number]['writes'], caret?: unknown) => {
    calls.writes.push({ writes: structuredClone(writes), caret });
    return writes.length;
  }),
  LineChanged: class extends Error {},
};

export const clientMock = {
  readDocument: vi.fn(async () => ({ lines: structuredClone(host.docLines), shape: { total: host.docLines.length + 2, hidden: [] } })),
  writeDocument: vi.fn(async (changed: DocLine[], shape: { total: number }) => {
    calls.documentWrites.push({ changed: structuredClone(changed), total: shape.total });
    return changed.length;
  }),
  documentStyles: vi.fn(async () => ({ missing: [...host.missing], total: 11, older: [...host.older] })),
  addStyles: vi.fn(async (keep: boolean) => { calls.addStyles.push(keep); host.missing = []; }),
  learn: vi.fn(),
  packageOf: vi.fn(),
};

/** `word/convert.ts`: a conversion counted, the older names gone. */
export const convertMock = {
  convertDocument: vi.fn(async () => {
    calls.converted += 1;
    host.older = [];
    return { written: 3, kept: [], removed: ['Translit', 'Prijevod'] };
  }),
};

export const partsMock = {
  partHere: vi.fn(async () => host.part),
  setPartHere: vi.fn(async (r: { register: string }) => { if (host.part === null) return false; host.part = r; return true; }),
  makePart: vi.fn(async (r: { register: string }) => { if (host.part !== null) return 'inside'; host.part = r; return 'made'; }),
  dissolvePartHere: vi.fn(async () => { const was = host.part; host.part = null; return was; }),
  selectPartHere: vi.fn(async () => host.part !== null),
};

export const dialogMock = {
  tell: vi.fn(async (m: { text: string; kind: string; lines: string[] }) => { if (m.text !== '') calls.told.push(m); }),
  ask: vi.fn(async (question: string) => { calls.asked.push(question); return host.answer; }),
  /* The typing help: the page is recorded, and `replies` are what its keys
     would send, one after another. */
  dialog: vi.fn(async (page: string, _args: unknown, _size: unknown,
    heard: (r: unknown, close: () => void) => void | Promise<void>) => {
    calls.dialogs.push(page);
    let closed = false;
    for (const r of dialogReplies.splice(0)) { if (!closed) await heard(r, () => { closed = true; }); }
  }),
};
/** What the next dialog will be sent, in order. */
export const dialogReplies: unknown[] = [];

(globalThis as { Office?: unknown }).Office = {
  context: {
    requirements: { isSetSupported: () => true },
    document: {
      settings: {
        get: (k: string) => host.settings.get(k) ?? null,
        set: (k: string, v: unknown) => { host.settings.set(k, v); },
        saveAsync: (done: () => void) => { done(); },
      },
      addHandlerAsync: () => undefined,
      removeHandlerAsync: () => undefined,
    },
    ui: {
      openBrowserWindow: (url: string) => { calls.browser.push(url); },
      messageParent: vi.fn(),
    },
    officeTheme: { bodyBackgroundColor: '#FFFFFF' },
  },
  addin: { showAsTaskpane: async () => { calls.taskpane += 1; }, onVisibilityModeChanged: () => undefined },
  actions: { associate: (name: string) => { calls.associated.push(name); } },
  EventType: { DocumentSelectionChanged: 'documentSelectionChanged' },
  HostType: { Word: 'Word' },
};
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
}

/** The last line written, as text. */
export const lastWritten = (): string | undefined => calls.writes.at(-1)?.writes[0]?.tm.text;

beforeEach(() => {
  host.lines = [line('agnim īḻe', 9)];
  host.docLines = [];
  host.missing = [];
  host.older = [];
  host.part = null;
  host.settings.clear();
  host.answer = true;
  dialogReplies.splice(0);
  for (const k of Object.keys(calls) as (keyof typeof calls)[]) {
    const v = calls[k];
    if (Array.isArray(v)) v.splice(0); else (calls as Record<string, unknown>)[k] = 0;
  }
});
