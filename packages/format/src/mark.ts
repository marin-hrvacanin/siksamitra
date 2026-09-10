/**
 * A MARKING, AND THE ARITHMETIC OF A LIST OF THEM.
 *
 * A verse is one text and a list of markings over it. This file is the second
 * half: what a marking is, and every operation that may be performed on a list
 * of them. It is pure — no engine, no renderer, no document — because the
 * editor, the rules, the importers and the command line all move markings
 * around and there must be exactly one set of rules for how.
 *
 * WHY A RANGE AND NOT A LETTER. A holding covers what was selected, which may
 * be one letter, eleven letters, or two words and the space between them. Held
 * as a property of each letter it is eleven facts that can disagree; held as a
 * range it is one fact. It is also what makes a marking behave like bold, which
 * is the behaviour the owner asked for: select, apply, apply again to remove,
 * apply to a subset to remove only that.
 *
 * WHY OFFSETS AND NOT LETTER IDS. An id per letter never needs rebasing and
 * costs an object per letter — which is 45% of the 6.56 MB this model exists to
 * escape. Offsets are two integers and the rebasing is `shiftForEdit` below.
 *
 * THE INVARIANTS ARE CHECKED, NOT HOPED FOR. `assertMarks` runs after every
 * operation. A list that overlaps itself draws two boxes over one letter, and a
 * list that runs past its text draws nothing at all — both are silent, and both
 * are the kind of fault that is found in a printed PDF weeks later.
 */

/** The passes that produce markings. A pass is re-run as a unit. */
export type Stage = 'sandhi' | 'change' | 'holdings' | 'svara' | 'aids';

export type MarkKind =
  /**
   * This range was typed as `v`, and a rule replaced it with what is there.
   *
   * The text holds what is SHOWN — `n` where an anusvāra was — and this mark
   * carries what it was. That direction rather than the other because the
   * editing surface is Lexical and a flat text run is what makes its selection
   * work: the DOM's text is the model's text, so there is no showing `n` over a
   * stored `ṁ`. Nothing is lost by it — stripping the markings replaces each
   * range by its value and recovers the typed text exactly, with no lookup
   * table and no guess, which is the whole reason the mark exists.
   */
  | 'was'
  /** A holding box. `v`: `short` | `long` | `none`. */
  | 'hold'
  /** `v`: `anudatta` | `svarita` | `dirgha-svarita`. */
  | 'svara'
  /** Svarabhakti — a dot before `from`. A point marking. */
  | 'sbhakti'
  /** A superscript after the range. `v`: the letters. */
  | 'sup'
  /** A pause. A point marking. `v`: `short` | `long`. */
  | 'pause'
  /**
   * Where a syllable ends. A point marking.
   *
   * Division IS derivable — that is what `syllable.ts` does — and it is
   * carried rather than recomputed all the same, because a migration that also
   * re-derives cannot tell a conversion fault from a derivation fault. Once
   * `tools/migrate-audit.mjs` shows the engine reproduces a document's
   * boundaries, that document's boundary markings can be dropped; until then
   * they are what makes the round trip exact.
   */
  | 'syl'
  /** A conjunct choice on the letter: `v` is `split` or `join`. */
  | 'cj'
  /** Prose inside a marked stream. `v` is `fill` when the reciter supplies it. */
  | 'plain'
  /** A variable slot; `v` is its name. */
  | 'slot';

/** Which pass owns which kind, when the caller does not say. */
export const STAGE_OF: Readonly<Record<MarkKind, Stage>> = {
  was: 'change',
  hold: 'holdings',
  svara: 'svara',
  sbhakti: 'aids',
  sup: 'aids',
  pause: 'aids',
  syl: 'holdings',
  cj: 'change',
  plain: 'aids',
  slot: 'aids',
};

/**
 * The kinds whose neighbours FUSE when they meet and agree.
 *
 * A holding is a property spread over a range: two long holdings that touch
 * are one box, and leaving them apart draws two strokes where the author drew
 * one. A substitution is not — two consecutive letters that were each a
 * visarga are two substitutions, and fusing them into one `was [136,138) =
 * "ḥ"` says the pair of them was a single `ḥ`, which loses a letter. Śrī
 * Rudram has three verses that do exactly this, and they are what this set is
 * for; the same reasoning covers a superscript and a conjunct choice, both of
 * which belong to one letter each.
 */
export const MERGING_KINDS: ReadonlySet<MarkKind> =
  new Set<MarkKind>(['hold', 'svara', 'slot']);

/** The kinds that sit BETWEEN letters rather than over them. */
export const POINT_KINDS: ReadonlySet<MarkKind> = new Set<MarkKind>(['sbhakti', 'pause', 'syl']);

/**
 * THE KINDS THAT BELONG TO THE LETTERS THEY COVER, and to no others.
 *
 * A HOLDING IS A SPAN. It is a box drawn over a stretch of text, so a letter
 * typed at its edge belongs inside it — that is what bold does, and typing in
 * the middle of a held word must not leave a hole in its box.
 *
 * A SVARA IS NOT. It is an accent ON a letter: the letter is `a` and it is
 * `anudātta`. A letter typed beside it is a different letter and has no accent
 * of its own until somebody gives it one. The owner's report: "when I type,
 * that new character also carries a svara."
 *
 * The same is true of `was` (this letter was a `ṁ`), `sup` (a superscript
 * after this letter) and `cj` (this letter's conjunct choice). Each is a
 * property of particular letters, and taking in a neighbour makes it a
 * statement about a letter nobody made it about.
 *
 * WHAT READS THIS, and it is why the set is here rather than in either of
 * them: `shiftForEdit` uses it to decide whether an insertion at a marking's
 * edge grows it or pushes it along, and `MarkedTextNode.canInsertTextBefore`
 * uses it to answer Lexical's version of the same question. Two mechanisms,
 * one policy — see rule 1.
 *
 * `slot` and `plain` are spans like a holding: a variable slot and a stretch
 * of prose both grow with what is typed into them.
 */
export const LETTER_KINDS: ReadonlySet<MarkKind> =
  new Set<MarkKind>(['was', 'svara', 'sup', 'cj']);

export interface Mark {
  k: MarkKind;
  /** Half-open over the verse's text. `from === to` for a point marking. */
  from: number;
  to: number;
  /** The value, for the kinds that carry one. */
  v?: string;
  stage: Stage;
  /**
   * Who put it here.
   *
   * The whole reason a re-run can be safe. Without it, re-applying the rules
   * either wipes every decision made by hand or can never correct its own
   * mistakes; there is no third behaviour.
   */
  by: 'rule' | 'hand';
  /** Which rule produced it. For tracing a surprise back, never for behaviour. */
  rule?: string;
}

/** A marking with the fields the caller usually leaves to the model. */
export type MarkInput =
  Omit<Mark, 'stage' | 'by'> & { stage?: Stage; by?: Mark['by'] };

/** Fill in what the caller did not say. */
export const mark = (m: MarkInput): Mark => ({
  ...m,
  stage: m.stage ?? STAGE_OF[m.k],
  by: m.by ?? 'hand',
});

/* ── ordering ─────────────────────────────────────────────────────────────── */

/**
 * The canonical order: by start, then by end, then by kind, then by value.
 *
 * Total and deterministic, because the file's bytes depend on it — two saves of
 * an unchanged document must be identical, and a sort that leaves equal-keyed
 * items in input order would make that depend on edit history.
 */
export function compareMarks(a: Mark, b: Mark): number {
  return a.from - b.from
    || a.to - b.to
    || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)
    || ((a.v ?? '') < (b.v ?? '') ? -1 : (a.v ?? '') > (b.v ?? '') ? 1 : 0)
    || (a.by < b.by ? -1 : a.by > b.by ? 1 : 0);
}

export const sameValue = (a: Mark, b: Mark): boolean =>
  a.k === b.k && a.v === b.v && a.by === b.by && a.stage === b.stage && a.rule === b.rule;

/* ── the invariants ───────────────────────────────────────────────────────── */

export interface MarkFault {
  code: 'out-of-range' | 'split-character' | 'reversed' | 'overlap' | 'unmerged' | 'unsorted';
  message: string;
  at: number;
}

/**
 * Would an offset land inside a character?
 *
 * Two ways it can. Between the halves of a surrogate pair, which splits one
 * character into two invalid ones. And between a base letter and a combining
 * mark — `a` + U+0304 is one letter to a reader, and a marking that starts
 * between them would box a macron on its own.
 */
export function splitsCharacter(text: string, at: number): boolean {
  if (at <= 0 || at >= text.length) return false;
  const before = text.charCodeAt(at - 1);
  const here = text.charCodeAt(at);
  /* A high surrogate followed by a low one is one character. */
  if (before >= 0xd800 && before <= 0xdbff && here >= 0xdc00 && here <= 0xdfff) return true;
  return COMBINING.test(text[at] ?? '');
}

/** Combining marks: the general categories Mn and Mc, which never stand alone. */
const COMBINING = /\p{Mn}|\p{Mc}/u;

/** Every way a list of markings can be wrong. Empty is the only good answer. */
export function markFaults(marks: readonly Mark[], text: string): MarkFault[] {
  const faults: MarkFault[] = [];
  const say = (code: MarkFault['code'], message: string, at: number): void => {
    faults.push({ code, message, at });
  };

  for (const [i, m] of marks.entries()) {
    if (m.to < m.from) say('reversed', `${m.k} ends before it starts`, i);
    if (m.from < 0 || m.to > text.length) {
      say('out-of-range', `${m.k} covers ${m.from}..${m.to} of ${text.length} characters`, i);
      continue;
    }
    if (splitsCharacter(text, m.from) || splitsCharacter(text, m.to)) {
      say('split-character', `${m.k} at ${m.from}..${m.to} starts or ends inside a character`, i);
    }
    if (m.from === m.to && !POINT_KINDS.has(m.k)) {
      say('reversed', `${m.k} covers nothing, and only a point marking may`, i);
    }
    const prev = marks[i - 1];
    if (prev !== undefined && compareMarks(prev, m) > 0) {
      say('unsorted', `${m.k} at ${m.from} comes after ${prev.k} at ${prev.from}`, i);
    }
  }

  /*
   * Overlap and adjacency, per kind, since kinds are independent of each other.
   *
   * THE INDEX TRAVELS WITH THE MARKING. This grouped by spreading the whole
   * group for every marking in it and then found each one's place again with
   * `marks.indexOf` — two quadratics on the same loop. Measured: 2 000
   * markings 11 ms, 8 000 127 ms, 20 000 2 501 ms, on the save path. The
   * position a fault is reported AT has to be the marking's index in the list
   * that was passed in, so it is carried rather than searched for.
   */
  const byKind = new Map<MarkKind, { m: Mark; at: number }[]>();
  for (const [at, m] of marks.entries()) {
    const group = byKind.get(m.k);
    if (group === undefined) byKind.set(m.k, [{ m, at }]);
    else group.push({ m, at });
  }
  for (const [kind, list] of byKind) {
    if (POINT_KINDS.has(kind)) continue;
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1]!.m;
      const here = list[i]!.m;
      const at = list[i]!.at;
      if (here.from < prev.to) {
        say('overlap', `two ${kind} markings cover ${here.from}`, at);
      } else if (here.from === prev.to && sameValue(prev, here)
        && MERGING_KINDS.has(kind)) {
        say('unmerged', `two ${kind} markings meet at ${here.from} and are the same`, at);
      }
    }
  }
  return faults;
}

/** Throw on any fault, naming all of them. Used after every operation. */
export function assertMarks(marks: readonly Mark[], text: string, where = ''): void {
  const faults = markFaults(marks, text);
  if (faults.length === 0) return;
  throw new Error(
    `${where === '' ? 'markings' : where} are not sound:\n`
    + faults.map((f) => `  ${f.code}: ${f.message}`).join('\n'),
  );
}
