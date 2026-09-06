/**
 * The old column-shaped table API, re-implemented over the script registry.
 *
 * WHY THIS FILE STILL EXISTS. It used to BE the data: one row per sound and one
 * column per script, which is what made every writing system an attribute of
 * IAST rather than its peer. The data now lives in `phonemes.ts` (sounds) and
 * `scripts/*.ts` (one module per writing system), and what remains here is a
 * derivation of the old shape from the new one.
 *
 * It is kept for exactly one reason: it let the substrate be replaced with the
 * transliteration gate green at every step, rather than rewriting the tables
 * and the transliterator in one unverifiable jump. Callers move to
 * `registry.ts` and `module.ts` one at a time; when none is left, this file
 * goes.
 *
 * Note what is NOT here any more: `letterFor` and `signFor` used to open with
 *
 *     if (script === 'iast') … if (script === 'itrans') … if (script === 'tam') …
 *
 * and each of those branches is now a FIELD on a script module. Adding a script
 * touches no code in this package.
 *
 * The Devanāgarī and Telugu forms are verified against the shipped corpus; the
 * Tamil forms are NOT — the owner has confirmed they have never been reviewed,
 * so the parity gate runs on Devanāgarī and Telugu only and Tamil is registered
 * `verified: false`.
 */

import type { ChantScriptKey } from '@siksamitra/format';
import { NUCLEUS_IDS, PHONEME_INVENTORY, type PhonemeId, type PhonemeType, type Varga } from './phonemes.js';
import { formOf, signOf as signOfModule, type ScriptId } from './module.js';
import { getScript, registeredScriptIds, requireScript } from './registry.js';

/** @deprecated Ask the registry. Kept until the last caller moves. */
export type ScriptKey = ChantScriptKey;
/** @deprecated There is no "any script" any more — a script id is open. */
export type AnyScriptKey = ScriptId;

export type { PhonemeType, Varga };

export interface Phoneme {
  /** The stable identifier. Spelled in Latin; it is an id, not a rendering. */
  readonly id: PhonemeId;
  readonly type: PhonemeType;
  readonly varga?: Varga;
  readonly label?: string;
  /** @deprecated Use `id`, or ask a script module for a form. */
  readonly iast: string;
}

export interface VowelSign {
  readonly id: PhonemeId;
  /** @deprecated Use `id`. */
  readonly iast: string;
}

export const PHONEMES: readonly Phoneme[] = PHONEME_INVENTORY.map((p) => ({
  ...p,
  iast: p.id,
}));

export const VOWEL_SIGNS: readonly VowelSign[] = NUCLEUS_IDS.map((id) => ({ id, iast: id }));

/** Built by iterating the registry — no script is named in this file. */
export const VIRAMA: Readonly<Record<ScriptId, string>> = Object.fromEntries(
  registeredScriptIds().map((id) => [id, requireScript(id).virama]),
);

export const PRANAVA_FORMS: Readonly<Record<ScriptId, string>> = Object.fromEntries(
  registeredScriptIds()
    .map((id) => [id, requireScript(id).pranava])
    .filter((e): e is [string, string] => e[1] !== null),
);

/**
 * The accent marks. The same codepoints in every script, because in this system
 * they are DATA drawn by the renderer and are never emitted as glyphs.
 */
export const ACCENT_MARKS: readonly string[] = ['̱', '̍', '̎', '̐'];

export const BY_IAST: ReadonlyMap<PhonemeId, Phoneme> = new Map(
  PHONEMES.map((p) => [p.id, p]),
);
export const SIGN_BY_IAST: ReadonlyMap<PhonemeId, VowelSign> = new Map(
  VOWEL_SIGNS.map((s) => [s.id, s]),
);

/**
 * The written form of a phoneme in a script, falling back to that script's own
 * approximation where it has no character of its own.
 *
 * An unregistered script yields `null` rather than throwing: this is called per
 * letter in hot loops, and a caller that wants a diagnosis calls
 * `requireScript` once, up front, where the error can name the script.
 */
export function letterFor(p: Phoneme, script: ScriptId): string | null {
  const module = getScript(script);
  if (module === undefined) return null;
  return formOf(module, p.id)?.form ?? null;
}

/** The vowel sign for a script; `null` when that script has none for it. */
export function signFor(s: VowelSign, script: ScriptId): string | null {
  const module = getScript(script);
  if (module === undefined) return null;
  return signOfModule(module, s.id);
}
