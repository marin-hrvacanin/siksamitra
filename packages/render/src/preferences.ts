/**
 * Reading preferences — how a marked document is DISPLAYED.
 *
 * These belong to the renderer, not to the format: which script a reader wants
 * on top, whether marks are shown, how large the text is. None of it changes
 * what the document says, so none of it is document data.
 *
 * `.catch()` on every field is LOAD-BEARING. Each field degrades to its own
 * default when it fails to parse, instead of failing the whole object. Without
 * it, one unrecognised value — a key renamed between builds, a stale value from
 * an older release, a hand-edited storage entry — made the entire preferences
 * parse fail, and every reader fell back to ALL defaults. One bad field silently
 * wiped unrelated ones. No single preference is worth losing three others over.
 */

import { z } from 'zod';

export const ChantScript = z.enum(['iast', 'devanagari', 'telugu', 'tamil']);
export type ChantScript = z.infer<typeof ChantScript>;

export const ChantSecondaryScript = z.enum(['none', 'iast', 'devanagari', 'telugu', 'tamil']);
export type ChantSecondaryScript = z.infer<typeof ChantSecondaryScript>;

/** Rendering preferences for the embeddable reader. */
export const ChantPreferences = z.object({
  primaryScript: ChantScript.catch('iast').default('iast'),
  secondaryScript: ChantSecondaryScript.catch('none').default('none'),
  /** svara / holding / anusvāra marks */
  marks: z.boolean().catch(true).default(true),
  /** show the English gloss */
  translation: z.boolean().catch(false).default(false),
  /** word-tap grammar popovers */
  grammar: z.boolean().catch(true).default(true),
  /** show per-verse play buttons */
  audio: z.boolean().catch(true).default(true),
  fontScale: z.number().min(0.8).max(1.6).catch(1).default(1),
  mode: z.enum(['read', 'practice']).catch('read').default('read'),
  /** recitation playback rate */
  audioSpeed: z.number().min(0.5).max(2).catch(1).default(1),
  /**
   * The reader's non-mantra prose: what to do at each step. `actions` keeps
   * `do` and `caution` and hides `note` / `option` — a person mid-rite who
   * turned translation off still needs to know to ring the bell. Turning them
   * fully off must be explicit, never a side effect.
   */
  directions: z.enum(['all', 'actions', 'off']).catch('all').default('all'),
  /**
   * Optional / alternative step groups, keyed `<docId>:<groupId>`. A choice
   * about one manual must never leak into another.
   */
  variants: z.record(z.union([z.string(), z.boolean()])).catch({}).default({}),
});
export type ChantPreferences = z.infer<typeof ChantPreferences>;

/**
 * Saṅkalpa choices — how a reciter's statement of intent is composed.
 *
 * These live in the renderer because the saṅkalpa is composed AT RENDER TIME
 * from slots in the document. `gotra` and `name` are personal data: they belong
 * to whoever hosts the renderer, and are never written into a shared or cached
 * document payload.
 */
export const SankalpaPreferences = z.object({
  level: z.enum(['simple', 'standard', 'maha']).catch('standard').default('standard'),
  tradition: z.enum(['smarta', 'vaishnava', 'shaiva', 'shakta']).catch('smarta').default('smarta'),
  karma: z
    .enum(['puja', 'japa', 'homa', 'vrata', 'dana', 'snana', 'parayana', 'archana', 'abhisheka', 'dhyana'])
    .catch('puja').default('puja'),
  kamana: z
    .enum(['dharmic', 'health', 'peace', 'knowledge', 'obstacles', 'prosperity',
      'progeny', 'longevity', 'liberation', 'protection', 'allbeings'])
    .catch('dharmic').default('dharmic'),
  deity: z
    .enum(['parameshvara', 'ganesha', 'shiva', 'vishnu', 'devi', 'surya', 'hanuman',
      'lakshmi', 'sarasvati', 'durga', 'krishna', 'rama', 'subrahmanya', 'dattatreya', 'gayatri'])
    .catch('parameshvara').default('parameshvara'),
  /**
   * Has the reader ACTIVELY picked a deity, as opposed to never opening the
   * setting? An untouched preference is not a choice, and letting the default
   * fill a rite rewrites the liturgy.
   *
   * This used to be INFERRED as `deity !== 'parameshvara'`, which made the
   * default value unpickable: a reader who deliberately chose Parameśvara got
   * exactly the behaviour of never having chosen. The intent is about the ACT
   * of choosing, so it needs its own field. Older stored rows lack it and read
   * as `false`.
   */
  deityChosen: z.boolean().catch(false).default(false),
  placeFrame: z.enum(['bharata', 'adapted']).catch('adapted').default('adapted'),
  gotra: z.string().max(80).catch('kāśyapa').default('kāśyapa'),
  name: z.string().max(120).catch('').default(''),
});
export type SankalpaPreferences = z.infer<typeof SankalpaPreferences>;

/** Everything the renderer reads out of its host's preference store. */
export const RenderPreferences = z.object({
  chant: ChantPreferences.default({}),
  sankalpa: SankalpaPreferences.default({}),
});
export type RenderPreferences = z.infer<typeof RenderPreferences>;

export const DEFAULT_RENDER_PREFERENCES: RenderPreferences = RenderPreferences.parse({});
