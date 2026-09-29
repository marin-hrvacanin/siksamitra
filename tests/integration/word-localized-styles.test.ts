/**
 * A .DOCX FROM A WORD THAT IS NOT IN ENGLISH.
 *
 * Found by running the add-in in a Croatian Word on the web: a built-in
 * style's `w:styleId` is written in the language of the Word that saved the
 * file — `Heading1` is `Naslov1`, `Header` is `Zaglavlje`, `Caption` is
 * `Opisslike` — and only `w:name` keeps the English form. Every reader here
 * keyed a paragraph's role on the id, so a document from any non-English Word
 * came in with no headings at all.
 *
 * Two witnesses:
 *
 *   1. THE REAL THING. `word-web-hr.xml` is the package a Croatian Word on the
 *      web returned from `body.getOoxml()` after the add-in's specimen went
 *      in — not a hand-made imitation of one.
 *   2. HIS OWN DOCUMENT, LOCALISED. `fixtures-sadhana.docx` rewritten the way a
 *      Croatian (or German) Word writes it, then imported. It must come in as
 *      the SAME document the English file makes — the English import is the
 *      expectation, and it is something the importer produces from a
 *      different input, not something this test computes.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  builtInStyleIds, canonicalStyleId, importDocx, readParagraphs,
} from '@siksamitra/interop';

const HR = readFileSync('apps/word-addin/src/model/__tests__/fixtures/word-web-hr.xml', 'utf8');
const SADHANA = new Uint8Array(readFileSync('tools/chant/fixtures-sadhana.docx'));

/** The flat package's document part, the way the add-in takes it out. */
const bodyOf = (pkg: string): string => {
  const m = /<pkg:part pkg:name="\/word\/document\.xml"[\s\S]*?<\/pkg:part>/.exec(pkg);
  expect(m, 'the package has no document part').not.toBeNull();
  return m![0];
};

describe('the package a Croatian Word on the web really returned', () => {
  it('names its built-in styles in Croatian — the premise, measured', () => {
    expect(HR).toContain('w:styleId="Naslov1"');
    expect(HR).toContain('w:styleId="Zaglavlje"');
    expect(HR).toContain('w:styleId="Opisslike"');
    expect(HR).not.toContain('w:styleId="Heading1"');
  });

  it('and its own table says which built-in each one is', () => {
    const t = builtInStyleIds(HR);
    expect(t.get('Naslov1')).toBe('Heading1');
    expect(t.get('Naslov4')).toBe('Heading4');
    expect(t.get('Zaglavlje')).toBe('Header');
    expect(t.get('Opisslike')).toBe('Caption');
    expect(t.get('Normal')).toBe('Normal');
    /* The custom styles are not built-ins and are not in the table. */
    expect(t.has('Translit')).toBe(false);
    expect(t.has('Holding')).toBe(false);
  });

  it('read with its table, the paragraphs carry the English ids', () => {
    const styles = readParagraphs(bodyOf(HR), HR).map((p) => p.pStyle);
    for (const id of ['Heading1', 'Heading2', 'Heading3', 'Heading4', 'Header', 'Caption', 'Translit']) {
      expect(styles, id).toContain(id);
    }
    expect(styles).not.toContain('Naslov1');
  });

  it('and read without it — the old behaviour — they do not: the control', () => {
    const styles = readParagraphs(bodyOf(HR)).map((p) => p.pStyle);
    expect(styles).toContain('Naslov1');
    expect(styles).not.toContain('Heading1');
  });
});

describe('an id that is not a built-in', () => {
  it('passes through unchanged, and null stays null', () => {
    const t = builtInStyleIds(HR);
    expect(canonicalStyleId('Translit', t)).toBe('Translit');
    expect(canonicalStyleId('SomethingElse', t)).toBe('SomethingElse');
    expect(canonicalStyleId(null, t)).toBeNull();
    expect(canonicalStyleId('Naslov1', undefined)).toBe('Naslov1');
  });
});

/* ── his document, as a non-English Word would have saved it ─────────────── */

const LOCALISED: Record<string, Record<string, string>> = {
  croatian: { Heading2: 'Naslov2', Heading3: 'Naslov3', Heading4: 'Naslov4', Normal: 'Normal' },
  german: { Heading2: 'berschrift2', Heading3: 'berschrift3', Heading4: 'berschrift4', Normal: 'Standard' },
};

function localise(bytes: Uint8Array, ids: Record<string, string>): Uint8Array {
  const zip = unzipSync(bytes);
  let doc = strFromU8(zip['word/document.xml']!);
  let styles = strFromU8(zip['word/styles.xml']!);
  for (const [en, local] of Object.entries(ids)) {
    doc = doc.split(`w:val="${en}"`).join(`w:val="${local}"`);
    styles = styles.split(`w:styleId="${en}"`).join(`w:styleId="${local}"`)
      .split(`w:basedOn w:val="${en}"`).join(`w:basedOn w:val="${local}"`)
      .split(`w:next w:val="${en}"`).join(`w:next w:val="${local}"`);
  }
  zip['word/document.xml'] = strToU8(doc);
  zip['word/styles.xml'] = strToU8(styles);
  return zipSync(zip);
}

const shape = (bytes: Uint8Array) => {
  const { doc, report } = importDocx(bytes, 'x');
  return {
    sections: doc.sections.map((s) => [s.title, s.verses.length]),
    structure: report.structure,
  };
};

describe('his document, saved by a Word in another language', () => {
  const english = shape(SADHANA);

  it('the English file has real structure to lose — the control', () => {
    expect(english.sections.length).toBeGreaterThan(5);
    expect(english.structure.verses).toBeGreaterThan(100);
  });

  for (const [language, ids] of Object.entries(LOCALISED)) {
    it(`${language}: comes in as the same document the English file makes`, () => {
      const local = localise(SADHANA, ids);
      /* The localisation really happened — no Heading id is left to find. */
      const doc = strFromU8(unzipSync(local)['word/document.xml']!);
      expect(doc).not.toContain('w:val="Heading3"');
      expect(shape(local)).toEqual(english);
    });
  }
});
