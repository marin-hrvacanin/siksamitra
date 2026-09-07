/**
 * Emit — the element list becomes the reader's own token stream.
 *
 * This is the boundary between the engine and the format: everything upstream
 * is `Elem`, everything downstream is `ChantToken` from `shared/src/chant.ts`.
 *
 * Two layout facts that have each caused a reported defect:
 *
 *   - A DAṆḌA IS A WORD, spaced like one. Every chant JSON stores it as
 *     `sp · danda · sp` (Puruṣa Sūktam has 27 of them and none without).
 *     Without the spaces the reader prints `namaḥ।hariḥ`.
 *   - THE TWO PAUSE KINDS ARE SPACED DIFFERENTLY. A vowel-hiatus pause sits
 *     between two spaces (`śa ne ␣ ‖ ␣ a bhi`); the praṇava's pause has no
 *     trailing space (`oṁ ␣ | tac`). They cannot share a layout — dropping the
 *     hiatus pause's trailing space glues it to the next syllable.
 *
 * Ported from `gen_marks.emit_tokens`, with one deliberate difference: this
 * emits the reader's TYPED tokens (`danda`) where the Python emitted a generic
 * `{t:'punct'}` that each generator had to map itself.
 */
import type { ChantToken, ChantUnit } from '@siksamitra/format';
import type { Elem, SrcSpan } from './lex.js';
import { syllabify } from './syllable.js';
import { transliterateSyllable } from './script/index.js';
import type { ScriptKey, ScriptOptions } from './script/index.js';

export interface EmitOptions extends ScriptOptions {
  /** Which scripts to derive per syllable. Default: all four. */
  scripts?: readonly ScriptKey[];
}

/** One element becomes one unit, carrying only the keys it actually has. */
export function unitOf(l: Elem): ChantUnit {
  const u: ChantUnit = { c: l.ch };
  if (l.hold !== undefined) {
    u.hold = l.hold;
    if (l.hg !== undefined) u.hg = l.hg;
  }
  // The conjunct choice was computed by `lex`, handed to the Indic scripts, and
  // then dropped here — so a document could not reproduce its own Devanagari
  // from its own IAST. It is document data, not a transliteration detail.
  if (l.cj !== undefined) u.cj = l.cj;
  if (l.change === true) u.change = true;
  if (l.svara !== undefined) u.svara = l.svara;
  if (l.sup !== undefined) u.sup = l.sup;
  if (l.candra === true) u.candra = true;
  // The dot is drawn BEFORE the letter and outside any holding box, so it is a
  // property of this letter and never of the box (MARKING-RULES §6).
  if (l.sbhakti === true) u.sbhakti = true;
  return u;
}

/**
 * Renumber holding groups canonically — 1..n in token order.
 *
 * `hg` ids must never be a raw counter: identical input has to produce
 * identical bytes, and a counter that depends on scan order does not (02A H06).
 */
function renumberGroups(tokens: ChantToken[]): void {
  const map = new Map<number, number>();
  let next = 1;
  for (const t of tokens) {
    if (t.t !== 'syl') continue;
    for (const u of t.units) {
      if (u.hg === undefined) continue;
      let id = map.get(u.hg);
      if (id === undefined) {
        id = next;
        next += 1;
        map.set(u.hg, id);
      }
      u.hg = id;
    }
  }
}

/**
 * What `emit` produced, and where each emitted unit came from.
 *
 * The spans are the editor's caret map, and they are returned FROM HERE rather
 * than derived separately from the element list, because `emit` is the only
 * thing that knows what counts as a unit. Deriving them elsewhere by filtering
 * for letters silently broke the moment the hyphen became a unit of its own:
 * every unit after a hyphen mapped to the wrong source offset, and typing into
 * a hyphenated verse scattered the text.
 */
export interface EmitResult {
  tokens: ChantToken[];
  /** One span per emitted unit, in emitted order. */
  spans: SrcSpan[];
}

export function emitWithSpans(elems: Elem[], opts?: EmitOptions): EmitResult {
  const scripts = opts?.scripts ?? (['iast', 'deva', 'tel', 'tam'] as const);
  const tokens: ChantToken[] = [];
  const spans: SrcSpan[] = [];
  let buf: Elem[] = [];

  const flushWord = (): void => {
    if (buf.length === 0) return;
    for (const syl of syllabify(buf)) {
      const units = syl.map(unitOf);
      for (const l of syl) spans.push(l.src);
      const iast = syl.map((l) => l.ch).join('');
      const scriptUnits = syl.map((l) => ({
        c: l.ch,
        ...(l.cj !== undefined ? { cj: l.cj } : {}),
      }));
      const tok = { t: 'syl' as const, units, iast } as ChantToken & {
        deva: string; tel?: string; tam?: string;
      };
      for (const s of scripts) {
        if (s === 'iast') continue;
        const form = transliterateSyllable(scriptUnits, s, opts);
        if (s === 'deva') tok.deva = form;
        else if (s === 'tel') tok.tel = form;
        else if (s === 'tam') tok.tam = form;
      }
      tokens.push(tok);
    }
    buf = [];
  };

  for (const e of elems) {
    if (e.kind === 'vpause') {
      // Spaced on BOTH sides, which is how the owner's own marked files set it.
      flushWord();
      tokens.push({ t: 'sp' });
      tokens.push({ t: 'pause', len: e.text === 'long' ? 'long' : 'short' });
      tokens.push({ t: 'sp' });
      continue;
    }
    if (e.kind === 'ompause') {
      // The praṇava's short pause: `syl(oṁ) · sp · pause · syl(…)` — no
      // trailing space, matching purusha-suktam.json.
      flushWord();
      tokens.push({ t: 'sp' });
      tokens.push({ t: 'pause', len: 'short' });
      continue;
    }
    if (e.kind === 'br') {
      flushWord();
      tokens.push({ t: 'br' });
      continue;
    }
    if (e.kind === 'bar') {
      // A hairline between pādas. No space of its own: it is drawn INSIDE the
      // gap the words already leave, which is how the corpus sets all 59.
      flushWord();
      tokens.push({ t: 'bar' });
      continue;
    }
    if (e.kind === 'num') {
      flushWord();
      tokens.push({ t: 'num', s: e.text ?? '' });
      continue;
    }
    if (e.kind === 'hyphen') {
      // A CODA, not a token: `chaṁyorā-vṛṇīmahe` is `chaṁ · yo · rā- · vṛ · …`,
      // which is how all 469 hyphens in the shipped corpus are stored. It joins
      // the syllable that precedes it in every script, and emits NO space —
      // that is the whole difference between a hyphen and the space `norm()`
      // used to turn it into.
      flushWord();
      const last = tokens[tokens.length - 1];
      if (last !== undefined && last.t === 'syl') {
        last.units.push({ c: '-' });
        spans.push(e.src);
        last.iast += '-';
        last.deva += '-';
        if (last.tel !== undefined) last.tel += '-';
        if (last.tam !== undefined) last.tam += '-';
      }
      continue;
    }
    if (e.kind === 'pause') {
      flushWord();
      /*
       * A SPACE BEFORE A DAṆḌA, NEVER AFTER, and only after a syllable.
       *
       * Measured against the eleven shipped documents rather than chosen: they
       * set `… naḥ · sp · ।` and `… syāma · sp · ॥ · 3 · ॥` — one space before
       * the first daṇḍa, and nothing between a daṇḍa, a verse number and the
       * closing daṇḍa. Emitting a trailing space put one into 176 verses that
       * did not have it (`॥3॥` became `॥ 3 ॥`), and the comparison that was
       * supposed to catch that had been loosened to tolerate it instead.
       */
      const last = tokens[tokens.length - 1];
      if (last !== undefined && last.t === 'syl') tokens.push({ t: 'sp' });
      const text = e.text ?? '|';
      tokens.push({ t: 'danda', s: text.length >= 2 ? '॥' : '।' });
      continue;
    }
    // A letter. A word boundary emits a space.
    const prev = buf[buf.length - 1];
    if (prev !== undefined && e.word !== prev.word) {
      flushWord();
      tokens.push({ t: 'sp' });
    }
    buf.push(e);
  }
  flushWord();

  while (tokens.length > 0 && tokens[tokens.length - 1]!.t === 'sp') tokens.pop();
  renumberGroups(tokens);
  return { tokens, spans };
}

/** Just the tokens — `gen_marks.emit_tokens`'s own signature. */
export function emit(elems: Elem[], opts?: EmitOptions): ChantToken[] {
  return emitWithSpans(elems, opts).tokens;
}
