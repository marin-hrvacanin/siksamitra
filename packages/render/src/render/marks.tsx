/**
 * Mark drawing — the ONE implementation, shared by the reader and the editor.
 *
 * `CLAUDE.md` forbids a second renderer for marked text, and the reason is on
 * the record: a parallel path once inherited `text-indent: -1.1em` into every
 * `.hold` inline-block, whose shrink-to-fit width then computed to ZERO, and
 * the text printed on top of itself — catastrophically in Devanāgarī, where
 * every akṣara is an inline-block.
 *
 * These functions were lifted VERBATIM out of `ChantReader.tsx`. The only
 * change is that the two values they used to close over — whether marks are
 * shown, and the font stack the holding box is measured against — are now
 * parameters. The reader passes exactly what it passed before, so its output is
 * unchanged; the editor passes its own.
 *
 * What is NOT here: line breaking, audio gutters, the grammar popover, the
 * practice cursor. Those are the reader's own business and stay in it. What is
 * here is everything that draws a MARK, which is where the danger was.
 *
 * See specs/chant-editor/04-EDITOR.md §8.
 */
import { Fragment, type ReactNode } from 'react';
import type { ChantScriptKey, ChantSyllable, ChantToken } from '@siksamitra/format';
import { holdBoxVars } from '../holdBox';

export type ScriptKey = ChantScriptKey;
export type Unit = ChantSyllable['units'][number];
export type Syl = ChantSyllable;

/** Digits per script — a verse number is rendered in the active script. */
export const DIGITS: Record<ScriptKey, string> = {
  iast: '0123456789',
  deva: '०१२३४५६७८९',
  tel: '౦౧౨౩౪౫౬౭౮౯',
  tam: '௦௧௨௩௪௫௬௭௮௯',
};

/** The candrabindu, per script. */
export const DEVA_CANDRA: Record<ScriptKey, string> = {
  iast: '̐', deva: 'ँ', tel: 'ఀ', tam: '̐',
};

/**
 * The virāma tick — the clipped final stop at the end of a pāda
 * (`caturbhujamˎ।`, MARKING-RULES §6). It lives in the text as a CHARACTER, not
 * as a typed field, because that is how the marked sources set it and how the
 * generators carry it; but it is a RECITATION MARK, so it is inked like the
 * svaras rather than like a letter, and it goes quiet with them when marks are
 * off. IAST only: the other scripts write that final consonant with their own
 * halanta.
 */
export const VIRAMA = 'ˎ';

/** What the mark renderers need to know, and nothing more. */
export interface MarkRenderOptions {
  /** Draw the recitation marks. Off = the clean letters. */
  showMarks: boolean;
  /** `.pada`'s resolved font family list — the holding box is measured against
   *  the face that will actually draw the glyph. */
  fontStack: string;
  /**
   * This syllable's first unit index within its verse. Present ⇒ the editor is
   * drawing, and every letter carries `data-u` so a click can find it.
   *
   * ADDRESSABILITY IS OPTIONAL BUT THE RENDERER IS NOT DUPLICATED. The reader
   * omits this and its markup is byte-identical to before, which is the whole
   * reason it is a parameter rather than a second implementation — the parallel
   * path is what once printed Devanagari on top of itself.
   *
   * In an Indic script the addressable element is the AKSARA, not the letter:
   * you cannot click half a conjunct, and this program's answer to that is not
   * to pretend otherwise. Such an element carries `data-u` plus `data-un`, the
   * number of units it stands for.
   */
  unitOffset?: number;
}

/** One syllable's form in a script. Older fragment tables carry only IAST +
 *  Devanāgarī; fall back rather than render an empty span. */
export function sylText(syl: Syl, sc: ScriptKey): string {
  if (sc === 'iast') return syl.iast;
  return syl[sc] ?? syl.deva;
}

/** Unmarked running text (a fill, or plain text) in a script. */
export function plainText(tk: Extract<ChantToken, { t: 'text' }>, sc: ScriptKey): string {
  if (sc === 'iast') return tk.s;
  return tk[sc] ?? tk.s;
}

export function toScriptDigits(s: string, script: ScriptKey): string {
  const d = DIGITS[script];
  return s.replace(/[0-9]/g, (c) => d[Number(c)] ?? c);
}

export function wordSurface(syls: Syl[], sc: ScriptKey): string {
  if (sc === 'iast') {
    return syls.map((s) => s.units.map((u) => u.c + (u.candra ? '̐' : '')).join('')).join('');
  }
  return syls.map((s) => sylText(s, sc)).join('');
}

/** One letter, with the marks that land on that specific letter. */
export function renderUnit(
  u: Unit,
  key: number,
  o: MarkRenderOptions,
  withSup = true,
  withSbhakti = true,
  /** Index within the syllable, for `data-u`. Defaults to `key`, which is the
   *  local index everywhere it is called from except inside a holding run. */
  local = key,
): ReactNode {
  const cls = ['u'];
  if (o.showMarks && u.svara) cls.push(`sv-${u.svara}`);
  if (o.showMarks && u.change) cls.push('is-change');
  if (o.showMarks && u.c === VIRAMA) cls.push('u--virama');
  const glyph = u.c + (u.candra ? '̐' : '');
  return (
    <Fragment key={key}>
      {withSbhakti && u.sbhakti ? <span className="sbhakti" aria-hidden /> : null}
      <span
        className={cls.join(' ')}
        {...(o.unitOffset === undefined ? {} : { 'data-u': o.unitOffset + local })}
      >
        {glyph}
      </span>
      {withSup && u.sup ? <sup className="u__sup">{u.sup}</sup> : null}
    </Fragment>
  );
}

/**
 * IAST renders letter by letter, so a holding box wraps a RUN of units sharing
 * `hold` + `hg` — the group (02A H02). Svarabhakti dots and superscripts render
 * OUTSIDE the tight box.
 */
export function renderIastUnits(units: Unit[], o: MarkRenderOptions): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < units.length) {
    const u = units[i]!;
    if (o.showMarks && u.hold) {
      const variant = u.hold;
      const g = u.hg;
      const run: Unit[] = [];
      let j = i;
      while (j < units.length && units[j]!.hold === variant && units[j]!.hg === g) {
        run.push(units[j]!);
        j += 1;
      }
      run.forEach((ru, k) => {
        if (ru.sbhakti) out.push(<span className="sbhakti" aria-hidden key={`sb-${i}-${k}`} />);
      });
      const inked = run.map((ru) => ru.c + (ru.candra ? '̐' : '')).join('');
      out.push(
        <span className={`hold hold-${variant}`} key={i} style={holdBoxVars(inked, o.fontStack)}>
          {run.map((ru, k) => renderUnit(ru, i + k, o, false, false, i + k))}
        </span>,
      );
      run.forEach((ru, k) => {
        if (ru.sup) out.push(<sup className="u__sup" key={`sup-${i}-${k}`}>{ru.sup}</sup>);
      });
      i = j;
    } else {
      out.push(renderUnit(u, i, o));
      i += 1;
    }
  }
  return out;
}

/**
 * One syllable.
 *
 * IAST renders letter by letter; the Indic scripts render ONE shaped akṣara
 * with akṣara-level marks, because you cannot colour half a conjunct and the
 * owner's own answer to that is not to try (see MARKING-RULES §2.4 and the
 * Devanāgarī measurement).
 */
export function renderSyl(
  syl: Syl,
  sc: ScriptKey,
  key: number,
  o: MarkRenderOptions,
): ReactNode {
  if (sc === 'iast') {
    return <span className="syl" key={key}>{renderIastUnits(syl.units, o)}</span>;
  }
  const anyHoldLong = syl.units.some((u) => u.hold === 'long');
  const anyHoldShort = !anyHoldLong && syl.units.some((u) => u.hold === 'short');
  const svara = syl.units.find((u) => u.svara)?.svara;
  const change = syl.units.some((u) => u.change);
  const candra = syl.units.some((u) => u.candra);
  const sbhakti = syl.units[0]?.sbhakti; // the epenthetic dot precedes the akṣara
  const cls = ['syl', 'syl--aksara'];
  if (o.showMarks && svara) cls.push(`sv-${svara}`);
  if (change) cls.push('is-change');
  const text = sylText(syl, sc) + (candra ? DEVA_CANDRA[sc] : '');
  const hold = o.showMarks ? (anyHoldLong ? 'long' : anyHoldShort ? 'short' : null) : null;
  // The box is drawn by `.hold::after`, so it needs its own element: the
  // akṣara's own ::before/::after already carry the svara marks, and one
  // syllable can be both held and accented.
  const aksara = (
    <span
      className={cls.join(' ')}
      {...(o.unitOffset === undefined
        ? {}
        : { 'data-u': o.unitOffset, 'data-un': syl.units.length })}
    >
      {text}
    </span>
  );
  return (
    <Fragment key={key}>
      {sbhakti ? <span className="sbhakti" aria-hidden /> : null}
      {hold
        ? <span className={`hold hold-${hold}`} style={holdBoxVars(text, o.fontStack)}>{aksara}</span>
        : aksara}
    </Fragment>
  );
}
