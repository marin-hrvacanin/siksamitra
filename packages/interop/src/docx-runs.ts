/**
 * ONE PARAGRAPH'S RUNS -> THE TOKENS OF A MANTRA LINE.
 *
 * The transcribing half of the `.docx` importer, and the biggest single thing
 * it does. Out of `docx.ts` because that file is the ZIP and the STRUCTURE —
 * which parts a package has, which paragraph is a heading, which is a verse —
 * and this is the marking: a Word run carries one character style, and what
 * that style means is what the owner's own file says it means.
 *
 * RULE ZERO GOVERNS IT. Marks are TRANSCRIBED from the styles he applied,
 * never re-derived. His files contain hand-placed marks the algorithm does not
 * produce, and an importer that "fixed" one would be destroying a decision.
 *
 * TWO TRAPS, both of which have cost a defect and are closed here:
 *   - never sort runs by position. Sorting by x turns `suklā~m` into `sukām~`;
 *     document order is correct.
 *   - a space inside a STYLED run is still a space. See `space` below: this
 *     threw one away, and a holding that spans a space is written with the
 *     space inside it on purpose.
 *
 * It is also what the Word ADD-IN reads a paragraph with, through
 * `apps/word-addin/src/model/paragraph.ts` — so a paragraph marked in Word and
 * the same paragraph imported from a file cannot disagree.
 */
import type { ChantToken, ChantUnit } from '@siksamitra/format';
import { parseLetters, isVowel, ANU, CANDRA, VIRAMA_TICK } from '@siksamitra/engine';
import { transliterateSyllable } from '@siksamitra/engine';
import { syllabify } from '@siksamitra/engine';
import {
  BAR_GLYPH, HOLD_CHANGE_ROLES, SVARA_BY_CHAR, roleOf,
  type WordMarkRole,
} from './word-styles.js';
import { mergeRuns, type WordRun } from './docx-read.js';
import type { ImportReport } from './docx-report.js';

export function tokensFromRuns(
  runs: WordRun[],
  report: ImportReport,
  where: string,
): ChantToken[] {
  const merged = mergeRuns(runs);
  const tokens: ChantToken[] = [];
  /** Letters of the current word, with their marks. */
  let word: ChantUnit[] = [];
  let hg = 0;
  let holdRun: { role: WordMarkRole; id: number } | null = null;
  /**
   * A svarabhakti dot waiting for its letter.
   *
   * The `Svara` style covers more than the accents in his file: it also styles
   * the epenthetic dot (MARKING-RULES §1) — and the dot is written BEFORE the
   * letter it belongs to, so it cannot be attached on sight. Dropping these
   * silently is why 33 of his 4677 Svara runs looked unread.
   */
  let pendingSbhakti = false;

  const flush = (): void => {
    if (word.length === 0) return;
    // One nucleus per syllable, the same definition the engine uses.
    const fake = word.map((u) => ({
      kind: 'letter' as const, ch: u.c, src: { line: 0, start: 0, end: 0 },
      word: 0, line: 0, vowel: isVowel(u.c), cons: !isVowel(u.c),
    }));
    const groups = syllabify(fake as never);
    let at = 0;
    for (const g of groups) {
      const units = word.slice(at, at + g.length);
      at += g.length;
      if (units.length === 0) continue;
      const iast = units.map((u) => u.c).join('');
      const su = units.map((u) => ({ c: u.c, ...(u.candra === true ? { candra: true } : {}) }));
      tokens.push({
        t: 'syl',
        units,
        iast,
        deva: transliterateSyllable(su, 'deva'),
        tel: transliterateSyllable(su, 'tel'),
        tam: transliterateSyllable(su, 'tam'),
      });
      report.structure.syllables += 1;
    }
    word = [];
  };

  /**
   * The letter a combining mark belongs to — the one before it.
   *
   * That letter is usually still in `word`, but not always: a space or a daṇḍa
   * flushes the word into a syllable, and a `Svara` run can follow. Looking
   * only at `word` dropped those marks — 24 of his svaras — so fall back to the
   * last unit already emitted.
   */
  const lastUnit = (): ChantUnit | undefined => {
    const inWord = word[word.length - 1];
    if (inWord !== undefined) return inWord;
    for (let k = tokens.length - 1; k >= 0; k -= 1) {
      const tk = tokens[k]!;
      if (tk.t === 'syl' && tk.units.length > 0) return tk.units[tk.units.length - 1];
      if (tk.t !== 'sp') break; // a real token between them means it is not adjacent
    }
    return undefined;
  };

  /**
   * A space inside a STYLED run is still a space.
   *
   * THE FAULT. This read `if (ch === ' ') continue` — it threw the space away
   * — and only the plain-text branch below turned whitespace into an `sp`
   * token. But a holding that spans a space is written as a `Holding` run
   * containing that space, ON PURPOSE: two adjacent runs with identical
   * borders draw inside ONE set of borders (ECMA-376 17.3.2.4), and an
   * unstyled space in the middle would close the box and open a second one.
   * `bridging` in `word/body.ts` exists to give the space the group's style
   * for exactly that reason.
   *
   * So the writer wrote `oṁ agnim īḷe puraḥ` boxed as seven runs, and the
   * reader gave back `oṁagnimīḷepuraḥ`. Every space under a box, gone. In the
   * Word add-in that is not a display problem — the pane reads the paragraph,
   * applies a marking and WRITES IT BACK, so pressing a second button on a
   * boxed phrase deleted the spaces out of the person's own document. In
   * `importDocx` it ran the words of his own files together.
   *
   * Handled here rather than in every caller because all four styled branches
   * — holdings, substitutions, the dīrgha style, the gum fallback — go through
   * this one function.
   */
  const space = (piece: string): void => {
    flush();
    /* A newline is a LINE, not a space — the same rule as the plain branch. */
    if (/\n/.test(piece)) {
      while (tokens.length > 0 && tokens[tokens.length - 1]!.t === 'sp') tokens.pop();
      if (tokens.length > 0 && tokens[tokens.length - 1]!.t !== 'br') tokens.push({ t: 'br' });
      return;
    }
    const last = tokens[tokens.length - 1];
    if (last !== undefined && last.t !== 'sp' && last.t !== 'br') tokens.push({ t: 'sp' });
  };

  const addLetters = (text: string, apply: (u: ChantUnit) => void): void => {
    for (const ch of parseLetters(text)) {
      if (/^\s+$/.test(ch)) { space(ch); continue; }
      const u: ChantUnit = { c: ch };
      if (pendingSbhakti) {
        u.sbhakti = true;
        pendingSbhakti = false;
        report.marks['sbhakti'] = (report.marks['sbhakti'] ?? 0) + 1;
      }
      if (ch.startsWith('m' + CANDRA)) {
        u.c = 'm';
        u.candra = true;
        const tail = ch.slice(2);
        if (tail !== '') u.sup = tail;
      }
      apply(u);
      word.push(u);
    }
  };

  for (const run of merged) {
    const role = roleOf(run.rStyle);
    const bump = (k: string) => { report.marks[k] = (report.marks[k] ?? 0) + 1; };

    if (role === 'svara') {
      // The run's combining marks ARE the accent; each attaches to the letter
      // before it, which is the last letter already emitted.
      for (const ch of run.text) {
        const svara = SVARA_BY_CHAR.get(ch);
        const host = lastUnit();
        if (svara !== undefined && host !== undefined) {
          host.svara = svara;
          bump('svara');
        } else if (ch === VIRAMA_TICK) {
          word.push({ c: VIRAMA_TICK });
          bump('virama');
        } else if (ch === '·') {
          pendingSbhakti = true;
        } else if (ch.trim() !== '') {
          addLetters(ch, () => {});
        }
      }
      continue;
    }

    if (role === 'virama') {
      word.push({ c: VIRAMA_TICK });
      bump('virama');
      continue;
    }

    if (role === 'pause') {
      flush();
      /* A BAR AND A SHORT PAUSE ARE DIFFERENT TOKENS and were written with the
         same pipe in the same style, so every one of the corpus's 59 bars came
         back from a round trip as a pause. `BAR_GLYPH` is what the exporter
         writes now; his own files contain no bar, so nothing of his changes. */
      const bars = (run.text.split(BAR_GLYPH).length - 1);
      const pipes = (run.text.match(/\|/g) ?? []).length;
      if (bars > 0 || pipes > 0) {
        if (tokens.length > 0 && tokens[tokens.length - 1]!.t !== 'sp') tokens.push({ t: 'sp' });
        if (bars > 0) {
          for (let k = 0; k < bars; k += 1) tokens.push({ t: 'bar' });
          bump('bar');
        } else {
          tokens.push({ t: 'pause', len: pipes >= 2 ? 'long' : 'short' });
          bump('pause');
        }
      }
      continue;
    }

    if (role === 'comment') {
      // An inline comment inside a mantra line is an annotation, never
      // recitable text: it leaves the token stream entirely.
      bump('comment');
      report.unresolved.push({ at: where, what: 'inline comment', raw: run.text.trim() });
      continue;
    }

    /*
     * A LITTLE SUPERSCRIPTED COUNTING NUMBER — his `Name` and `Nma`, and our
     * own `Reference`.
     *
     * IT USED TO BE LOST. Both of his styles were read as a role called
     * `name`, which "has no home in the format yet", and the letters were
     * added to the mantra as ordinary text — so a document that counted
     * something inside its ślokas imported with the counting numbers spliced
     * into the recitation. The format has had a home for it all along: `sup`,
     * "a superscript after the range", which is what this program's own
     * exporter writes and what the page draws as `<sup>`.
     *
     * IT LANDS ON THE LETTER BEFORE IT, because that is what `sup` means. A
     * marker with nothing before it — a run at the very start of a line — has
     * no letter to belong to, and is reported rather than guessed at.
     */
    if (role === 'reference') {
      bump('reference');
      const host = lastUnit();
      const text = run.text.trim();
      if (host === undefined || text === '') {
        report.unresolved.push({
          at: where,
          what: `a "${run.rStyle ?? ''}" marker with no letter before it`,
          raw: run.text.trim(),
        });
        continue;
      }
      /* Appended, not replaced: two marker runs in a row are one marker. */
      host.sup = (host.sup ?? '') + text;
      continue;
    }

    if (role === 'dirgha') {
      bump(role);
      report.unresolved.push({
        at: where,
        what: `the "${run.rStyle ?? ''}" style has no home in the format yet (00 §5.1)`,
        raw: run.text.trim(),
      });
      addLetters(run.text, () => {});
      continue;
    }

    if (role === 'gum') {
      /*
       * base `m` + candra, and the g-run that follows is the reading aid.
       *
       * `change` IS SET, and it is his file that says so: `VedicAnusvara` is
       * basedOn `Anusvara` and carries its blue, which on his page means the
       * letter actually recited. Our own exporter does not use this style — a
       * candrabindu is a CHARACTER, so a gum letter is written in whichever
       * style its other marks call for and the candra rides in the text. That
       * is what the page does too: `is-change` colours a letter, `u.candra`
       * does not.
       */
      const g = /^([g]{1,2}ṁ?|ṁ)/.exec(run.text.replace(/^m?̐?/, ''));
      const host = lastUnit();
      if (host !== undefined && (host.c === 'm' || host.c === ANU)) {
        host.c = 'm';
        host.candra = true;
        host.change = true;
        if (g !== null) host.sup = g[1];
      } else {
        addLetters('m' + CANDRA + (g?.[1] ?? ''), (u) => { u.change = true; });
      }
      bump('gum');
      continue;
    }

    if (role === 'change') {
      if (run.superscript) {
        const host = lastUnit();
        if (host !== undefined) {
          /*
           * A RAISED AID IS NOT A SUBSTITUTION. The `Anusvara` style carries
           * both — the letter actually recited, and the small letter printed
           * above one — and only the second is raised. Setting `change` here as
           * well put a substitution on 104 letters across 79 verses that the
           * exporter never marked, which a round trip over all 573 corpus
           * verses reported as marks gained out of nowhere.
           */
          host.sup = (host.sup ?? '') + run.text.trim();
          bump('sup');
          continue;
        }
      }
      // Per LETTER, not per run: the exporter emits one run per letter, so
      // counting runs made a round trip look like it had gained marks.
      addLetters(run.text, (u) => { u.change = true; bump('change'); });
      continue;
    }

    if (role === 'hold-short' || role === 'hold-long'
      || role === 'hold-short-change' || role === 'hold-long-change') {
      /* A held letter that is ALSO a substitution comes back as both. See
         `word-styles.ts`: one run carries one character style, so the pairing
         has a style of its own rather than losing one of its two marks. */
      const alsoChange = HOLD_CHANGE_ROLES.has(role);
      const long = role === 'hold-long' || role === 'hold-long-change';
      // A new holding run opens a group; a run of the same style immediately
      // after it continues the same box.
      if (holdRun === null || holdRun.role !== role) {
        hg += 1;
        holdRun = { role, id: hg };
      }
      const id = holdRun.id;
      const before = word.length;
      addLetters(run.text, (u) => {
        u.hold = long ? 'long' : 'short';
        u.hg = id;
        if (alsoChange) u.change = true;
      });
      const covered = word.length - before;
      const counted: WordMarkRole = long ? 'hold-long' : 'hold-short';
      for (let k = 0; k < covered; k += 1) bump(counted);
      if (covered > 1) {
        report.unresolved.push({
          at: where,
          what: `a holding box covers ${covered} letters — narrowing needs the same-point test (02A H26)`,
          raw: run.text,
        });
      }
      continue;
    }

    // Plain text: letters, spaces, daṇḍas, verse numbers.
    holdRun = null;
    for (const piece of run.text.split(/(\s+|।|॥)/)) {
      if (piece === '') continue;
      if (/^\s+$/.test(piece)) {
        flush();
        /*
         * A NEWLINE IS A LINE, NOT A SPACE. `readParagraphs` writes `<w:br/>`
         * as a newline and `importDocx` puts one between consecutive `Translit`
         * paragraphs, so both ways a verse is broken into pādas arrive here —
         * and reading them as spaces ran every verse together onto one line.
         */
        if (piece.includes('\n')) {
          while (tokens.length > 0 && tokens[tokens.length - 1]!.t === 'sp') tokens.pop();
          if (tokens.length > 0 && tokens[tokens.length - 1]!.t !== 'br') tokens.push({ t: 'br' });
          continue;
        }
        const last = tokens[tokens.length - 1];
        if (last !== undefined && last.t !== 'sp' && last.t !== 'br') tokens.push({ t: 'sp' });
        continue;
      }
      if (piece === '।' || piece === '॥') {
        flush();
        /* NO SPACE IS INVENTED HERE. A space around a daṇḍa arrives as its own
           whitespace piece above; adding one on each side as well turned `॥1॥`
           into `॥ 1 ॥` on the way back out, so a Word round trip was never
           byte-exact even when every mark survived it. */
        tokens.push({ t: 'danda', s: piece });
        continue;
      }
      const num = /^\d+(?:[.,]\d+)*$/.exec(piece);
      if (num !== null) {
        flush();
        tokens.push({ t: 'num', s: piece });
        continue;
      }
      addLetters(piece, () => {});
    }
  }
  flush();
  while (tokens.length > 0 && ['sp', 'br'].includes(tokens[tokens.length - 1]!.t)) tokens.pop();
  return tokens;
}
