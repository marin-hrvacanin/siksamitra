/**
 * The rule contract. This is what makes the engine modular: a rule is a pure
 * function with an id, a stage, and a citation of the spec section it
 * implements. Adding or removing a mark is one registry entry — never a new
 * script, never a copied function.
 *
 * See specs/chant-editor/02-ENGINE.md §5.
 */
import type { Elem } from '../lex.js';
import type { Profile } from '../profile.js';

/**
 * The pipeline stages, in the order MARKING-RULES §7 fixes.
 *
 * HOLDINGS RUN BEFORE THE SUBSTITUTIONS. A box must land on the letter as
 * written; the substitutions then only recolour letters, they never move a box.
 * Doing it the other way round shifts every box one letter left — the classic
 * "everything is off by one" failure.
 */
export const STAGES = [
  'Normalize',
  'Aids',
  'Svarabhakti',
  'Pauses',
  'Holdings',
  'Anusvara',
  'Visarga',
  'RecensionSvara',
  'Svara',
] as const;

export type Stage = (typeof STAGES)[number];

/** One recorded mark decision, so the editor can say WHY a mark is where it is. */
export interface Trace {
  /** Index into the element list. */
  elem: number;
  /** The `Rule.id` that made the decision. */
  rule: string;
  note: string;
  from?: string;
  to?: string;
}

export interface Warning {
  code: string;
  message: string;
  /** Element index, when the warning is positional. */
  at?: number;
}

export interface RuleCtx {
  /** Mutated in place by the rules. */
  readonly elems: Elem[];
  readonly profile: Profile;
  /** Per word index: is this word a bīja? */
  readonly wordIsBija: boolean[];
  readonly verse: { id: string; n?: string | null };
  trace(elemIndex: number, note: string, rule?: string, from?: string, to?: string): void;
  warn(code: string, message: string, at?: number): void;
}

export interface Rule {
  /** Stable dotted id. Used by `ruleOverrides`, by traces, and in test names. */
  readonly id: string;
  readonly stage: Stage;
  /** Where this rule is specified. REQUIRED — a rule with no citation does not
   *  merge (the registry-hygiene gate asserts it). */
  readonly spec: string;
  /** One line, shown in the editor's trace panel. */
  readonly title: string;
  /** Parametrization: skip the rule entirely for this profile. */
  readonly when?: (p: Profile) => boolean;
  apply(ctx: RuleCtx): void;
}
