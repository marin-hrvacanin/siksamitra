/**
 * THE WORD ADD-IN'S THREAT MODEL, as tests.
 *
 * The add-in is a web page running inside Word with `ReadWriteDocument`, and
 * the strings it handles come out of a `.docx` — which is a file somebody
 * emails you. So the document is UNTRUSTED INPUT, and there are two places
 * that matters:
 *
 *   1. WHAT WE WRITE BACK. The add-in's whole method is read-modify-replace
 *      through `insertOoxml`, so document text becomes XML. Text that closes
 *      `<w:t>` and opens an element of its own would be OOXML INJECTION into
 *      the person's own file — and WordprocessingML has elements worth
 *      injecting: `w:fldSimple` with `DDEAUTO` or `INCLUDETEXT` acts when the
 *      file is opened, `w:altChunk` pulls in another document, an external
 *      relationship fetches a URL. A marking button must not plant any of them.
 *
 *   2. WHAT WE DISPLAY. The pane shows the selected text and the paragraph's
 *      own style name. `<img src=x onerror=…>` typed into a Word paragraph has
 *      to reach the pane as characters. That half is in
 *      `tests/component/word-pane.test.ts`, because it needs a DOM.
 *
 * WHAT THIS FILE LEARNED BY BEING WRONG. Its first version disabled
 * `xmlEscape` entirely and every assertion still passed — because it compared
 * the writer's output against the writer's own escaping, and because it
 * happened to test the case that is safe for a different reason. Both faults
 * are named where they were fixed. That is why the escaper below is a SECOND
 * COPY, in this file, and why the payloads are boxed.
 */
import { describe, expect, it } from 'vitest';
import { mark } from '@siksamitra/format';
import type { TextAndMarks } from '@siksamitra/format';
import { mergeRuns, readParagraphs } from '@siksamitra/interop';
import { documentPartOf, flatPackage } from '../../apps/word-addin/src/model/opc.js';
import {
  decodeRuns, paragraphRuns, paragraphsXml,
} from '../../apps/word-addin/src/model/paragraph.js';
import { styleSheet } from '../../apps/word-addin/src/model/sheet.js';
import { specimenBody } from '../../apps/word-addin/src/model/setup.js';
import { specimenMarks } from '../../apps/word-addin/src/model/specimen-text.js';

/**
 * Text a hostile `.docx` could carry, and a person could simply type.
 *
 * Each is an attempt to stop being text. The last two are not attacks — they
 * are the characters this program is actually about — and they are in the same
 * list because an escaper that mangles `ṁ` while defeating `<` is not a fix,
 * it is a different bug.
 */
const PAYLOADS: readonly { readonly what: string; readonly text: string }[] = [
  { what: 'closing the run and opening another', text: 'a</w:t></w:r><w:r><w:t>b' },
  {
    what: 'a DDE field, which Word acts on when the file opens',
    text: 'a</w:t></w:r><w:fldSimple w:instr="DDEAUTO cmd.exe"/><w:r><w:t>b',
  },
  {
    what: 'INCLUDETEXT, which reads a file off the disk',
    text: '</w:t></w:r><w:r><w:instrText>INCLUDETEXT "secret.txt"</w:instrText><w:r><w:t>',
  },
  {
    what: 'altChunk, which pulls in another document',
    text: '</w:t></w:r></w:p><w:altChunk r:id="rId9"/><w:p><w:r><w:t>',
  },
  { what: 'an ampersand and an entity', text: 'a&b&amp;&lt;script&gt;&#x41;' },
  { what: 'a CDATA end marker', text: 'a]]>b' },
  { what: 'quotes and angle brackets', text: 'a<b>c"d\'e' },
  { what: 'a processing instruction', text: '<?xml-stylesheet?>' },
  { what: 'a comment', text: 'a<!--b-->c' },
  { what: 'a doctype with an entity', text: '<!DOCTYPE[<!ENTITY e SYSTEM "file:///etc/passwd">]>' },
  { what: 'the letters this program is for', text: 'oṁ agnim īḷe puraḥ ṛ ṝ ḹ ṅ ñ ṭ ḍ ṇ ś ṣ' },
  { what: 'a candrabindu, which is a combining character', text: 'gm̐ ka' },
];

/**
 * The test's OWN escaper — deliberately a second copy of one.
 *
 * Rule 1 says one implementation of each thing, and this is the exception that
 * shows what the rule is FOR: an expectation computed by the code under test is
 * not an expectation. Importing `xmlEscape` here would make every assertion
 * below read `escape(x) === escape(x)`, and this whole file would pass with the
 * escaper replaced by the identity function. It did. That was the measurement
 * that found it.
 */
const escaped = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Every `<w:t>` in the paragraph, joined — still escaped.
 *
 * THE WHOLE PARAGRAPH, not the box, and it took two wrong versions to arrive
 * at that. Reading only the FIRST holding run compared a prefix and called it
 * the string. Reading only the holding's runs then failed on a digit, because
 * `documentXml` writes a digit as a `num` token in a run of its own — outside
 * the box — so the box's own runs are not all of the text either.
 *
 * What the security property actually is: everything that reaches the file is
 * the person's text, escaped, with nothing lost and nothing added. That is a
 * statement about the paragraph.
 */
const textContent = (xml: string): string =>
  [...xml.matchAll(/<w:t xml:space="preserve">([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');

/** Everything inside the holding's own runs, joined. */
const boxedText = (xml: string): string =>
  [...xml.matchAll(
    /<w:rStyle w:val="Holding"\/><\/w:rPr><w:t xml:space="preserve">([\s\S]*?)<\/w:t>/g,
  )].map((m) => m[1]).join('');

/** The whole payload under one short holding. */
const boxed = (text: string): TextAndMarks => ({
  text, marks: [mark({ k: 'hold', from: 0, to: text.length, v: 'short' })],
});

/** What the reader gets back from what the writer wrote. */
const roundTrip = (tm: TextAndMarks): string => {
  const paragraphs = readParagraphs(`<w:body>${paragraphsXml(tm)}</w:body>`);
  return decodeRuns(mergeRuns(paragraphs[0]!.runs)).text;
};

describe('document text cannot become an element', () => {
  /*
   * THE PAYLOADS ARE BOXED, because a holding is where an injection can
   * actually form — and finding that out took disabling the escaper and
   * watching every test pass anyway.
   *
   * The writer emits ONE RUN PER LETTER, so `<`, `w`, `:`, `t` and `>` land in
   * five separate `<w:t>` elements and a tag cannot assemble itself out of
   * them. Unmarked text is neutralised by the SHAPE of the output, before any
   * escaping happens at all.
   *
   * A HOLDING IS THE EXCEPTION. `documentXml` writes a boxed group as one run
   * — `group.map(glyph).join('')` — because two adjacent runs with identical
   * borders draw inside ONE set of borders (ECMA-376 §17.3.2.4), which is what
   * lets a box cross a space. So letters under a holding share a `<w:t>`, a
   * closing tag typed into them WOULD close it, and `xmlEscape` is the only
   * thing standing there.
   */
  for (const { what, text } of PAYLOADS) {
    it(`${what}, under a holding`, () => {
      const xml = paragraphsXml(boxed(text));

      /* Every character that reaches the file is the payload, escaped —
         measured against this file's own escaping of it, not the program's. */
      expect(textContent(xml), what).toBe(escaped(text));

      /* And none of the elements the payload asked for exists. */
      for (const forbidden of [
        '<w:fldSimple', '<w:instrText', '<w:altChunk', '<!DOCTYPE', '<!--', '<?xml',
      ]) {
        expect(xml.includes(forbidden), `${what}: ${forbidden} reached the file`).toBe(false);
      }

      /* One `<w:t>` opened for each closed — the count an extra element breaks. */
      const opens = [...xml.matchAll(/<w:t /g)].length;
      const closes = [...xml.matchAll(/<\/w:t>/g)].length;
      expect(opens, what).toBe(closes);
      expect(opens, `${what}: nothing was written at all`).toBeGreaterThan(0);
    });
  }

  it('and the text comes back byte for byte, which is the other half', () => {
    /*
     * ESCAPING ALONE IS NOT ENOUGH. A writer that dropped every `<` would pass
     * every assertion above and quietly delete a person's text. So each
     * payload goes out through the writer, boxed, and back through the reader,
     * and the string has to be the string.
     */
    for (const { what, text } of PAYLOADS) {
      expect(roundTrip(boxed(text)), what).toBe(text);
    }
  });

  it('and unmarked too, one run per letter', () => {
    /* The weaker case, kept because it is what most text is. */
    for (const { what, text } of PAYLOADS) {
      const xml = paragraphsXml({ text, marks: [] });
      expect(xml.includes('<w:fldSimple'), what).toBe(false);
      expect(roundTrip({ text, marks: [] }), what).toBe(text);
    }
  });

  it('and a marking placed by offset still covers the letters it was given', () => {
    /*
     * A payload AND a marking at an offset, so the writer cuts runs inside
     * text it is also escaping. An escape that changed the length would box
     * the wrong letters — and it would look entirely plausible.
     */
    const text = 'a<b>c agnim';
    const tm: TextAndMarks = {
      text, marks: [mark({ k: 'hold', from: 6, to: 11, v: 'short' })],
    };
    expect(text.slice(6, 11)).toBe('agnim');
    expect(boxedText(paragraphsXml(tm))).toBe('agnim');
    expect(roundTrip(tm)).toBe(text);
  });

  it('and a box that spans a space keeps the space, in the box', () => {
    /*
     * NOT A SECURITY PROPERTY, AND HERE BECAUSE THIS FILE FOUND IT. Boxing a
     * whole line and reading it back gave `oṁagnimīḷepuraḥ`: `addLetters`
     * threw away a space, and only the plain-text branch of the reader made
     * one into a token. A holding that spans a space is written as a
     * `Holding` run CONTAINING that space on purpose — an unstyled one would
     * close the box and open a second (ECMA-376 §17.3.2.4) — so in the add-in
     * that meant pressing a second button on a boxed phrase deleted the
     * spaces out of the person's own document.
     */
    const text = 'oṁ agnim īḷe puraḥ';
    const xml = paragraphsXml(boxed(text));
    /* The spaces are inside the box, which is what makes it one rectangle. */
    expect(boxedText(xml)).toBe(text);
    expect(roundTrip(boxed(text))).toBe(text);
  });

  it('and the line stays one paragraph, whatever is in it', () => {
    /* A payload that closed `</w:p>` and opened another would split the mantra
       in two — a different injection with the same cause. */
    for (const { what, text } of PAYLOADS) {
      expect(paragraphRuns(boxed(text)), what).toHaveLength(1);
    }
  });
});

describe('the package the add-in inserts', () => {
  const sheet = styleSheet();
  const pkg = flatPackage(specimenBody(sheet, paragraphsXml(specimenMarks())), sheet);

  it('declares four parts and no more', () => {
    /*
     * Microsoft's OOXML guide: every part must have a relationship and every
     * relationship its part. Four is the minimum that works — rels, document
     * rels, document, styles — and anything else in there is something Word
     * would act on that nobody asked for.
     */
    const names = [...pkg.matchAll(/pkg:name="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(names).toEqual([
      '/_rels/.rels', '/word/_rels/document.xml.rels', '/word/document.xml', '/word/styles.xml',
    ]);
  });

  it('fetches nothing, acts on nothing, and includes nothing', () => {
    /*
     * The things a WordprocessingML package can do to a person that a style
     * sheet has no business doing. `TargetMode="External"` is the one that
     * reaches the network; the rest reach the disk, another document, or a
     * macro.
     */
    for (const forbidden of [
      'TargetMode="External"', 'w:altChunk', 'w:instrText', 'fldSimple',
      'DDEAUTO', 'INCLUDETEXT', 'oleObject', 'w:subDoc', 'w:docVars',
      'attachedTemplate', 'vbaProject', 'w:macro',
    ]) {
      expect(pkg.includes(forbidden), `${forbidden} is in the package`).toBe(false);
    }
  });

  it('carries no relationship whose part is absent', () => {
    const targets = [...pkg.matchAll(/<Relationship [^>]*Target="([^"]+)"/g)].map((m) => m[1]!);
    const names = new Set([...pkg.matchAll(/pkg:name="([^"]+)"/g)].map((m) => m[1]));
    expect(targets.length).toBeGreaterThan(1);
    for (const target of targets) {
      /* Relationship targets are relative to the part's own folder. Both of
         ours live under `/word/`, and the root's names it. */
      const absolute = target.startsWith('word/') ? `/${target}` : `/word/${target}`;
      expect(names.has(absolute), `${target} has no part`).toBe(true);
    }
  });

  it('and the styles part carries no processing instruction', () => {
    /* A declaration inside `pkg:xmlData` is not well-formed, and Word's answer
       to a package it cannot parse is "the file appears to be corrupted". */
    const head = /pkg:name="\/word\/styles\.xml"[^>]*>\s*<pkg:xmlData>([\s\S]{0,80})/.exec(pkg);
    expect(head?.[1]).toBeTruthy();
    expect(head?.[1]?.includes('<?xml')).toBe(false);
  });
});

describe('reading a package Word hands back', () => {
  it('a package with no document part is an error, not an empty string', () => {
    /* Silently answering `''` would make every paragraph read as empty and
       every write replace a paragraph with nothing. */
    expect(() => documentPartOf('<pkg:package></pkg:package>')).toThrow(/document\.xml/);
  });

  it('and a very large hostile package does not hang the pane', () => {
    /*
     * `documentPartOf` is a regex over whatever Word returns, and Word returns
     * the whole neighbourhood — themes, fonts, settings — so the input is
     * large by default: 62 kB for a one-word document, measured. A pattern
     * that backtracked would freeze the task pane with no way out but closing
     * Word. Measured rather than reasoned about.
     */
    const junk = '<pkg:part pkg:name="/word/theme/theme1.xml"><pkg:xmlData>'
      + `${'<a>x</a>'.repeat(40_000)}</pkg:xmlData></pkg:part>`;
    const hostile = `<pkg:package>${junk}<pkg:part pkg:name="/word/document.xml">`
      + '<pkg:xmlData><w:document><w:body/></w:document></pkg:xmlData></pkg:part></pkg:package>';
    const started = Date.now();
    expect(documentPartOf(hostile)).toContain('<w:body/>');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('and unterminated markup is refused rather than half-read', () => {
    expect(() => documentPartOf('<pkg:part pkg:name="/word/document.xml"><pkg:xmlData>'))
      .toThrow();
  });
});
