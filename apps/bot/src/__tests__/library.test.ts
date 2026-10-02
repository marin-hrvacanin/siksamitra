/**
 * THE LIBRARY FINDS A TEXT THAT IS A SECTION OF ANOTHER — the Gāyatrī.
 *
 * Asked for the Gāyatrī mantra, the agent searched the web for sixteen
 * minutes and gave up, while the verified pūjā manual had it, marked: the
 * library matched document titles only. Against the real corpus.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { documentOf, verseLetters } from '@siksamitra/agent';
import { packDocument } from '@siksamitra/interop';
import { diskLibrary, type HisDocument } from '../library.js';

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

describe('his own documents, out of the folder tools/bot-library.ts writes', () => {
  /* A folder made here, as the generator makes it: his file, the document as
     a .smdoc, and the index — so the test needs none of his private files. */
  async function folder(): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), 'his-library-'));
    const doc = documentOf({ title: 'bhū sūktam', sections: [
      { title: 'the sūktam', verses: [{ lines: ['bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā ।', 'u̱pasthe̍ te ॥'] }] },
      { title: 'the śānti', verses: [{ lines: ['oṁ śānti̱ḥ śānti̱ḥ śānti̍ḥ ॥'] }] },
    ] });
    writeFileSync(join(dir, 'bhu-suktam-v1-1.smdoc'), await packDocument(doc, { slug: 'bhu-suktam-v1-1.smdoc', engine: 'test' }));
    writeFileSync(join(dir, 'bhū sūktam v1.1.pdf'), new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const [one, two] = doc.sections;
    const index: HisDocument[] = [{
      id: 'his:bhu-suktam-v1-1', title: 'bhū sūktam', version: 'v1.1', script: 'IAST', file: 'bhū sūktam v1.1.pdf', smdoc: 'bhu-suktam-v1-1.smdoc',
      tradition: 'kṛṣṇa yajurvedīya', locus: 'taittirīya saṁhitā 1.5.3', first: 'bhūmir bhūmnā dyaur variṇā', verses: 2,
      sections: [{ id: one!.id, title: 'the sūktam', first: 'bhūmir bhūmnā', verses: 1 }, { id: two!.id, title: 'the śānti', first: 'oṁ śāntiḥ', verses: 1 }],
    }];
    writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
    return dir;
  }

  it('finds a text of his, says it is his, and shows its first words', async () => {
    const lib = diskLibrary(ROOT, await folder());
    const hit = (await lib.find('bhu suktam')).find((h) => h.id === 'his:bhu-suktam-v1-1');
    expect(hit).toEqual(expect.objectContaining({
      title: 'bhū sūktam v1.1', kind: 'reference', source: 'kṛṣṇa yajurvedīya', first: 'bhūmir bhūmnā dyaur variṇā',
      note: 'his own document, in IAST, 2 verses · taittirīya saṁhitā 1.5.3',
    }));
  });

  it('opens it as he made it, and a section of it alone', async () => {
    const dir = await folder();
    const lib = diskLibrary(ROOT, dir);
    const whole = await lib.load('his:bhu-suktam-v1-1');
    expect(whole.kind).toBe('reference');
    expect(verseLetters(whole.doc.sections[0]!.verses[0]!)).toContain('bhūmi̍r bhū̱mnā');
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as HisDocument[];
    const part = await lib.load(`his:bhu-suktam-v1-1#${index[0]!.sections[1]!.id}`);
    expect(part.doc.sections).toHaveLength(1);
    expect(part.doc.title).toBe('the śānti');
  });

  it('hands over his own file for the whole text, and nothing for a section or a verified text', async () => {
    const lib = diskLibrary(ROOT, await folder());
    const his = await lib.original!('his:bhu-suktam-v1-1');
    expect(his?.name).toBe('bhū sūktam v1.1.pdf');
    expect([...his!.bytes]).toEqual([0x25, 0x50, 0x44, 0x46]);
    expect(await lib.original!('his:bhu-suktam-v1-1#x')).toBeNull();
    expect(await lib.original!('purusha-suktam')).toBeNull();
  });

  it('a folder that is not there is a library of the corpus alone', async () => {
    const lib = diskLibrary(ROOT, join(tmpdir(), 'no-such-library-here'));
    expect((await lib.find('bhu suktam')).some((h) => h.id.startsWith('his:'))).toBe(false);
  });
});
