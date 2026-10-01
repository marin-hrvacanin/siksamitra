/**
 * THE LIBRARY FINDS A TEXT THAT IS A SECTION OF ANOTHER — the Gāyatrī.
 *
 * Asked for the Gāyatrī mantra, the agent searched the web for sixteen
 * minutes and gave up, while the verified pūjā manual had it, marked: the
 * library matched document titles only. Against the real corpus.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { verseLetters } from '@siksamitra/agent';
import { diskLibrary } from '../library.js';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

describe('the library', () => {
  it('finds the Gāyatrī — a section of the pūjā manual — asked for as people ask', async () => {
    const lib = diskLibrary(ROOT);
    for (const q of ['gayatri mantra', 'Gāyatrī', 'the gayatri']) {
      const hits = await lib.find(q);
      expect(hits.map((h) => h.id), q).toContain('puja-vidhi#upa-14a-gayatri');
    }
  });

  it('opens a section as a document of its own, its verse as he marked it', async () => {
    const { doc, kind } = await diskLibrary(ROOT).load('puja-vidhi#upa-14a-gayatri');
    expect(kind).toBe('verified');
    expect(doc.title).toBe('Gāyatrī');
    expect(doc.sections).toHaveLength(1);
    expect(verseLetters(doc.sections[0]!.verses[0]!)).toContain('tat sa̍vitu̱r vare̎ṇya̱ṁ');
  });

  it('a whole document is still found and opened by its title', async () => {
    const lib = diskLibrary(ROOT);
    expect((await lib.find('purusha suktam'))[0]!.id).toBe('purusha-suktam');
    expect((await lib.load('purusha-suktam')).doc.sections.length).toBeGreaterThan(1);
  });
});
