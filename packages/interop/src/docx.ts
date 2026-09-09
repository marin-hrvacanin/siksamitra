/**
 * Word `.docx` — reading and writing the owner's own marked files.
 *
 * Pure TypeScript, so it runs in the browser and in Node alike: a `.docx` is a
 * zip of XML, and `fflate` plus a small reader is the whole dependency. No
 * Python, no native module, no service.
 *
 * RULE ZERO GOVERNS THE IMPORTER. Marks are TRANSCRIBED from the styles he
 * applied, never re-derived. His files contain hand-placed marks the algorithm
 * does not produce, and an importer that "fixed" one would be destroying a
 * decision. The engine may be run afterwards as a COMPARISON, and its
 * disagreements go in the report for a human to rule on.
 *
 * TWO TRAPS, both of which have cost a defect elsewhere and are closed here:
 *   - never sort runs by position. `pdf_import` sorts by x and turns `śuklā̍m`
 *     into `śuklām̍`; document order is correct.
 *   - fold `ꣳ`/`ँ` → `ṁ` at the boundary, or a pre-formed candrabindu slips
 *     past the gum rule and ships with no reading aid.
 *
 * See specs/chant-editor/03-INTEROP.md §2.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type {
  ChantDoc, ChantItem, ChantSection, ChantToken, ChantUnit, ChantVerse,
} from '@siksamitra/format';
import { normalize } from '@siksamitra/engine';
import { parseLetters, isVowel, ANU, CANDRA, VIRAMA_TICK } from '@siksamitra/engine';
import { transliterateSyllable } from '@siksamitra/engine';
import { syllabify } from '@siksamitra/engine';
import {
  BAR_GLYPH, HOLD_CHANGE_ROLES, REFERENCE_COUNTS, SVARA_BY_CHAR, paraRoleOf, roleOf,
  type WordMarkRole, type WordParaRole,
} from './word-styles.js';
import {
  columnEmuOf, figureFromDrawing, relationshipTargets, type DocxDrawing,
} from './docx-figures.js';
import { mergeRuns, readParagraphs, type WordParagraph, type WordRun } from './docx-read.js';

/* The OOXML reader is `docx-read.ts`. Re-exported because it is part of this
   module's published surface — the add-in and two gates read paragraphs. */
export { mergeRuns, readParagraphs } from './docx-read.js';
export type { WordParagraph, WordRun } from './docx-read.js';

/* ==========================================================================
   Import
   ========================================================================== */

export interface ImportReport {
  source: { kind: 'docx'; bytes: number };
  structure: {
    /** Every `<w:p>`, including self-closing empties. */
    paragraphs: number;
    /** Paragraphs with an open/close pair — the convention the reference
     *  counts were taken in. */
    paragraphsWithBody: number;
    runs: number; sections: number; verses: number; syllables: number;
  };
  marks: Record<string, number>;
  byStyle: Record<string, number>;
  byPara: Record<string, number>;
  normalisations: { rule: string; from: string; to: string; count: number }[];
  unresolved: { at: string; what: string; raw: string }[];
}

/** A locus line — "taittirīya saṁhitā 1.5.3", "Ṛgveda 10.90", "TA 3.12". */
const RE_LOCUS = /^[\p{L}\s.'’-]+\s\d+(?:[.,]\d+)*\.?$/u;
/** Prose that tells you to do something. */
const RE_IMPERATIVE = /^(take|offer|ring|sip|place|touch|pour|show|wave|bow|sprinkle|light|put|say|recite|do|repeat|hold)\b/i;

function classifyProse(text: string): 'source' | 'option' | 'do' | 'note' {
  const t = text.trim();
  if (/^optional(ly)?$/i.test(t)) return 'option';
  if (RE_LOCUS.test(t) && t.length < 90) return 'source';
  if (RE_IMPERATIVE.test(t)) return 'do';
  return 'note';
}

/**
 * Build a verse's tokens from one `Translit` paragraph's runs.
 *
 * Letters come from the text; marks come from the STYLES. No rule is run.
 * Consecutive holding runs of the same style form one `hg` group, and a group
 * covering more than one letter is kept but reported: narrowing it needs the
 * same-point test (02A H26), and guessing a host is how boxes end up off by a
 * letter.
 */
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

  const addLetters = (text: string, apply: (u: ChantUnit) => void): void => {
    for (const ch of parseLetters(text)) {
      if (ch === ' ') continue;
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

    if (role === 'dirgha' || role === 'name') {
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

export interface DocxImport {
  doc: ChantDoc;
  report: ImportReport;
  /** The raw paragraphs, so a caller can re-classify without re-unzipping. */
  paragraphs: WordParagraph[];
}

/** Read a `.docx` into a chant document plus a report of everything it did. */
export function importDocx(bytes: Uint8Array, title = 'Imported'): DocxImport {
  /*
   * THE PICTURES COME OUT OF THE ZIP TOO. A `.docx` keeps them in
   * `word/media/`, named from `word/_rels/document.xml.rels`, and reading only
   * `document.xml` is how every picture in an imported manual used to become
   * nothing at all — silently, because a `<w:drawing>` carries no text and a
   * paragraph with no text is a paragraph this reader skips.
   */
  const zip = unzipSync(bytes, {
    filter: (f) => f.name === 'word/document.xml'
      || f.name === 'word/_rels/document.xml.rels'
      || f.name.startsWith('word/media/'),
  });
  const xml = zip['word/document.xml'];
  if (xml === undefined) throw new Error('not a .docx — word/document.xml is missing');

  const documentText = strFromU8(xml);
  const paragraphs = readParagraphs(documentText);
  const rels = zip['word/_rels/document.xml.rels'] === undefined
    ? new Map<string, string>()
    : relationshipTargets(strFromU8(zip['word/_rels/document.xml.rels']));
  const columnEmu = columnEmuOf(documentText);
  let figureN = 0;

  const report: ImportReport = {
    source: { kind: 'docx', bytes: bytes.length },
    structure: {
      paragraphs: paragraphs.length,
      paragraphsWithBody: paragraphs.filter((p) => p.empty !== true).length,
      runs: 0, sections: 0, verses: 0, syllables: 0,
    },
    marks: {},
    byStyle: {},
    byPara: {},
    normalisations: [],
    unresolved: [],
  };

  for (const p of paragraphs) {
    if (p.empty === true) continue; // counted in `paragraphs`, not per style
    const key = p.pStyle ?? 'default';
    report.byPara[key] = (report.byPara[key] ?? 0) + 1;
    for (const r of p.runs) {
      report.structure.runs += 1;
      const sk = r.rStyle ?? 'none';
      report.byStyle[sk] = (report.byStyle[sk] ?? 0) + 1;
    }
  }

  const sections: ChantSection[] = [];
  let part: string | undefined;
  let sectionRef: ChantSection | null = null;
  /** Reading through a call defeats control-flow narrowing: TypeScript cannot
   *  see the closure's assignment and kept narrowing the variable to `null`,
   *  which made every later read `never`. */
  const current = (): ChantSection | null => sectionRef;
  let pendingSource: string | undefined;
  let verseRuns: WordRun[] = [];
  let verseN = 0;

  // Returns the section rather than only assigning it: TypeScript cannot see a
  // closure's assignment, so reads after `if (section === null) newSection()`
  // narrowed to `never`.
  const newSection = (titleText: string, role: WordParaRole): ChantSection => {
    const id = `s-${sections.length + 1}`;
    const made = {
      id,
      n: role === 'step' ? String(sections.length + 1) : undefined,
      title: titleText,
      ...(part !== undefined ? { part } : {}),
      verses: [],
    } as ChantSection;
    sections.push(made);
    sectionRef = made;
    report.structure.sections += 1;
    verseN = 0;
    return made;
  };

  /*
   * THE ORDER OF A SECTION'S CONTENTS, kept as it is read.
   *
   * `ChantSection` carries both `verses` and `items`, and `itemsOf` prefers
   * `items` whenever it is not empty — so a section that put ONE thing in
   * `items` and its verses in `verses` drew that one thing and nothing else.
   * That was already happening: a step beginning with a direction and then a
   * mantra came back as the direction alone. Recorded here by reference and
   * materialised at the end, so a verse that gains a translation or an
   * instruction after it was recorded still goes in carrying it.
   */
  type Entry = { verse: ChantVerse } | { item: ChantItem };
  const order = new Map<string, Entry[]>();
  const entries = (sec: ChantSection): Entry[] => {
    const found = order.get(sec.id);
    if (found !== undefined) return found;
    const made: Entry[] = [];
    order.set(sec.id, made);
    return made;
  };

  /** One picture out of the zip, as an item of the step being read. */
  const addFigure = (drawing: DocxDrawing): void => {
    const sec = current() ?? newSection(title, 'section');
    const target = rels.get(drawing.relId);
    const part = target === undefined ? undefined : `word/${target.replace(/^\.?\//u, '')}`;
    const media = part === undefined ? undefined : zip[part];
    if (part === undefined || media === undefined) {
      report.unresolved.push({
        at: sec.id, what: 'a picture whose bytes are not in the file', raw: drawing.relId,
      });
      return;
    }
    figureN += 1;
    const figure = figureFromDrawing(drawing, part, media, `fig-${figureN}`, columnEmu);
    if (figure === null) {
      figureN -= 1;
      report.unresolved.push({
        at: sec.id,
        what: 'a picture in a format a document may not carry '
          + '(.emf and .wmf are the two Word writes)',
        raw: part,
      });
      return;
    }
    entries(sec).push({ item: { t: 'figure', figure } });
  };

  /**
   * A `Caption` paragraph belongs to the picture above it.
   *
   * Word's own style, which is what we write and what a person using Word gets
   * from Insert ▸ Caption. Without this the caption came back as a direction —
   * a step with one picture read as picture, note, picture, note — because a
   * caption is prose and `classifyProse` has no way to know better.
   */
  const addCaption = (text: string): void => {
    const list = order.get(current()?.id ?? '') ?? [];
    const last = list[list.length - 1];
    if (last === undefined || !('item' in last) || last.item.t !== 'figure') return;
    const figure = last.item.figure;
    if (figure === undefined || text === '') return;
    list[list.length - 1] = { item: { t: 'figure', figure: { ...figure, caption: { en: text } } } };
  };

  const closeVerse = (): void => {
    if (verseRuns.length === 0) return;
    const sec: ChantSection = current() ?? newSection(title, 'section');
    verseN += 1;
    const where = `${sec.id}/v-${verseN}`;
    const tokens = tokensFromRuns(verseRuns, report, where);
    verseRuns = [];
    if (tokens.length === 0) return;
    const verse: ChantVerse = {
      id: `${sec.id}-v${verseN}`,
      n: String(verseN),
      tokens,
      ...(pendingSource !== undefined ? { source: pendingSource } : {}),
    };
    pendingSource = undefined;
    sec.verses.push(verse);
    entries(sec).push({ verse });
    report.structure.verses += 1;
  };

  for (const p of paragraphs) {
    const role = paraRoleOf(p.pStyle);
    const text = p.runs.map((r) => r.text).join('').trim();

    /* A picture stands where its paragraph stands, so it is taken before the
       paragraph is classified — a `<w:drawing>` carries no text, and a
       paragraph with no text is one this reader would otherwise skip. */
    if (p.drawings !== undefined) {
      closeVerse();
      for (const d of p.drawings) addFigure(d);
    }

    if (role === 'drop') continue;

    if (role === 'part') {
      closeVerse();
      part = text;
      sectionRef = null;
      continue;
    }
    if (role === 'section' || role === 'step') {
      closeVerse();
      if (text !== '') newSection(text, role);
      continue;
    }
    if (role === 'verse-line') {
      // Consecutive Translit paragraphs are one verse until a daṇḍa + number
      // closes it — the same grouping the PDF path uses.
      verseRuns.push(...p.runs, { text: '\n', rStyle: null, superscript: false });
      if (/[।॥]\s*\d*\s*[।॥]?\s*$/.test(text)) closeVerse();
      continue;
    }
    if (role === 'translation') {
      const sec = current();
      const last = sec === null ? undefined : sec.verses[sec.verses.length - 1];
      if (last !== undefined && text !== '') {
        last.translation = {
          en: last.translation?.en === undefined ? text : `${last.translation.en} ${text}`,
        };
      }
      continue;
    }
    if (role === 'caption') {
      addCaption(text);
      continue;
    }
    if (role === 'insert') {
      report.unresolved.push({
        at: current()?.id ?? 'doc',
        what: 'the "Insert" paragraph style has no home in the format yet (00 §5.1)',
        raw: text.slice(0, 120),
      });
      continue;
    }
    // Prose: a locus, an option, a direction, or a note.
    if (text === '') continue;
    const kind = classifyProse(text);
    const sec = current();
    if (kind === 'source') {
      if (sec !== null && sec.verses.length === 0) sec.source = text;
      else pendingSource = text;
    } else if (sec !== null) {
      const instr = {
        kind: kind === 'option' ? ('option' as const)
          : kind === 'do' ? ('do' as const) : ('note' as const),
        text: { en: text },
      };
      const last = sec.verses[sec.verses.length - 1];
      if (last !== undefined) last.instructions = [...(last.instructions ?? []), instr];
      else entries(sec).push({ item: { t: 'instruction', instruction: instr } });
    }
  }
  closeVerse();

  const norm = normalize(paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
  report.normalisations = norm.changes;

  /* Materialised last, so a verse goes in carrying whatever it gained after it
     was recorded. A section with nothing but verses is left with no `items` at
     all, which is the shape `itemsOf` reads as "the verses, in order". */
  const withItems = sections.map((s) => {
    const list = order.get(s.id) ?? [];
    if (!list.some((e) => 'item' in e)) return s;
    return {
      ...s,
      items: list.map((e) => ('item' in e ? e.item : { t: 'verse' as const, ...e.verse })),
    };
  });

  const doc: ChantDoc = {
    title,
    titleForms: { iast: title },
    sections: withItems.filter((s) => s.verses.length > 0 || (s.items?.length ?? 0) > 0),
    version: 3,
  };
  return { doc, report, paragraphs };
}

export { REFERENCE_COUNTS };
