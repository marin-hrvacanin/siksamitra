/**
 * THE ADD-IN USED DIRTILY, IN REAL WORD — registers, parts, conventions,
 * hand marks, scripts and Word's own Undo, one on top of another.
 *
 * The owner's instruction: apply one source to a part and then another, mark
 * from both, select across them, "be as dirty with it as possible". Every
 * expectation is the ENGINE's answer for the line's text in the register and
 * conventions that line is under — or what the document held before (rule 9)
 * — never anything the add-in's Word half computed.
 */
import type { ChantProfileKey, TextAndMarks } from '@siksamitra/format';
import { DIR, check, drive, engine, errorsOf, lines, marks, packageOf, readsOf, type Read, type Step } from './lib.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { documentPartOf } from '../../apps/word-addin/src/model/opc.js';
import { stylesPartOf } from '../../apps/word-addin/src/model/package.js';

/* Lines the registers mark differently, and lines each convention changes —
   chosen by asking the engine (Taittirīya adds `gṁ` where Ṛgveda does not). */
const A = 'saṁ samidyuvase vṛṣann agne viśvāny arya ā';
const B = 'hiraṇyavarṇāṁ hariṇīṁ suvarṇarajatasrajām';
const C = 'namaḥ kavaye bhavyāya ca';
const D = 'taṁ namāmi sa hi mitram';
const E = 'tattvamasi uttama pattram';

const settle = (register: ChantProfileKey, conventions: Record<string, boolean> | null = null): Step => ({
  js: `const s = Office.context.document.settings; s.set('siksamitra.register', '${register}');`
    + (conventions === null ? `s.remove('siksamitra.conventions');` : `s.set('siksamitra.conventions', ${JSON.stringify(conventions)});`)
    + 'await new Promise((r) => s.saveAsync(r));',
});
const mantra = (...texts: string[]): Step => ({ lines: texts.map((text) => ({ text, style: 'Mantra' })) });
const caret = (p: number, o = 0): Step => ({ sel: [p, o, p, o] });
const OK: Step = { dialog: 'OK', wait: 600 };
/** A whole-document Re-apply from a caret: asked, answered, reported, answered. */
const reapplyAll = (at: number, label = 'Re-apply rules'): Step[] =>
  [caret(at), { press: label, wait: 2500, still: true }, { dialog: 'Re-apply', wait: 8000 }, OK];

/** A line's text and markings, for comparing. */
const shape = (tm: TextAndMarks) => ({ text: tm.text, marks: marks(tm) });
/** The engine's line, with extra marks of a person's added. */
const withHand = (tm: TextAndMarks, ...hand: string[]) => ({ text: tm.text, marks: [...marks(tm), ...hand].sort() });
/** The part tags in a read, in order. */
const tags = (read: Read): string[] => [...documentPartOf(packageOf(read)).matchAll(/<w:tag w:val="([^"]+)"/g)].map((m) => m[1]!);
const HELD = 'hold:0-1:short';

/* D0: a write into one of HIS lines makes no second style beside his — Word
   matches by name, and ours differed from his (`style-names.ts`). */
if (existsSync(join(DIR, 'his-line.xml'))) {
  const r = drive([
    { unstyle: true }, { xml: 'his-line.xml' }, { sel: [1, 0, 1, -1] }, { press: 'Re-apply rules', wait: 8000 }, { read: true },
  ]);
  check('D0: every step ran', errorsOf(r), []);
  const read = readsOf(r)[0];
  if (read !== undefined) {
    const sheet = stylesPartOf(packageOf(read));
    const named = (re: RegExp) => [...sheet.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>\s*<w:name w:val="([^"]+)"/g)]
      .filter((m) => re.test(m[2]!)).map((m) => m[1]);
    check('D0 one anusvāra style, his', named(/^anusv[aā]ra$/i), ['Anusvara']);
    check('D0 one virāma style, his', named(/^vir[aā]ma$/i).length <= 1, true);
  }
}

/* D1: two registers, a part, hand marks in both, the outside register changed
   under them, the part's changed, a selection across the boundary, a refused
   one, the part dissolved, Word's Undo, and every script there and back. */
{
  const r = drive([
    /* Import styles into a document with none: every one of ours is there after
       it — counted by name, since Word gives `Virāma` the id `Virma`. */
    { unstyle: true }, { press: 'Import styles', wait: 8000, still: true }, { said: 'śikṣāmitra styles are in this document' },
    settle('taittiriya'), mantra(A, B, A, B, C),
    /* 1: lines 1–2 selected, Ṛgveda: a part of their own. */
    { sel: [1, 0, 2, -1] }, { press: 'Ṛgveda', wait: 2500, still: true }, { dialog: 'Mark them', wait: 8000 }, OK, { read: true },
    /* 2: the rest re-marked by the lines-outside register. */
    ...reapplyAll(4), { read: true },
    /* 3: a person's box on the first letter of line 1 (in the part) and line 4 (outside). */
    { sel: [1, 0, 1, 1] }, { press: 'Short' }, { sel: [4, 0, 4, 1] }, { press: 'Short' }, { read: true },
    /* 4: the lines outside every part → Smārta. */
    caret(5), { press: 'Smārta / purāṇic', wait: 2500, still: true }, { dialog: 'Re-mark them', wait: 8000 }, OK, { read: true },
    /* 5: the part → Taittirīya. */
    caret(2), { press: 'Taittirīya', wait: 2500, still: true }, { dialog: 'Re-mark it', wait: 8000 }, OK, { read: true },
    /* 6: a selection across the part's edge: refused, nothing changed. */
    { sel: [2, 3, 3, 4] }, { press: 'Ṛgveda', wait: 2500, still: true }, OK, { read: true },
    /* 7: "mine out" over that selection: each line by ITS OWN rules, the person's boxes there dropped. */
    { sel: [1, 0, 4, -1] }, { press: 'Re-apply, mine out', wait: 8000 }, { read: true },
    /* 8: the part dissolved, the whole document re-applied. */
    caret(1), { press: 'Dissolve this part', wait: 3000, still: true }, OK, ...reapplyAll(1), { read: true },
    /* 9: Word's Undo, once: the whole re-apply taken back. */
    { undo: 1, wait: 1500 }, { read: true },
  ]);
  check('D1: every step ran', errorsOf(r), []);
  const reads = readsOf(r);
  if (reads.length === 9) {
    const [made, rest, hand, outside, part, refused, mineOut, dissolved, undone] = reads.map(lines) as ReturnType<typeof lines>[];
    const at = (ls: ReturnType<typeof lines>, i: number) => shape(ls[i]!.tm);
    check('D1.1 lines selected, Ṛgveda: exactly Ṛgveda', [at(made!, 0), at(made!, 1)], [shape(engine(A, 'rigveda')), shape(engine(B, 'rigveda'))]);
    check('D1.1 and the lines after them untouched', [at(made!, 2), at(made!, 4)], [shape({ text: A, marks: [] }), shape({ text: C, marks: [] })]);
    check('D1.1 and they are ONE part, in Ṛgveda', tags(reads[0]!), ['siksamitra:part:v1:rigveda']);
    check('D1.2 the rest by the outside register: Taittirīya', [at(rest!, 2), at(rest!, 3), at(rest!, 4)],
      [shape(engine(A, 'taittiriya')), shape(engine(B, 'taittiriya')), shape(engine(C, 'taittiriya'))]);
    check('D1.2 and the part is as it was', [at(rest!, 0), at(rest!, 1)], [at(made!, 0), at(made!, 1)]);
    check('D1.3 a person’s box, in the part and outside it', [at(hand!, 0), at(hand!, 3)],
      [withHand(engine(A, 'rigveda'), HELD), withHand(engine(B, 'taittiriya'), HELD)]);
    check('D1.4 outside → Smārta: the outside lines are Smārta, the box kept', [at(outside!, 2), at(outside!, 3), at(outside!, 4)],
      [shape(engine(A, 'smarta')), withHand(engine(B, 'smarta'), HELD), shape(engine(C, 'smarta'))]);
    check('D1.4 and the part keeps Ṛgveda, box and all', [at(outside!, 0), at(outside!, 1)], [at(hand!, 0), at(hand!, 1)]);
    check('D1.5 the part → Taittirīya, its box kept', [at(part!, 0), at(part!, 1)],
      [withHand(engine(A, 'taittiriya'), HELD), shape(engine(B, 'taittiriya'))]);
    check('D1.5 and it is still one part, now Taittirīya', tags(reads[4]!), ['siksamitra:part:v1:taittiriya']);
    check('D1.5 and the outside lines are as they were', [at(part!, 2), at(part!, 3)], [at(outside!, 2), at(outside!, 3)]);
    check('D1.6 across the edge: refused, the document unchanged', refused!.map((l) => shape(l.tm)), part!.map((l) => shape(l.tm)));
    check('D1.7 mine out: each line by its own rules, no box of a person’s left',
      [at(mineOut!, 0), at(mineOut!, 1), at(mineOut!, 2), at(mineOut!, 3)],
      [shape(engine(A, 'taittiriya')), shape(engine(B, 'taittiriya')), shape(engine(A, 'smarta')), shape(engine(B, 'smarta'))]);
    check('D1.7 and the line not selected keeps what it had', at(mineOut!, 4), at(part!, 4));
    check('D1.8 dissolved and re-applied: every line Smārta', dissolved!.filter((l) => l.verse).map((l) => shape(l.tm)),
      [A, B, A, B, C].map((t) => shape(engine(t, 'smarta'))));
    check('D1.8 and no part is left', tags(reads[7]!), []);
    check('D1.9 one Undo takes the whole re-apply back', undone!.filter((l) => l.verse).map((l) => shape(l.tm)),
      mineOut!.filter((l) => l.verse).map((l) => shape(l.tm)));
  }
}

/* D2: the conventions switched under marked text, and back — and a person's
   box surviving every switch. */
{
  const ALL_OFF = { 'nasal-before-nasal': false, 'visarga-before-velar': false, 'vy-aid': true, 'geminate-box': true };
  const r = drive([
    settle('taittiriya'), mantra(C, D, E),
    ...reapplyAll(1), { read: true },
    { sel: [2, 0, 2, 1] }, { press: 'Short' },
    settle('taittiriya', ALL_OFF), ...reapplyAll(3), { read: true },
    settle('taittiriya'), ...reapplyAll(3), { read: true },
  ]);
  check('D2: every step ran', errorsOf(r), []);
  const reads = readsOf(r);
  if (reads.length === 3) {
    const [first, switched, back] = reads.map((x) => lines(x).map((l) => shape(l.tm)));
    check('D2.1 by default: the engine’s default conventions', first, [C, D, E].map((t) => shape(engine(t, 'taittiriya'))));
    check('D2.2 every convention switched: exactly what the engine makes with them, the box kept', switched,
      [shape(engine(C, 'taittiriya', ALL_OFF)), withHand(engine(D, 'taittiriya', ALL_OFF), HELD), shape(engine(E, 'taittiriya', ALL_OFF))]);
    check('D2.2 and it DID change something', JSON.stringify(switched) !== JSON.stringify(first), true);
    check('D2.3 switched back: the defaults again, box kept', back,
      [shape(engine(C, 'taittiriya')), withHand(engine(D, 'taittiriya'), HELD), shape(engine(E, 'taittiriya'))]);
  }
}

/* D3: every script and back, over a part and the lines outside it, marks and
   all — the whole document, then a selection. */
{
  const r = drive([
    settle('smarta'), mantra(A, B, C),
    { sel: [1, 0, 1, -1] }, { press: 'Taittirīya', wait: 2500, still: true }, { dialog: 'Mark them', wait: 8000 }, OK,
    ...reapplyAll(3), { sel: [3, 0, 3, 1] }, { press: 'Short' }, { read: true },
    ...(['Devanāgarī', 'Telugu', 'Tamil', 'IAST'] as const).flatMap((s): Step[] =>
      [caret(2), { press: s, wait: 2500, still: true }, { dialog: 'Write it', wait: 8000 }, OK]),
    { read: true },
    { sel: [2, 0, 3, -1] }, { press: 'Telugu', wait: 6000 }, { read: true },
    { sel: [2, 0, 3, -1] }, { press: 'IAST', wait: 6000 }, { read: true },
  ]);
  check('D3: every step ran', errorsOf(r), []);
  const reads = readsOf(r);
  if (reads.length === 4) {
    const [before, round, telugu, back] = reads.map((x) => lines(x).map((l) => shape(l.tm)));
    const scripts = lines(reads[2]!).map((l) => l.script);
    check('D3.1 marked: the part Taittirīya, outside Smārta, a person’s box', before,
      [shape(engine(A, 'taittiriya')), shape(engine(B, 'smarta')), withHand(engine(C, 'smarta'), HELD)]);
    check('D3.2 IAST → Devanāgarī → Telugu → Tamil → IAST: exactly what was there', round, before);
    check('D3.2 and the part is still there', tags(reads[1]!), ['siksamitra:part:v1:taittiriya']);
    check('D3.3 a selection in Telugu: those lines written in Telugu, the first not', scripts, ['iast', 'tel', 'tel']);
    check('D3.3 and every letter and mark of them carried', telugu, before);
    check('D3.4 and back to IAST: exactly what was there', back, before);
  }
}
