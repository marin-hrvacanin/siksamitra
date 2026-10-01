/**
 * THE ADD-IN USED DIRTILY, SECOND ROUND — a real page's paragraphs around
 * the mantra lines, a register switched away and back, a part that would
 * nest, Clear all over a part's edge, and a convention changed while the
 * lines are in Devanāgarī.
 *
 * As in `dirty.ts`: every expectation is the engine's line for the text, or
 * what the document held before.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { check, drive, engine, errorsOf, lines, marks, packageOf, readsOf, type Read, type Step } from './lib.js';
import { documentPartOf } from '../../apps/word-addin/src/model/opc.js';

const A = 'saṁ samidyuvase vṛṣann agne viśvāny arya ā';
const B = 'hiraṇyavarṇāṁ hariṇīṁ suvarṇarajatasrajām';
const HEAD = 'Agni Sūktam';
const TRANS = 'We praise Agni, the priest of the sacrifice.';
const NUM = '॥ 1 ॥';

const settle = (conventions: Record<string, boolean> | null = null): Step => ({
  js: "const s = Office.context.document.settings; s.set('siksamitra.register', 'taittiriya');"
    + (conventions === null ? "s.remove('siksamitra.conventions'); s.remove('siksamitra.conventions.markedWith');"
      : `s.set('siksamitra.conventions', ${JSON.stringify(conventions)});`)
    + 'await new Promise((r) => s.saveAsync(r));',
});
const caret = (p: number): Step => ({ sel: [p, 0, p, 0] });
const OK: Step = { dialog: 'OK', wait: 600 };
const reapplyAll = (at: number): Step[] => [caret(at), { press: 'Re-apply rules', wait: 2500, still: true }, { dialog: 'Re-apply', wait: 8000 }, OK];
const remark = (at: number, register: string): Step[] =>
  [caret(at), { press: register, wait: 2500, still: true }, { dialog: 'Re-mark it', wait: 8000 }, OK];
const shape = (tm: TextAndMarks) => ({ text: tm.text, marks: marks(tm) });
const withHand = (tm: TextAndMarks, ...hand: string[]) => ({ text: tm.text, marks: [...marks(tm), ...hand].sort() });
const tags = (read: Read): string[] => [...documentPartOf(packageOf(read)).matchAll(/<w:tag w:val="([^"]+)"/g)].map((m) => m[1]!);
/** A paragraph as a person would compare it: its style and its visible runs. */
const looks = (read: Read, i: number) => {
  const l = lines(read)[i]!;
  return { style: l.style, runs: l.runs.filter((r) => r.hidden !== true).map((r) => `${r.rStyle ?? ''}:${r.text}`) };
};
const OFF = { 'nasal-before-nasal': false, 'visarga-before-velar': false, 'vy-aid': true, 'geminate-box': true };

{
  const r = drive([
    settle(),
    { lines: [{ text: HEAD, style: 'Heading 1' }, { text: A, style: 'Mantra' }, { text: TRANS, style: 'Translation' },
      { text: B, style: 'Mantra' }, { text: '', style: 'Mantra' }, { text: NUM, style: 'Mantra' }] },
    { read: true },
    /* 1: the whole page re-applied. */
    ...reapplyAll(2), { read: true },
    /* 2: the first mantra line its own part, Ṛgveda, and a person's box on it. */
    { sel: [2, 0, 2, -1] }, { press: 'Ṛgveda', wait: 2500, still: true }, { dialog: 'Mark them', wait: 8000 }, OK,
    { sel: [2, 0, 2, 1] }, { press: 'Short' }, { read: true },
    /* 3: → Taittirīya; 4: → Ṛgveda and back to Taittirīya. */
    ...remark(2, 'Taittirīya'), { read: true },
    ...remark(2, 'Ṛgveda'), ...remark(2, 'Taittirīya'), { read: true },
    /* 5: a new part reaching from the part over the translation to the next line: refused. */
    { sel: [2, 0, 4, -1] }, { press: 'New part from these lines', wait: 3000, still: true }, OK, { read: true },
    /* 6: Clear all over the part's edge. */
    { sel: [2, 0, 4, -1] }, { press: 'Clear all', wait: 8000 }, { read: true },
    /* 7: Devanāgarī, the conventions switched, the whole page re-applied — in Devanāgarī. */
    caret(2), { press: 'Devanāgarī', wait: 2500, still: true }, { dialog: 'Write it', wait: 8000 }, OK,
    settle(OFF), ...reapplyAll(2), { read: true }, settle(),
  ]);
  check('M: every step ran', errorsOf(r), []);
  const reads = readsOf(r);
  if (reads.length === 8) {
    const [start, whole, boxed, taitt, back, nested, cleared, deva] = reads;
    const tm = (read: Read, i: number) => shape(lines(read)[i]!.tm);
    check('M1 the page re-applied: its mantra lines exactly the engine’s', [tm(whole!, 1), tm(whole!, 3)],
      [shape(engine(A, 'taittiriya')), shape(engine(B, 'taittiriya'))]);
    check('M1 and the heading, the translation, the empty line and the number untouched',
      [0, 2, 4, 5].map((i) => looks(whole!, i)), [0, 2, 4, 5].map((i) => looks(start!, i)));
    check('M2 the part in Ṛgveda, a person’s box on it', tm(boxed!, 1), withHand(engine(A, 'rigveda'), 'hold:0-1:short'));
    check('M3 → Taittirīya: exactly Taittirīya, the box kept', tm(taitt!, 1), withHand(engine(A, 'taittiriya'), 'hold:0-1:short'));
    check('M4 → Ṛgveda → Taittirīya again: exactly what was there', tm(back!, 1), tm(taitt!, 1));
    check('M4 and still one part', tags(back!), ['siksamitra:part:v1:taittiriya']);
    check('M5 a part reaching into a part: refused, no part inside a part', tags(nested!), ['siksamitra:part:v1:taittiriya']);
    check('M5 and nothing changed', lines(nested!).map((l) => shape(l.tm)), lines(back!).map((l) => shape(l.tm)));
    check('M6 Clear all over the edge: both mantra lines bare of every mark',
      [marks(lines(cleared!)[1]!.tm), marks(lines(cleared!)[3]!.tm)], [[], []]);
    check('M6 and the translation between them untouched', looks(cleared!, 2), looks(start!, 2));
    const d = lines(deva!);
    check('M7 in Devanāgarī, the conventions switched: exactly the engine’s lines in them',
      [shape(d[1]!.tm), shape(d[3]!.tm)], [shape(engine(cleared ? lines(cleared)[1]!.tm.text : A, 'taittiriya', OFF)), shape(engine(lines(cleared!)[3]!.tm.text, 'taittiriya', OFF))]);
    check('M7 and still written in Devanāgarī', [d[1]!.script, d[3]!.script], ['deva', 'deva']);
    check('M7 and the heading and translation still as they were', [looks(deva!, 0), looks(deva!, 2)], [looks(start!, 0), looks(start!, 2)]);
  }
}

/* M8: a document of the app brought in at the caret — the pane's own file
   picker, the app's own reader and writer — and every verse of it read back
   out of Word as the app has it. */
{
  const { openChantDoc } = await import('@siksamitra/engine');
  const { packDocument } = await import('@siksamitra/interop');
  const { toTextAndMarks } = await import('@siksamitra/format');
  const { readFileSync, writeFileSync } = await import('node:fs');
  const { join, resolve } = await import('node:path');
  const { DIR } = await import('./lib.js');
  const doc = openChantDoc(JSON.parse(readFileSync('corpus/chants/mantra-pushpam.json', 'utf8')));
  const file = resolve(join(DIR, 'mantra-pushpam.smdoc'));
  writeFileSync(file, await packDocument(doc, { slug: 'mantra-pushpam.smdoc', engine: 'test' }));
  const r = drive([
    settle(), { lines: [{ text: 'before it', style: 'Normal' }] }, { sel: [1, 0, 1, 0] },
    { js: 'await Office.addin.showAsTaskpane();' }, { wait: 3000 }, { upload: file, wait: 10000 }, { read: true },
  ]);
  check('M8: every step ran', errorsOf(r), []);
  const read = readsOf(r)[0];
  if (read !== undefined) {
    const lead = (tm: TextAndMarks) => {
      const n = tm.text.length - tm.text.trimStart().length;
      return { text: tm.text.slice(n), marks: tm.marks.filter((m) => !['syl', 'plain', 'slot'].includes(m.k))
        .map((m) => `${m.k}:${m.from - n}-${m.to - n}:${m.v ?? ''}`).sort() };
    };
    const got = lines(read).filter((l) => l.verse).map((l) => lead(l.tm));
    const want = doc.sections.flatMap((s) => s.verses).map((v) => lead(toTextAndMarks(v)));
    check('M8 every verse came in, letters and marks as the app has them', got, want);
    check('M8 and the paragraph that was there is still there', lines(read).some((l) => l.tm.text === 'before it'), true);
  }
}
