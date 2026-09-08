/**
 * THE WHOLE DOCUMENT LIFECYCLE, driven end to end against a disk that is a Map.
 *
 * The pure pieces are tested where they live — the dirty arithmetic in
 * `shell/__tests__/doc-file.test.ts`, the list rules in `recents.test.ts`, the
 * dialog in `guard-dialog.test.tsx`. What none of those can reach is the
 * SEQUENCING, and the sequencing is where a file lifecycle actually goes
 * wrong:
 *
 *   Cancel has to leave everything exactly as it was — not "proceed without
 *   saving", which is what it collapses into the moment the answer is stored
 *   as a boolean.
 *   Save has to happen BEFORE the thing it was guarding, and a Save that was
 *   itself dismissed has to cancel the whole affair.
 *   A save has to make the document clean, and only up to the edit it wrote.
 *
 * The disk is a `Map<string, string>` behind the same `FileAccess` the desktop
 * and the browser implement, so this drives the real hook, the real session
 * and the real `@siksamitra/edit` — everything except the platform.
 *
 * IN THE COMPONENT TIER because a React hook needs a DOM to run in, and the
 * integration tier is Node. What it asserts is behaviour and not shape: which
 * document is open, whether it has unsaved changes, what reached the disk and
 * in what order.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, readChantFile } from '@siksamitra/format';
import type { FileAccess, OpenedDoc } from '../../apps/web/src/shell/file-host.js';
import { useDocFile, type DocFile } from '../../apps/web/src/shell/useDocFile.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ── the disk ─────────────────────────────────────────────────────────────── */

const disk = new Map<string, string>();
/** What the next Save As will choose, or `null` to dismiss the dialog. */
let willChoose: string | null = '/docs/chosen.json';
/** Every call that reached the disk, in order. */
let touched: string[] = [];

const fakeAccess: FileAccess = {
  writesInPlace: () => true,
  reopenable: (ref) => disk.has(ref),
  pickOpen: async (): Promise<OpenedDoc | null> => {
    if (willChoose === null) return null;
    return fakeAccess.read(willChoose);
  },
  read: async (ref) => {
    touched.push(`read ${ref}`);
    const text = disk.get(ref);
    if (text === undefined) throw new Error('no such file');
    return { ref, name: ref.split('/').pop() ?? ref, text };
  },
  write: async (ref, text) => {
    touched.push(`write ${ref}`);
    disk.set(ref, text);
  },
  pickSave: async (_suggested, text) => {
    if (willChoose === null) { touched.push('save dismissed'); return null; }
    touched.push(`write ${willChoose}`);
    disk.set(willChoose, text);
    return { ref: willChoose, name: willChoose.split('/').pop() ?? willChoose };
  },
};

vi.mock('../../apps/web/src/shell/file-host.js', () => ({
  fileAccess: () => fakeAccess,
}));

/* ── the library, served the way the corpus plugin serves it ──────────────── */

const CORPUS = join(process.cwd(), 'corpus', 'chants');
const library = (slug: string): string => readFileSync(join(CORPUS, `${slug}.json`), 'utf8');

/* ── a harness that is nothing but the hook ───────────────────────────────── */

let api: DocFile;
let notes: string[] = [];
let root: Root | null = null;

function Harness(): null {
  api = useDocFile((m) => notes.push(m));
  return null;
}

/** Let the hook's promises settle, and React paint what they produced. */
const settle = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

beforeEach(async () => {
  disk.clear();
  touched = [];
  notes = [];
  willChoose = '/docs/chosen.json';
  localStorage.clear();
  vi.stubGlobal('fetch', (url: string) => {
    const slug = url.replace('/chants/', '').replace('.json', '');
    try {
      const text = library(slug);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(text) });
    } catch {
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    }
  });
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<Harness />));
  await settle();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
});

/** Make a change the engine records as one undo step. */
const edit = (preset: 'rigveda' | 'taittiriya' | 'prose'): void => {
  act(() => { api.session.setRegister('document', preset); });
};

describe('what the window opens with', () => {
  it('has a document, clean, from the library', () => {
    expect(api.doc).not.toBeNull();
    expect(api.ref).toBe('durga-suktam');
    expect(api.dirty).toBe(false);
    expect(api.error).toBeNull();
  });

  it('is already in Recent', () => {
    expect(api.recents.map((r) => r.ref)).toContain('durga-suktam');
  });
});

describe('a new document', () => {
  it('is empty, untitled and unsaved', async () => {
    act(() => api.newDoc());
    await settle();
    expect(api.pending).toBeNull();
    expect(api.ref).toBeNull();
    expect(api.name).toBe('Untitled');
    expect(api.doc?.sections).toHaveLength(1);
    expect(api.dirty).toBe(false);
  });

  it('can be typed into — the verse is derivable, not transcribed', async () => {
    act(() => api.newDoc());
    await settle();
    edit('prose');
    expect(api.session.refusals).toEqual([]);
    expect(api.dirty).toBe(true);
  });
});

describe('dirty, and what a save does to it', () => {
  it('an edit marks it', () => {
    edit('rigveda');
    expect(api.dirty).toBe(true);
  });

  it('Save As writes canonical bytes and makes it clean', async () => {
    edit('rigveda');
    act(() => api.saveAs());
    await settle();

    expect(api.dirty).toBe(false);
    expect(api.ref).toBe('/docs/chosen.json');
    expect(api.name).toBe('chosen.json');

    const written = disk.get('/docs/chosen.json');
    expect(written).toBeDefined();
    /*
     * The bytes, not merely "a file appeared". Canonical JSON is what
     * `docHash` and the `.vuchant` manifest are taken over, so a save that
     * wrote `JSON.stringify` output would give the same document two
     * identities. Compared against `canonicalJson` of what was read back,
     * which the writer does not call on the way out.
     */
    const back = readChantFile(written!);
    expect(back.ok).toBe(true);
    expect(written).toBe(canonicalJson(back.ok ? back.doc : null));
    expect(written).toBe(canonicalJson(api.doc));
  });

  it('Save afterwards writes back to the same place, without asking', async () => {
    edit('rigveda');
    act(() => api.saveAs());
    await settle();
    touched = [];

    edit('prose');
    expect(api.dirty).toBe(true);
    act(() => api.save());
    await settle();

    expect(touched).toEqual(['write /docs/chosen.json']);
    expect(api.dirty).toBe(false);
  });

  it('a library document has nowhere to write back to, so Save asks', async () => {
    edit('rigveda');
    act(() => api.save());
    await settle();
    /* The corpus is served over HTTP. Saving a library document is a Save As,
       and the document then belongs to the file it was saved to. */
    expect(api.ref).toBe('/docs/chosen.json');
  });

  it('undoing back to the save point is clean again', async () => {
    edit('rigveda');
    act(() => api.saveAs());
    await settle();
    edit('prose');
    expect(api.dirty).toBe(true);
    act(() => api.session.undoEdit());
    expect(api.dirty).toBe(false);
  });

  it('joins Recent when it is saved', async () => {
    act(() => api.saveAs());
    await settle();
    const row = api.recents.find((r) => r.ref === '/docs/chosen.json');
    expect(row?.kind).toBe('file');
    expect(row?.name).toBe('chosen.json');
  });
});

describe('the guard', () => {
  it('does not ask about a document nobody has changed', async () => {
    act(() => api.switchTo('purusha-suktam', 'library'));
    await settle();
    expect(api.pending).toBeNull();
    expect(api.ref).toBe('purusha-suktam');
  });

  it('asks before throwing changes away, and holds what was asked for', () => {
    edit('rigveda');
    act(() => api.switchTo('purusha-suktam', 'library'));
    expect(api.pending).toEqual({ k: 'switch', ref: 'purusha-suktam', kind: 'library' });
    /* Nothing has happened yet — the document is still the one being asked
       about, and it is still dirty. */
    expect(api.ref).toBe('durga-suktam');
    expect(api.dirty).toBe(true);
  });

  it('CANCEL really cancels', async () => {
    edit('rigveda');
    const was = api.doc;
    act(() => api.switchTo('purusha-suktam', 'library'));
    act(() => api.answer('cancel'));
    await settle();

    expect(api.pending).toBeNull();
    expect(api.ref).toBe('durga-suktam');
    expect(api.doc).toBe(was);
    expect(api.dirty).toBe(true);
    expect(touched).toEqual([]);
  });

  it("Don't save goes on without writing", async () => {
    edit('rigveda');
    act(() => api.switchTo('purusha-suktam', 'library'));
    act(() => api.answer('discard'));
    await settle();

    expect(api.ref).toBe('purusha-suktam');
    expect(api.dirty).toBe(false);
    expect(touched).toEqual([]);
  });

  it('Save writes FIRST, then does the thing it was guarding', async () => {
    edit('rigveda');
    act(() => api.switchTo('purusha-suktam', 'library'));
    act(() => api.answer('save'));
    await settle();

    expect(touched).toEqual(['write /docs/chosen.json']);
    expect(disk.has('/docs/chosen.json')).toBe(true);
    expect(api.ref).toBe('purusha-suktam');
    expect(api.dirty).toBe(false);
  });

  it('a Save that is itself dismissed cancels the whole thing', async () => {
    edit('rigveda');
    const was = api.doc;
    willChoose = null;
    act(() => api.switchTo('purusha-suktam', 'library'));
    act(() => api.answer('save'));
    await settle();

    /* The document was never written, so it must still be here. Going on to
       open the other one would discard exactly the work the person had just
       chosen to keep. */
    expect(api.doc).toBe(was);
    expect(api.ref).toBe('durga-suktam');
    expect(api.dirty).toBe(true);
    expect(touched).toEqual(['save dismissed']);
  });

  it('guards New and Open too, not only switching', () => {
    edit('rigveda');
    act(() => api.newDoc());
    expect(api.pending).toEqual({ k: 'new' });
    act(() => api.answer('cancel'));

    act(() => api.openDoc());
    expect(api.pending).toEqual({ k: 'open' });
    act(() => api.answer('cancel'));
    expect(api.ref).toBe('durga-suktam');
  });
});

describe('opening from Recent', () => {
  it('reads the file again', async () => {
    act(() => api.saveAs());
    await settle();
    act(() => api.switchTo('durga-suktam', 'library'));
    await settle();
    expect(api.ref).toBe('durga-suktam');

    act(() => api.switchTo('/docs/chosen.json', 'file'));
    await settle();
    expect(api.ref).toBe('/docs/chosen.json');
    expect(api.dirty).toBe(false);
  });

  it('drops a row whose file has gone, and says so', async () => {
    act(() => api.saveAs());
    await settle();
    disk.delete('/docs/chosen.json');
    act(() => api.switchTo('durga-suktam', 'library'));
    await settle();

    act(() => api.switchTo('/docs/chosen.json', 'file'));
    await settle();

    expect(api.recents.map((r) => r.ref)).not.toContain('/docs/chosen.json');
    expect(notes.join(' ')).toContain('removed from Recent');
    /* And the document that was open is still open. */
    expect(api.ref).toBe('durga-suktam');
  });
});

describe('a file that is not a document', () => {
  it('is reported, and the open document is left alone', async () => {
    disk.set('/docs/junk.json', '{"nope":true}');
    willChoose = '/docs/junk.json';
    act(() => api.openDoc());
    await settle();

    expect(api.ref).toBe('durga-suktam');
    expect(notes.join(' ')).toMatch(/junk\.json/);
    expect(api.recents.map((r) => r.ref)).not.toContain('/docs/junk.json');
  });
});
