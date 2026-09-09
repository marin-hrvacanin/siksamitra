/**
 * The headless editor — every verb an agent has, against a real document.
 *
 * WHY THIS TIER. These verbs exist so that an agent and a person have the same
 * powers, and the way that is kept true is that they run the same `apply`.
 * Testing them in isolation would prove the argument parsing works; testing
 * them against a corpus document proves the guarantee — that a command line
 * can do what the window can, and cannot do what the window will not.
 *
 * Nothing here touches the corpus on disk. Each test starts from a copy in a
 * temporary directory, so a failure leaves the repository as it found it.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeChantDoc, type ChantDoc } from '@siksamitra/format';
import {
  EDIT_VERBS, runEditVerb, type EditContext, type EditVerb,
} from '../../packages/cli/src/edit-commands.js';

const CORPUS = new URL('../../corpus/chants/durga-suktam.json', import.meta.url);

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sm-cli-'));
  path = join(dir, 'doc.json');
  writeFileSync(path, readFileSync(CORPUS, 'utf8'), 'utf8');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** What the command said, and what it did — without a process. */
interface Ran {
  emitted: unknown;
  said: string;
  died: { code: number; message: string } | null;
  exited: number | null;
  doc: ChantDoc;
}

class Exit extends Error {}

/**
 * Drive one verb the way `main.ts` does.
 *
 * `die` and `process.exit` both throw here rather than ending the run: a test
 * that killed the process would take the whole suite with it, and the exit
 * CODE is part of what these commands promise — 2 for bad input, 3 for a
 * refusal — so it is captured rather than suppressed.
 */
function sm(verb: EditVerb, args: string[]): Ran {
  const argv = args;
  const out: Ran = { emitted: null, said: '', died: null, exited: null, doc: {} as ChantDoc };
  const realExit = process.exit;
  (process as unknown as { exit: (n?: number) => never }).exit = ((n?: number) => {
    out.exited = n ?? 0;
    throw new Exit();
  }) as never;

  const ctx: EditContext = {
    flag: (name) => {
      const i = argv.indexOf(`--${name}`);
      return i >= 0 ? argv[i + 1] : undefined;
    },
    has: (name) => argv.includes(`--${name}`),
    say: (...a) => { out.said += `${a.join(' ')}\n`; },
    emit: (value) => { out.emitted = value; },
    die: ((code: number, message: string) => {
      out.died = { code, message };
      throw new Exit();
    }) as EditContext['die'],
    readDoc: (p) => normalizeChantDoc(JSON.parse(readFileSync(p, 'utf8')) as ChantDoc),
    path,
  };

  try {
    runEditVerb(verb, ctx);
  } catch (e) {
    if (!(e instanceof Exit)) throw e;
  } finally {
    (process as unknown as { exit: typeof realExit }).exit = realExit;
  }
  /* Read back the way the program reads: a composed section stores its
     verses in `items` and `normalizeChantDoc` rebuilds `verses` from them.
     A raw parse here saw sections with no verses at all. */
  out.doc = normalizeChantDoc(JSON.parse(readFileSync(path, 'utf8')) as ChantDoc);
  return out;
}

const marksOf = (doc: ChantDoc, verseId: string): string => JSON.stringify(
  doc.sections.flatMap((s) => s.verses).find((v) => v.id === verseId)?.tokens ?? [],
);

describe('the headless editor', () => {
  it('offers exactly the verbs it documents', () => {
    /* A verb in the list with no implementation is a promise the help text
       makes and the program breaks. */
    for (const verb of EDIT_VERBS) {
      const ran = sm(verb as EditVerb, []);
      expect(ran.died?.code, verb).toBe(2);
      expect(ran.died?.message, verb).not.toContain('unknown editing verb');
    }
  });

  it('changes the register, and says how much moved', () => {
    const ran = sm('set-register', ['--preset', 'rigveda', '--write']);
    expect(ran.doc.profile?.preset).toBe('rigveda');
    expect((ran.emitted as { rederived: string[] }).rederived.length).toBeGreaterThan(0);
    expect(ran.said).toContain('Ṛgveda');
  });

  it('writes nothing at all without --write', () => {
    const before = readFileSync(path, 'utf8');
    const ran = sm('set-register', ['--preset', 'prose']);
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(ran.said).toContain('--write');
    expect((ran.emitted as { changed: boolean }).changed).toBe(true);
  });

  it('refuses a register it does not have, before touching anything', () => {
    const ran = sm('set-register', ['--preset', 'atharva', '--write']);
    expect(ran.died?.code).toBe(2);
    expect(ran.died?.message).toContain('taittiriya');
  });

  it('holds letters by hand, and the mark reaches the tokens', () => {
    const was = marksOf(
      normalizeChantDoc(JSON.parse(readFileSync(path, 'utf8')) as ChantDoc),
      'v-2',
    );
    const ran = sm('hold', ['--verse', 'v-2', '--units', '0-2', '--value', 'long', '--write']);
    expect(ran.died).toBeNull();
    expect(marksOf(ran.doc, 'v-2')).not.toBe(was);
    expect(ran.doc.overrides?.length).toBeGreaterThan(0);
  });

  it('reads --units as a list or a range, and refuses nonsense', () => {
    expect(sm('hold', ['--verse', 'v-2', '--units', '1,4,9', '--value', 'short']).died).toBeNull();
    expect(sm('hold', ['--verse', 'v-2', '--units', '4-1', '--value', 'short']).died?.code).toBe(2);
    expect(sm('hold', ['--verse', 'v-2', '--units', 'x', '--value', 'short']).died?.code).toBe(2);
  });

  it('will not edit a verse copied from a marked source — rule zero, from the CLI too', () => {
    const before = readFileSync(path, 'utf8');
    const ran = sm('set-text', ['--verse', 'v-1', '--text', 'agnim īḷe', '--write']);
    /* 3 is the engine-refusal code. The file is untouched. */
    expect(ran.exited).toBe(3);
    expect((ran.emitted as { ok: boolean }).ok).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('replaces a derived verse, keeps its identity, and re-derives only it', () => {
    const ran = sm('set-text', [
      '--verse', 'v-2', '--text', 'tāmagniṁ varṇāṁ tapasā / jvalantīṁ',
      '--accept-loss', '--write',
    ]);
    expect(ran.died).toBeNull();
    expect((ran.emitted as { rederived: string[] }).rederived).toEqual(['v-2']);
    const verse = ran.doc.sections.flatMap((s) => s.verses).find((v) => v.id === 'v-2');
    /* STILL v-2. Replacing every letter of a verse looks, to a text
       comparison, exactly like deleting it and typing another — and the
       recording, the translation and the word grammar all hang off the id. */
    expect(verse).toBeDefined();
    /* Both pādas: " / " is a line break, the way the marking documents write one. */
    expect(verse?.src?.lines).toHaveLength(2);
    expect((ran.emitted as { orphaned: string[] }).orphaned).toEqual([]);
  });

  it('will not spend a transcribed accent without being told to', () => {
    const before = readFileSync(path, 'utf8');
    /* The edit is legal — v-2 is derived — but its accents were transcribed
       onto the letters this replaces, and they cannot be rebuilt. */
    const ran = sm('set-text', ['--verse', 'v-2', '--text', 'oṁ namaḥ', '--write']);
    expect(ran.exited).toBe(3);
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(ran.said).toContain('--accept-loss');
    expect((ran.emitted as { cost: string[] }).cost.join(' ')).toContain('accent');
  });

  it('adds a verse with the id it was given, and takes it out again cleanly', () => {
    const before = readFileSync(path, 'utf8');
    const added = sm('add-verse', [
      '--section', 'sec-3', '--text', 'oṁ śāntiḥ śāntiḥ śāntiḥ', '--id', 'v-new', '--write',
    ]);
    expect(added.died).toBeNull();
    const section = added.doc.sections.find((s) => s.id === 'sec-3');
    expect(section?.verses.map((v) => v.id)).toContain('v-new');

    const removed = sm('remove-verse', ['--verse', 'v-new', '--write']);
    expect(removed.died).toBeNull();
    /* Byte-identical: adding and removing a verse is not a way to lose one. */
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('refuses an id another verse already uses', () => {
    const ran = sm('add-verse', ['--section', 'sec-3', '--text', 'oṁ', '--id', 'v-1', '--write']);
    expect(ran.died?.code).toBe(2);
    expect(ran.died?.message).toContain('already in use');
  });

  it('sets a document’s own words, and only the ones on the list', () => {
    const ok = sm('set-field', ['--path', 'verse.v-2.translation', '--value', 'A test.', '--write']);
    expect(ok.died).toBeNull();
    expect(
      ok.doc.sections.flatMap((s) => s.verses).find((v) => v.id === 'v-2')?.translation?.en,
    ).toBe('A test.');

    /* The allow-list is the point: "set any field by path" is how a tool ends
       up rewriting the tokens and inventing marks nobody placed. */
    for (const path_ of ['sections.0.verses.0.tokens', 'version', 'verse.v-2.tokens', 'overrides']) {
      const bad = sm('set-field', ['--path', path_, '--value', 'x', '--write']);
      expect(bad.died?.code, path_).toBe(2);
    }
  });

  it('clears a field rather than writing an empty string', () => {
    sm('set-field', ['--path', 'verse.v-2.n', '--value', '99', '--write']);
    const ran = sm('set-field', ['--path', 'verse.v-2.n', '--none', '--write']);
    const verse = ran.doc.sections.flatMap((s) => s.verses).find((v) => v.id === 'v-2');
    expect(verse === undefined ? true : !('n' in verse)).toBe(true);
  });

  it('re-runs the holding rules over a whole section', () => {
    const ran = sm('auto-hold', ['--section', 'sec-1', '--mode', 'keep', '--write']);
    expect(ran.died).toBeNull();
    expect(ran.exited).not.toBe(3);
  });

  it('names the section it cannot find rather than guessing one', () => {
    expect(sm('auto-hold', ['--section', 'nope']).died?.message).toContain('nope');
    expect(sm('set-register', ['--preset', 'prose', '--section', 'nope']).died?.code).toBe(2);
  });
});
