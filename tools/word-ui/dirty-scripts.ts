/**
 * MARKING IN ANOTHER SCRIPT, AND EVERYTHING DONE TWICE — in real Word.
 *
 * The same line twice, one in IAST and one written in Devanāgarī (then
 * Telugu, then Tamil): each mark placed on both, at the same letter, must
 * leave the two lines the SAME line underneath — the script is how a line is
 * written, never what it says. The expectation is the IAST twin, marked by
 * the same command: a different path from the script one under test.
 *
 * And idempotence, as a person would meet it: Re-apply a second time says
 * there is nothing to change and changes nothing; writing a line in the
 * script it is already in changes nothing; Import styles twice is once.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { check, drive, errorsOf, lines, marks, readsOf, type Read, type Step } from './lib.js';

const A = 'saṁ samidyuvase vṛṣann agne viśvāny arya ā';
const OK: Step = { dialog: 'OK', wait: 600 };
const shape = (tm: TextAndMarks) => ({ text: tm.text, marks: marks(tm) });
const both = (read: Read) => { const ls = lines(read); return [shape(ls[0]!.tm), shape(ls[1]!.tm)]; };
const scriptsOf = (read: Read) => lines(read).map((l) => l.script);

for (const [label, key] of [['Devanāgarī', 'deva'], ['Telugu', 'tel'], ['Tamil', 'tam']] as const) {
  const r = drive([
    { js: "const s = Office.context.document.settings; s.set('siksamitra.register', 'taittiriya'); await new Promise((r) => s.saveAsync(r));" },
    { lines: [{ text: A, style: 'Mantra' }, { text: A, style: 'Mantra' }] },
    { sel: [1, 0, 2, -1] }, { press: 'Re-apply rules', wait: 8000 },
    { sel: [2, 0, 2, -1] }, { press: label, wait: 8000 }, { read: true },
    /* A box on the first letter of each. */
    { sel: [1, 0, 1, 1] }, { press: 'Short' }, { sel: [2, 0, 2, 1] }, { press: 'Short' }, { read: true },
    /* A svarita with the caret after the first vowel of each — after `sa`, after its akṣara. */
    { sel: [1, 2, 1, 2] }, { press: 'Svarita' }, { sel: [2, 1, 2, 1] }, { press: 'Svarita' }, { read: true },
    /* The rules again over both: a second run of what already ran. */
    { sel: [1, 0, 2, -1] }, { press: 'Re-apply rules', wait: 8000, still: true }, { read: true },
    /* The line in the script it is already in: nothing. */
    { sel: [2, 0, 2, -1] }, { press: label, wait: 5000, still: true }, { read: true },
  ]);
  check(`S ${key}: every step ran`, errorsOf(r), []);
  const reads = readsOf(r);
  if (reads.length === 5) {
    const [written, boxed, accented, again, same] = reads;
    check(`S ${key}: written in ${label}, it is the same line as its IAST twin`, both(written!)[1], both(written!)[0]);
    check(`S ${key}: and it IS written in ${label}`, scriptsOf(written!), ['iast', key]);
    check(`S ${key}: a box on its first akṣara is the box on the first letter of the IAST`, both(boxed!)[1], both(boxed!)[0]);
    check(`S ${key}: a svarita after its first akṣara is the svarita after “sa”`, both(accented!)[1], both(accented!)[0]);
    check(`S ${key}: and the svarita is there`, both(accented!)[0]!.marks.some((m) => m.startsWith('svara')), true);
    check(`S ${key}: Re-apply a second time changes nothing`, both(again!), both(accented!));
    check(`S ${key}: the line written in the script it is in changes nothing`, both(same!), both(accented!));
    check(`S ${key}: and it is still in ${label}`, scriptsOf(same!), ['iast', key]);
  }
}

/* The whole document twice, and Import styles twice. */
{
  const r = drive([
    { lines: [{ text: A, style: 'Mantra' }] },
    { sel: [1, 0, 1, 0] }, { press: 'Re-apply rules', wait: 2500, still: true }, { dialog: 'Re-apply', wait: 8000 }, OK, { read: true },
    { sel: [1, 0, 1, 0] }, { press: 'Re-apply rules', wait: 2500, still: true }, { dialog: 'Re-apply', wait: 8000 },
    { said: 'Nothing to change' }, { read: true },
    { press: 'Import styles', wait: 10000, still: true }, { said: 'śikṣāmitra styles are in this document' }, { read: true },
    { press: 'Import styles', wait: 10000, still: true }, { said: 'śikṣāmitra styles are in this document' }, { read: true },
  ]);
  check('I: every step ran', errorsOf(r), []);
  const reads = readsOf(r);
  if (reads.length === 4) {
    const [once, twice, styled, styledTwice] = reads.map((x) => lines(x).map((l) => ({ ...shape(l.tm), style: l.style })));
    check('I: the whole document re-applied twice is re-applied once', twice, once);
    check('I: Import styles leaves the lines as they were', styled, once);
    check('I: and Import styles twice is Import styles once', styledTwice, styled);
  }
}

/* A part made while ANOTHER document is open — which Word refuses an add-in
   through its API, so the add-in makes it in XML (`model/part-package.ts`). */
{
  const r = drive([
    { secondDoc: true },
    { lines: [{ text: A, style: 'Mantra' }, { text: 'hiraṇyavarṇāṁ hariṇīṁ', style: 'Mantra' }, { text: 'third line', style: 'Mantra' }] },
    { sel: [1, 0, 2, -1] }, { press: 'Ṛgveda', wait: 2500, still: true }, { dialog: 'Mark them', wait: 8000 }, OK, { read: true },
    { closeSecond: true },
  ]);
  check('P: every step ran, with a second document open', errorsOf(r), []);
  const read = readsOf(r)[0];
  if (read !== undefined) {
    const ls = lines(read);
    const { documentPartOf } = await import('../../apps/word-addin/src/model/opc.js');
    const { readParagraphs, partOf } = await import('@siksamitra/interop');
    const { packageOf } = await import('./lib.js');
    const regs = readParagraphs(documentPartOf(packageOf(read))).map((p) => partOf(p.sdt)?.register ?? null);
    check('P: and they are the part, the third outside it', regs, ['rigveda', 'rigveda', null]);
    check('P: and no paragraph gained or lost', ls.length, 3);
  }
}
