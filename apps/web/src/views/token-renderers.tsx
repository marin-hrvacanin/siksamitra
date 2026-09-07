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
import { renderSyl } from '@siksamitra/render';

export interface TokenContext {
  readonly script: ChantScriptKey;
  readonly showMarks: boolean;
  readonly fontStack: string;
}

type Renderer<T extends ChantToken['t']> = (
  token: Extract<ChantToken, { t: T }>,
  key: number,
  ctx: TokenContext,
) => ReactNode;

/** Every token type, drawn. Keyed so the compiler demands all of them. */
export const TOKEN_RENDERERS: { readonly [T in ChantToken['t']]: Renderer<T> } = {
  syl: (t, key, ctx) => renderSyl(t, ctx.script, key, {
    showMarks: ctx.showMarks, fontStack: ctx.fontStack,
  }),

  sp: (_t, key) => <span className="sp" key={key}> </span>,

  danda: (t, key) => <span className="danda" key={key}>{t.s}</span>,

  /** Structure, not speech — see the contract. Drawn, never recited. */
  num: (t, key) => <span className="num" key={key}>{t.s}</span>,

  bar: (_t, key) => <span className="bar" key={key} aria-hidden />,

  /**
   * A pause has a duration and no glyph. Drawn as a gap whose width comes from
   * a token, so short and long stay distinguishable at every text size.
   */
  pause: (t, key) => <span className={`pause pause--${t.len}`} key={key} aria-hidden />,

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
  slot: (t, key, ctx) => (
    <span className="slot" data-slot={t.name} key={key}>
      {t.tokens.map((child, i) => renderToken(child, i, ctx))}
    </span>
  ),
};

/**
 * Draw one token.
 *
 * A type with no renderer is reported rather than dropped — the failure mode a
 * switch statement hides.
 */
export function renderToken(token: ChantToken, key: number, ctx: TokenContext): ReactNode {
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
  return render(token, key, ctx);
}
