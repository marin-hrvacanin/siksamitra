/**
 * How each token type is drawn — a registry, one entry per type.
 *
 * WHY A REGISTRY AND NOT A SWITCH. The token union grows: it gained `num`,
 * `bar` and `slot` after the contract was first written, and the contract did
 * not know about them for a while. With a switch, a new type is a silent
 * `return null` — the token renders as nothing and nobody notices until a
 * document is missing its verse numbers.
 *
 * With a registry, a missing entry is a LOOKUP FAILURE that can be reported.
 * Adding a token type is one entry here and nothing else, and the exhaustiveness
 * check below makes the compiler name the type you forgot.
 */

import { Fragment, type ReactNode } from 'react';
import type { ChantScriptKey, ChantToken } from '@siksamitra/format';
import { holdJoins, renderSyl, type HoldJoin } from '@siksamitra/render';

export interface TokenContext {
  readonly script: ChantScriptKey;
  readonly showMarks: boolean;
  readonly fontStack: string;
  /**
   * The editor is drawing: every letter carries `data-u`, its unit index
   * within the verse, so a click can be turned into a source offset.
   *
   * Off for the reader, whose markup then stays exactly what it was.
   */
  readonly addressable?: boolean;
}

type Renderer<T extends ChantToken['t']> = (
  token: Extract<ChantToken, { t: T }>,
  key: number,
  ctx: TokenContext,
  /** This token's first unit index within the verse. */
  unitOffset: number,
  /** Whether this syllable's box is continued by its neighbour — see
   *  `holdJoins`. Absent for every token type that is not a syllable. */
  join?: HoldJoin,
) => ReactNode;

/** Every token type, drawn. Keyed so the compiler demands all of them. */
export const TOKEN_RENDERERS: { readonly [T in ChantToken['t']]: Renderer<T> } = {
  syl: (t, key, ctx, unitOffset, join) => renderSyl(t, ctx.script, key, {
    showMarks: ctx.showMarks,
    fontStack: ctx.fontStack,
    ...(ctx.addressable === true ? { unitOffset } : {}),
    ...(join?.joinL === true ? { joinL: true } : {}),
    ...(join?.joinR === true ? { joinR: true } : {}),
  }),

  sp: (_t, key) => <span className="sp" key={key}> </span>,

  danda: (t, key) => <span className="danda" key={key}>{t.s}</span>,

  /** Structure, not speech — see the contract. Drawn, never recited. */
  num: (t, key) => <span className="num" key={key}>{t.s}</span>,

  /**
   * A BAR — the `|` that ends a pāda inside a line.
   *
   * It has a glyph, and it was drawn as an empty span: 59 of them in Puruṣa
   * Sūktam alone, present in the DOM and invisible on the page. The exporter
   * has always written a literal `|` for it (`docx.ts`), so a reader who
   * printed the document saw marks the screen did not show.
   */
  bar: (_t, key) => <span className="bar" key={key}>|</span>,

  /**
   * A PAUSE, drawn as the pipes his own documents carry: `|` short, `||` long.
   *
   * This drew an empty span too — "a gap whose width comes from a token" — so
   * all 976 pauses in the corpus rendered as nothing at all. The Word exporter
   * writes `|` and `||` in the `Pause` character style, the v1 importer counts
   * those same pipes, and the PDF shows them in red: the glyph IS the mark, and
   * a gap is not a notation anyone can read.
   */
  pause: (t, key) => (
    <span className={`pause pause--${t.len}`} key={key}>
      {t.len === 'long' ? '||' : '|'}
    </span>
  ),

  /**
   * `br` is handled by the line splitter before this registry is reached: a
   * line break is structure between lines, not a thing inside one. The entry
   * exists so the exhaustiveness check stays honest.
   */
  br: (_t, key) => <Fragment key={key} />,

  text: (t, key, ctx) => (
    <span
      key={key}
      className={t.fill === true
        ? (t.placeholder === true ? 'fill fill--empty' : 'fill')
        : 'plain'}
      // A placeholder is SHOWN and is not text: it must never reach the
      // recitation, a copy or an export. Marked so a copy handler can strip it.
      {...(t.placeholder === true ? { 'data-placeholder': '1' } : {})}
    >
      {ctx.script === 'iast' ? t.s : (t[ctx.script] ?? t.s)}
    </span>
  ),

  /**
   * A slot is TRANSPARENT: its tokens are recited through it, so it renders its
   * children rather than a representation of itself. The only recursive
   * construct in the format, and the one a flat reader silently drops.
   */
  slot: (t, key, ctx, unitOffset) => (
    <span className="slot" data-slot={t.name} key={key}>
      {(() => {
        /* A slot is transparent, so its children join each other exactly as
           the tokens around it do — computed over the slot's own stream. */
        const inner = holdJoins(t.tokens);
        return t.tokens.map((child, i) => renderToken(
          child, i, ctx, unitOffset + unitsBefore(t.tokens, i), inner.get(i),
        ));
      })()}
    </span>
  ),
};

/**
 * Draw one token.
 *
 * A type with no renderer is reported rather than dropped — the failure mode a
 * switch statement hides.
 */
export function renderToken(
  token: ChantToken,
  key: number,
  ctx: TokenContext,
  unitOffset = 0,
  join?: HoldJoin,
): ReactNode {
  const render = TOKEN_RENDERERS[token.t] as Renderer<ChantToken['t']> | undefined;
  if (render === undefined) {
    if (import.meta.env.DEV) {
      console.error(`no renderer for token type "${String(token.t)}"`, token);
    }
    return (
      <span className="token--unknown" key={key} title={`unrenderable token: ${String(token.t)}`}>
        ⟨?⟩
      </span>
    );
  }
  return render(token, key, ctx, unitOffset, join);
}

/**
 * How many units precede token `index` in this stream.
 *
 * The count must match `SrcMap.units`, which `emit` fills one entry per LETTER
 * of each syllable and nothing else — so only `syl` tokens count, and a slot's
 * children count through it because a slot is transparent (see the contract).
 * If these two ever disagree, every hand-placed mark lands on the wrong letter,
 * which is why the count lives in one function.
 */
export function unitsBefore(tokens: readonly ChantToken[], index: number): number {
  let n = 0;
  for (let i = 0; i < index && i < tokens.length; i += 1) {
    const t = tokens[i]!;
    if (t.t === 'syl') n += t.units.length;
    else if (t.t === 'slot') n += unitsBefore(t.tokens, t.tokens.length);
  }
  return n;
}
