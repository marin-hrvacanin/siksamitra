/**
 * THE RULE REGISTRY — the only list of rules there is.
 *
 * This is what makes the engine modular. Adding a mark is one entry here plus
 * one `Profile` field; removing one is deleting an entry. Nothing else moves,
 * and there is no per-document code anywhere.
 *
 * ORDER IS FIXED by MARKING-RULES §7 and is not a matter of taste:
 *
 *   0 Normalize    fold Unicode, strip stray marks       (in `normalize.ts`)
 *   3 Pauses       the bīja's pause AND the vowel hiatus (in `lex.ts`)
 *   4 Holdings     ← runs on the letters AS WRITTEN
 *   5 Anusvāra
 *   6 Visarga
 *   1 Aids         a FLAG, so it is invisible to the cluster scan
 *   2 Svarabhakti  likewise
 *   8 Svara
 *
 * Holdings run BEFORE the substitutions so a box lands on the letter as
 * written; the substitutions then only recolour letters and never move a box.
 * The other way round shifts every box one letter left — the classic
 * "everything is off by one" failure.
 *
 * Every rule cites the section it implements. A rule with no citation does not
 * merge; the registry-hygiene test asserts it.
 */
import { applyHoldings } from './holdings.js';
import {
  applyAnusvara, applyAnusvaraBeforeVowel, applyGum, applySemivowelAid,
  applyVisarga, markGumChange,
} from './sandhi.js';
import { applyReadingAids, applySvAid, applySvarabhakti } from './aids.js';
import type { Rule } from './types.js';

export const RULES: readonly Rule[] = [
  // ── Holdings ──────────────────────────────────────────────────────────────
  {
    id: 'holdings',
    stage: 'Holdings',
    spec: 'MARKING-RULES §2.1',
    title: 'Holding boxes: cluster scan, host selection, long/short, grouping',
    apply: applyHoldings,
  },

  // ── Anusvāra (§4) ─────────────────────────────────────────────────────────
  {
    id: 'anusvara.homorganic',
    stage: 'Anusvara',
    spec: 'MARKING-RULES §4',
    title: 'ṁ assimilates to the homorganic nasal before a stop',
    apply: applyAnusvara,
  },
  {
    id: 'anusvara.before-vowel',
    stage: 'Anusvara',
    spec: 'MARKING-RULES §4 — a word-final -m is never an anusvāra',
    title: 'ṁ before a vowel becomes a plain m',
    apply: applyAnusvaraBeforeVowel,
  },
  {
    id: 'anusvara.gum',
    stage: 'Anusvara',
    spec: 'MARKING-RULES §"The Vedic anusvāra"',
    title: 'The Taittirīya gum before ś ṣ s h r',
    when: (p) => p.gum,
    apply: applyGum,
  },
  {
    id: 'anusvara.semivowel-aid',
    stage: 'Anusvara',
    spec: 'MARKING-RULES §4 — measured 102/105 Vedic, 0/40 smārta',
    title: 'ṁ keeps, with the reading aid u / l / i before v / l / y',
    when: (p) => p.aids.semivowel,
    apply: applySemivowelAid,
  },

  // ── Visarga (§5) ──────────────────────────────────────────────────────────
  {
    id: 'visarga',
    stage: 'Visarga',
    spec: 'MARKING-RULES §5',
    title: 'Visarga: first match wins across the seven contexts',
    apply: applyVisarga,
  },
  {
    id: 'anusvara.gum-change',
    stage: 'Visarga',
    spec: 'MARKING-RULES §"The Vedic anusvāra"',
    title: 'An authored gum before a sibilant or h carries the change colour',
    apply: markGumChange,
  },

  // ── Flags: invisible to the cluster scan, so their stage is late ──────────
  {
    id: 'svarabhakti.r-sibilant',
    stage: 'Svarabhakti',
    spec: 'MARKING-RULES §6',
    title: 'A dot on a ś ṣ h directly preceded by r',
    when: (p) => p.svarabhakti,
    apply: applySvarabhakti,
  },
  {
    id: 'aids',
    stage: 'Aids',
    spec: 'MARKING-RULES §7 step 2',
    title: 'Reading aids: g inside jñ, u inside vy',
    apply: applyReadingAids,
  },
  {
    id: 'aids.sv',
    stage: 'Aids',
    spec: 'MARKING-RULES §7 step 2 — measured 2/30, NOT the house habit',
    title: 'Reading aid: u inside sv',
    when: (p) => p.aids.sv,
    apply: applySvAid,
  },
];

/** Is this rule enabled for this profile? `ruleOverrides` wins over `when`. */
export function isEnabled(rule: Rule, profile: { ruleOverrides?: Readonly<Record<string, boolean>> } & Parameters<NonNullable<Rule['when']>>[0]): boolean {
  const forced = profile.ruleOverrides?.[rule.id];
  if (forced !== undefined) return forced;
  return rule.when === undefined || rule.when(profile);
}

/** The stage order the pipeline runs. */
export const STAGE_ORDER = [
  'Normalize', 'Pauses', 'Holdings', 'Anusvara', 'Visarga',
  'Svarabhakti', 'Aids', 'RecensionSvara', 'Svara',
] as const;

export * from './types.js';
export { samePoint, collectSamyukta, selectHoldingComponent, holdingVowel } from './holdings.js';
export {
  SVARA_PLANS, applySvaraPlan, parsePlan, formatPlan, segments,
} from './svara.js';
export type { SvaraPlan, SvaraPosition, Segment } from './svara.js';
/** The transcription half, split out when `svara.ts` passed 400 lines. */
export { applyAttestedSvara, witnessLine } from './witness.js';
