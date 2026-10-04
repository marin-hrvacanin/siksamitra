/**
 * THE PROOF — the document read as the person will read it, and what a
 * proofreader finds in it that no letter check can.
 *
 * The letter check holds each verse to the lines it was built from; it
 * cannot see that the lines themselves are wrong for the page. A real run
 * (sūryāṣṭottaraśatanāma stotram, 2026-10-02) passed every check and was
 * sent with a verse left in Devanāgarī, a `॥ 15॥` and a variant inside a
 * verse, and a word from another edition hung on the end of a half-verse —
 * all of which a person sees at a glance, and none of which the agent saw,
 * because it never read its own document whole. So the program reads it:
 *
 *   `proofOf`   the whole document, page order, a line for each thing on it —
 *               what the agent and the reviewer read before they say it is done;
 *   `proofread` what is wrong on it, each with what to do: letters of another
 *               script; a double daṇḍa with the words of another verse after
 *               it on its line; in a śloka text, a half-verse outside its
 *               verse's metre; names numbered out of order.
 *
 * Every finding is something a reader produces from the page (CLAUDE.md rule
 * 9), and none of them fires on his own documents: `proof.test.ts` holds them
 * to his library, where a first draft found 403 things — his śāntis and
 * dhyānas set twice, the Vedic metres, "ṛṣir uvāca", a closing "॥ oṁ ॥".
 */
import { toTextAndMarks, type ChantDoc, type ChantSection, type ChantVerse } from '@siksamitra/format';
import { syllablesOf } from './lines.js';
import { verseLetters } from './workspace.js';

export interface Finding {
  readonly severity: 'error' | 'warn';
  readonly where: string;
  readonly what: string;
}

/*
 * LETTERS THAT ARE NO IAST'S. The document is IAST throughout — every other
 * script is drawn from it — so a Devanāgarī letter or sign in a verse (the
 * daṇḍas aside, which IAST uses too), another Indic script, the Vedic
 * extensions, a dotted circle or a replacement character is a letter that
 * came in unread.
 */
const FOREIGN = /[\u{0900}-\u{0963}\u{0966}-\u{097F}\u{0980}-\u{0DFF}\u{1CD0}-\u{1CFF}\u{A8E0}-\u{A8FF}\u{25CC}\u{FFFD}]/u;

/** A verse's mantra as printed: its letters, its svaras, its number. */
const mantraOf = (v: ChantVerse): string => verseLetters(v, { prose: false });

/**
 * Its syllables per half-verse — the text between its daṇḍas — as a metre is
 * counted: a speaker's line before it ("ṛṣir uvāca", "vaiśampāyana uvāca"),
 * and an oṁ or two standing alone, are no half of the verse.
 */
function halves(v: ChantVerse): number[] {
  const text = mantraOf(v).replace(/[0-9०-९]/gu, ' ').replace(/[()]/gu, ' ');
  const parts = text.split(/[।॥]/u).filter((p) => syllablesOf(p) > 0);
  const speaker = parts.length > 1 && (syllablesOf(parts[0]!) <= 7 || /uvāca\s*$/u.test(parts[0]!.normalize('NFC').replace(/[\u{0300}-\u{036F}]/gu, '')));
  return (speaker ? parts.slice(1) : parts).map(syllablesOf).filter((n) => n > 3);
}

/** A verse that is no śloka — a colophon (`॥ iti śrī mārkaṇḍeya purāṇe …`), an anukramaṇī, a litany — is held to no metre. */
const prose = (v: ChantVerse, h: readonly number[]): boolean =>
  h.length > 4 || /^[\s।॥]*iti\b/u.test(mantraOf(v).normalize('NFC').replace(/[\u{0300}-\u{036F}]/gu, ''));

/** The commonest half-verse length of a section, and how many of its halves are within a syllable of it. */
function metreOf(lengths: readonly number[]): { length: number; share: number } | null {
  if (lengths.length === 0) return null;
  const counts = new Map<number, number>();
  for (const n of lengths) counts.set(n, (counts.get(n) ?? 0) + 1);
  const [length] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
  const near = lengths.filter((n) => Math.abs(n - length) <= 1).length;
  return { length, share: near / lengths.length };
}

/*
 * A DOUBLE DAṆḌA WITH ANOTHER VERSE'S WORDS AFTER IT, ON ITS LINE — the
 * source's `॥ १५॥ प्रोक्तमेतत्…`, its next verse or a variant printed after
 * the number. His own pages close a line with one and go on in the next
 * (`…catu̍ṣ pade ॥` / `oṁ śāntiś…`), and end a line `॥ oṁ ॥`: neither is it.
 */
const INNER_END = /\p{L}\p{M}*[\s'’ˎ।]*॥[\s0-9०-९।॥]*([^\s0-9०-९।॥][^\n]*)$/u;
const innerEnd = (line: string): string | null => {
  const m = INNER_END.exec(line);
  if (m === null) return null;
  const after = m[1]!.replace(/[।॥|\s0-9०-९]+$/u, '');
  return syllablesOf(after) >= 2 && !/^o[mṁṃ]$/u.test(after.normalize('NFD').replace(/\p{M}/gu, '')) ? after : null;
};

/** A name's number, raised after it (`sup`), as his Lalitā sahasranāma counts its names. */
const NAME_NUMBER = /^[0-9]+$/u;

export interface ProofOptions {
  /** The verses the agent says the edition itself has outside their metre. */
  readonly irregular?: (verse: string) => boolean;
  /**
   * Whether a section is of ślokas whose metre is strict — the purāṇic and the
   * stotras' (`smarta`). A Vedic metre is not: his rudram has a half of 19 among
   * its 16s, his śiva saṅkalpa one of 19 among its 22s.
   */
  readonly strictMetre?: (section: ChantSection) => boolean;
}

/** What a proofreader finds on the page of a document built here — an author's own text is not read for it. */
export function proofread(doc: ChantDoc, o: ProofOptions = {}): Finding[] {
  const out: Finding[] = [];
  for (const [where, text] of [['title', doc.title], ...doc.sections.map((s) => [s.id, s.title ?? ''] as const)] as const) {
    if (FOREIGN.test(text)) out.push({ severity: 'error', where, what: `"${text}" has letters of another script: a heading is IAST, as his are` });
  }
  let names = 0;
  for (const s of doc.sections) {
    /* A section's metre: what most of its halves are, over three verses or more. */
    const all = s.verses.map(halves);
    const verse = s.verses.map((v, i) => !prose(v, all[i]!));
    const metre = s.verses.length >= 3 && o.strictMetre?.(s) === true ? metreOf(all.filter((_, i) => verse[i]).flat()) : null;
    /* Which of its ślokas the rules gave svaras: in a stotra they mark all, or none. */
    const accented = s.verses.map((v) => toTextAndMarks(v).marks.some((m) => m.k === 'svara'));
    const regular = (i: number): boolean => metre !== null && verse[i] === true && all[i]!.length >= 2
      && all[i]!.every((n) => Math.abs(n - metre.length) <= 1);
    const ślokas = s.verses.map((_, i) => i).filter(regular);
    const marksŚlokas = ślokas.length >= 3 && ślokas.filter((i) => accented[i]).length / ślokas.length >= 0.6;
    s.verses.forEach((v, i) => {
      const text = mantraOf(v);
      const foreign = FOREIGN.exec(text);
      if (foreign !== null) {
        const at = Math.max(0, foreign.index - 12);
        out.push({
          severity: 'error', where: v.id,
          what: `letters of another script in an IAST verse ("…${text.slice(at, foreign.index + 12).replace(/\n/gu, ' / ')}…"): `
            + 'build the verse from its witness — the program reads Devanāgarī into IAST — never type it in another script',
        });
      }
      /* Said, not refused: his own pages close a chapter's last verse with its
         dedication on the same line (`… ॥ 56॥ śrī jagadambārpaṇamastu ॥`). */
      for (const line of text.split('\n')) {
        const after = innerEnd(line);
        if (after === null) continue;
        out.push({
          severity: 'warn', where: v.id,
          what: `a double daṇḍa inside the verse, with "${after.slice(0, 40)}" after it on its line — if those words are no part of the text `
            + '(the source\'s next verse, a variant or a note it printed after the number), leave them out of spaced',
        });
        break;
      }
      /* A HALF-VERSE OUTSIDE ITS VERSE'S METRE. A verse whose halves are the
         section's metre but for one is a verse with something in it that is
         not the verse: `…tamonudaḥ । kālādhyakṣaḥ` — another edition's name
         printed after the line. A verse wholly in another metre (a dhyāna in
         puṣpitāgrā among ślokas) is regular in itself, and nothing is said. */
      const h = all[i]!;
      if (metre !== null && metre.share >= 0.6 && verse[i] === true && h.length >= 2 && o.irregular?.(v.id) !== true
        && h.some((n) => Math.abs(n - metre.length) <= 1) && h.some((n) => Math.abs(n - metre.length) > 2)) {
        out.push({
          severity: 'error', where: v.id,
          what: `does not scan as its section does (${metre.length} syllables a half-verse): its halves have ${h.join(' · ')} — `
            + 'words that are not the verse are in it, a variant or a name the source printed beside the line: leave them out of spaced '
            + '(the program allows whole words of the source to be left out, and lists them); if the edition truly has the verse so, say irregular: true',
        });
      }
      /* A ŚLOKA LEFT BARE among marked ones: the rules mark a śloka a
         half-verse a line, and one whose half-verse is set in two lines does
         not scan for them — so it is the only verse of its stotra with no
         svara (a real run's verse 15, 2026-10-02). A verse the edition itself
         has outside its metre (`irregular`) cannot be planned by the metre's
         positions, and its bare lines are no fault of the setting — his Viṣṇu
         sahasranāma 54 and 92, the edition's seventeen-syllable ārṣa
         half-verses (2026-10-04). */
      if (marksŚlokas && regular(i) && !accented[i] && o.irregular?.(v.id) !== true) {
        const lines = text.split('\n').map((l) => syllablesOf(l.replace(/[0-9०-९]/gu, ' '))).filter((n) => n > 0);
        out.push({
          severity: 'error', where: v.id,
          what: `has no svara where the section's other ślokas have theirs: the rules mark a śloka a half-verse a line, and its lines have ${lines.join(' · ')} syllables — `
            + 'give each half-verse its own line in spaced, and a speaker\'s line ("vaiśampāyana uvāca") a verse of its own',
        });
      }
      for (const m of toTextAndMarks(v).marks) {
        if (m.k !== 'sup' || m.v === undefined || !NAME_NUMBER.test(m.v)) continue;
        names += 1;
        if (Number(m.v) !== names) {
          out.push({ severity: 'error', where: v.id, what: `its name numbered ${m.v} follows name ${names - 1}: the names are counted from 1, one by one` });
          names = Number(m.v);
        }
      }
    });
  }
  return out;
}

/** A translation's first words, for the proof. */
const gist = (s: string, n = 70): string => {
  const t = s.replace(/\s+/gu, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
};

/**
 * THE DOCUMENT AS IT WILL PRINT, a line for each thing on the page: its name,
 * its tradition, each heading and source line, each verse's note and lines as
 * printed — with its number and its names' numbers — and the first words of
 * each translation. What a person reading the PDF reads, without the look:
 * the agent reads this before it says a document is done, and the reviewer is
 * handed it. `from`/`count`: which verses, for a long document.
 */
export function proofOf(doc: ChantDoc, from = 1, count = 80): string {
  const out: string[] = [`“${doc.title}”${doc.subtitle === undefined ? '' : ` — ${doc.subtitle}`}`];
  if (typeof doc.source === 'string' && doc.source.trim() !== '') out.push(`  source: ${doc.source}`);
  let k = 0;
  let shown = 0;
  const total = doc.sections.reduce((n, s) => n + s.verses.length, 0);
  for (const s of doc.sections) {
    const head = [s.part, s.title].filter((x) => typeof x === 'string' && x.trim() !== '').join(' › ');
    let said = false;
    const heading = (): void => {
      if (said) return;
      said = true;
      out.push(`§ ${s.id}${head === '' ? '' : ` ${head}`}${typeof s.source === 'string' && s.source.trim() !== '' ? ` · source: ${s.source}` : ''}`);
    };
    for (const v of s.verses) {
      k += 1;
      if (k < from || shown >= count) continue;
      heading();
      shown += 1;
      if (typeof v.source === 'string' && v.source.trim() !== '') out.push(`  ${' '.repeat(9)} note: ${v.source.trim().replace(/\n/gu, ' / ')}`);
      const lines = verseLetters(v, { prose: false, names: true }).split('\n');
      lines.forEach((l, i) => out.push(`  ${i === 0 ? v.id.padEnd(9) : ' '.repeat(9)} ${l}`));
      if (v.translation?.en !== undefined && v.translation.en.trim() !== '') out.push(`  ${' '.repeat(9)} — ${gist(v.translation.en)}`);
    }
    if (s.verses.length === 0 && k >= from && shown < count) heading();
  }
  if (shown < total - (from - 1)) out.push(`… verses ${from + shown}-${total} follow: proof with from: ${from + shown}`);
  return out.join('\n');
}
