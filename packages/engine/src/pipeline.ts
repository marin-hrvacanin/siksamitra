/**
 * The pipeline — plain IAST plus a profile, in; a marked token stream plus a
 * trace and a source map, out.
 *
 * Pure and referentially transparent: `derive(x, p)` twice returns deep-equal
 * results, and that is a test. No I/O, no clock, no randomness — a derivation
 * has to be byte-deterministic or the whole verification strategy collapses.
 *
 * See specs/chant-editor/02-ENGINE.md §7.
 */
import type { ChantOverride, ChantToken } from '@siksamitra/format';
import { lex } from './lex.js';
import type { SrcSpan } from './lex.js';
import { emitWithSpans } from './emit.js';
import type { EmitOptions } from './emit.js';
import { DEFAULT_PROFILE } from './profile.js';
import type { Profile } from './profile.js';
import { RULES, STAGE_ORDER, isEnabled } from './rules/index.js';
import { SVARA_PLANS, applySvaraPlan } from './rules/svara.js';
import { applyAttestedSvara } from './rules/witness.js';
import { applyOverrides } from './overrides.js';
import type { OverrideResult } from './overrides.js';
import type { RuleCtx, Trace, Warning } from './rules/types.js';

export interface DeriveSource {
  /** The underlying IAST, one string per source line. */
  lines: string[];
  /** An accented witness, when the svara is a transcription. */
  accented?: string[];
}

/** unit index → where it came from, and back. The editor's caret map. */
export interface SrcMap {
  /** Per emitted unit, in token order, its source span. */
  units: SrcSpan[];
  /** The normalised lines the spans refer to. */
  lines: string[];
}

export interface Derivation {
  tokens: ChantToken[];
  trace: Trace[];
  srcMap: SrcMap;
  warnings: Warning[];
  stats: { syllables: number; units: number; holdings: number; svaras: number };
  /** What the author's hand did to this derivation, and what it could not do.
   *  Reported rather than swallowed: an `owner-hand` override that no longer
   *  addresses a letter is the one failure the editor must surface. */
  overrides: OverrideResult;
}

export interface DeriveOptions extends EmitOptions {
  verseId?: string;
  verseN?: string | null;
  /** Keep the trace. Off in batch generation, on in the editor. */
  trace?: boolean;
  /** Apply an unverified metre preset anyway (02A S08). */
  allowUnverifiedPlan?: boolean;
  /**
   * The document's hand-placed marks. Applied LAST, so they overrule every
   * rule including the svara plan — see `overrides.ts`. Filtered by
   * `verseId`, so passing the whole document's array is correct and cheap.
   */
  overrides?: readonly ChantOverride[];
}

/**
 * Derive one verse.
 *
 * The stages run in the fixed order (`STAGE_ORDER`), and within a stage in
 * registry order. Svara is applied last, and by REGISTER: a positional preset
 * is only ever applied to `conventional` material, and the refusals for
 * attested and Vedic-without-a-source text are enforced in `applySvaraPlan`,
 * not here, so there is one place that can say no.
 */
export function derive(
  src: DeriveSource,
  profile: Profile = DEFAULT_PROFILE,
  opts?: DeriveOptions,
): Derivation {
  const { elems, wordIsBija, lines } = lex(src.lines, profile);
  const trace: Trace[] = [];
  const warnings: Warning[] = [];
  const keepTrace = opts?.trace !== false;

  const ctx: RuleCtx = {
    elems,
    profile,
    wordIsBija,
    verse: { id: opts?.verseId ?? '', n: opts?.verseN ?? null },
    trace(elemIndex, note, rule, from, to) {
      if (!keepTrace) return;
      const entry: Trace = { elem: elemIndex, rule: rule ?? '', note };
      if (from !== undefined) entry.from = from;
      if (to !== undefined) entry.to = to;
      const at = trace.length;
      trace.push(entry);
      const e = elems[elemIndex];
      if (e !== undefined) (e.trace ??= []).push(at);
    },
    warn(code, message, at) {
      warnings.push(at === undefined ? { code, message } : { code, message, at });
    },
  };

  for (const stage of STAGE_ORDER) {
    for (const rule of RULES) {
      if (rule.stage !== stage) continue;
      if (!isEnabled(rule, profile)) continue;
      rule.apply(ctx);
    }
  }

  // Svara, by register. `attested` transcribes from a witness; `conventional`
  // applies the metre's preset; `prose` and `vedic-refuse` take none.
  if (profile.svara.register === 'attested' && src.accented !== undefined) {
    applyAttestedSvara(ctx, src.accented);
  } else if (profile.svara.register === 'conventional') {
    const meter = profile.svara.meter;
    if (meter === undefined) {
      ctx.warn(
        'svara.no-meter',
        'the conventional register needs a declared metre — the verse is left unmarked',
      );
    } else {
      applySvaraPlan(ctx, SVARA_PLANS[meter], {
        allowUnverified: opts?.allowUnverifiedPlan === true,
      });
    }
  }

  /*
   * The author's hand, last. After the rules and after svara, because an
   * override exists to overrule them: a transcribed accent the positional plan
   * disagrees with is evidence, and the engine does not get to win that
   * argument. Rule zero, enforced here rather than described in a docstring.
   */
  const overrides = applyOverrides(
    elems,
    opts?.overrides ?? [],
    opts?.verseId ?? '',
    ctx,
  );

  // The spans come back FROM `emit`, not from a second pass over `elems`:
  // `emit` decides what a unit is, and a caret map built by any other rule
  // drifts the moment that decision changes.
  const { tokens, spans } = emitWithSpans(elems, opts);
  return {
    tokens,
    trace,
    srcMap: { units: spans, lines },
    warnings,
    stats: stats(tokens),
    overrides,
  };
}

function stats(tokens: ChantToken[]): Derivation['stats'] {
  let syllables = 0;
  let units = 0;
  let holdings = 0;
  let svaras = 0;
  const seen = new Set<number>();
  for (const t of tokens) {
    if (t.t !== 'syl') continue;
    syllables += 1;
    for (const u of t.units) {
      units += 1;
      if (u.hg !== undefined && !seen.has(u.hg)) {
        seen.add(u.hg);
        holdings += 1;
      }
      if (u.svara !== undefined) svaras += 1;
    }
  }
  return { syllables, units, holdings, svaras };
}

/**
 * The convenience wrapper — one fragment in, tokens out.
 *
 * This is `gen_marks.mark()`'s signature, so every existing call site reads the
 * same. ` // ` in the text is a line break, as the Python generators write it.
 */
export function mark(text: string, profile: Profile = DEFAULT_PROFILE): ChantToken[] {
  if (text.trim() === '') return [];
  const lines = text.split(' // ');
  return derive({ lines }, profile, { trace: false }).tokens;
}
