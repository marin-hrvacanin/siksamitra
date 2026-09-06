/**
 * `Profile` — the single parametrization of the engine.
 *
 * Every behavioural difference between documents is a field here. There is no
 * document-specific branch anywhere in the engine, and no mutable module
 * state: `gen_marks.py`'s `RULES` dict was mutated by importers
 * (`coords.py` and `emit.py` both did `gen_marks.RULES['no_initial_box'] = False`),
 * which made the engine's behaviour depend on who had imported it.
 *
 * A profile is resolved doc → part → section → verse, field by field, so a
 * verse can change only its svara register and inherit everything else.
 *
 * See specs/chant-editor/02-ENGINE.md §2 and docs/MARKING-RULES.md §4.
 */
import type { ChantScriptKey } from '@siksamitra/format';
import type {
  ChantProfileKey,
  ChantProfileRef as FormatProfileRef,
} from '@siksamitra/format';

export type Recension =
  | 'rigveda'
  | 'sukla-yajurveda'
  | 'krsna-yajurveda'
  | 'samaveda'
  | 'smriti';

export type MeterKey =
  | 'anustubh'
  | 'gayatri'
  | 'tristubh'
  | 'jagati'
  | 'sardulavikridita'
  | 'pushpitagra';

/**
 * Which svara register a verse belongs to. The prohibition is the point:
 * genuinely Vedic text may NEVER be marked by convention, however well it
 * happens to scan.
 */
export type SvaraRegister =
  /** Vedic saṁhitā — transcribed from an accented source, never derived. */
  | 'attested'
  /** Purāṇic / smārta / stotra — a positional preset may be applied. */
  | 'conventional'
  /** Offerings, saṅkalpa, nāmāvalīs — holdings + anusvāra + visarga only. */
  | 'prose'
  /** Vedic with no accented source: ships unmarked, and a preset may never be
   *  applied. The refusal must survive re-lineation. */
  | 'vedic-refuse';

export interface Profile {
  readonly recension: Recension;

  readonly svara: {
    readonly register: SvaraRegister;
    /** Required when `register === 'conventional'`. */
    readonly meter?: MeterKey;
  };

  /**
   * The Taittirīya gum layer (MARKING-RULES §"The Vedic anusvāra"). Derived
   * from `recension` by the presets, but overridable — deciding the recension
   * is a real decision, not a default: Viṣṇu Sūktam's verses all stand in the
   * Ṛgveda too, and a Ṛgvedic reading would forbid every g-form.
   */
  readonly gum: boolean;

  /**
   * Reading aids, MEASURED against the owner's four hand-marked chants:
   * `vy` → u 29/29 (universal), `jñ` → g 14/32 (he ruled it in, 2026-08),
   * `sv` → u 2/30 (not the house habit). Do not turn `sv` on without a ruling:
   * it would put a raised `u` on 28 letters he leaves bare.
   *
   * `semivowel` is the raised `u`/`l`/`i` a KEPT anusvāra takes before
   * `v`/`l`/`y`. Counted across the eleven shipped documents it splits by
   * register and not by document: the eight Vedic texts take it 102 times and
   * leave it off 3, and the three smārta ones — the two nāmāvalīs and the pūjā
   * — take it 0 times and leave it off 40. It is a Vedic convention, so it is
   * a preset field and not a global.
   */
  readonly aids: {
    readonly jna: boolean;
    readonly vy: boolean;
    readonly sv: boolean;
    readonly semivowel: boolean;
  };

  readonly svarabhakti: boolean;

  readonly pauses: {
    /** The short pause every praṇava and bīja takes. */
    readonly bija: boolean;
    /** The vowel-hiatus pauses — 35/35 against his own marked chants. */
    readonly hiatus: boolean;
  };

  readonly holdings: {
    /** The owner's ruling (2026-08): "we never box the initial clusters".
     *  NOT in `sanskrit_rules.js` — his rule on top of it. */
    readonly noInitialBox: boolean;
    /**
     * How a same-point-of-articulation pair is recognised.
     *
     *   'aspirate'   SHIPPED — identical, or differing only by aspiration. 510/534.
     *   'homorganic' also counts voicing (t+d, k+g). An exact tie on the
     *                corpus, because no voicing pair occurs across a word join
     *                anywhere in it — so the corpus cannot decide it. Unruled.
     *   'all'        every differing cross-word pair hosts on the first word's
     *                final. REJECTED: 487/534.
     *   false        identical pairs only — the pre-ruling behaviour. 507/534.
     */
    readonly crosswordHost: 'aspirate' | 'homorganic' | 'all' | false;
  };

  readonly scripts: readonly ChantScriptKey[];

  /** Kill or force any rule by id. An escape hatch; every use needs a comment. */
  readonly ruleOverrides?: Readonly<Record<string, boolean>>;
}

/**
 * The preset names are DOCUMENT vocabulary, so they are declared in `format`
 * and re-exported here. The engine specialises the generic patch to its own
 * `Profile`, which is how authoring code keeps full type safety while the
 * platform depends on `format` alone.
 */
export type ProfileKey = ChantProfileKey;

/** What a profile reference looks like in a document (01 §2.1). */
export type ChantProfileRef = FormatProfileRef<DeepPartial<Profile>>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K]
    : T[K] extends object ? DeepPartial<T[K]>
    : T[K];
};

const BASE = {
  aids: { jna: true, vy: true, sv: false, semivowel: true },
  svarabhakti: true,
  pauses: { bija: true, hiatus: true },
  holdings: { noInitialBox: true, crosswordHost: 'aspirate' as const },
  scripts: ['iast', 'deva', 'tel', 'tam'] as readonly ChantScriptKey[],
};

/**
 * The four registers the corpus actually uses, plus Śukla Yajurveda.
 *
 * These replace the per-generator constants: `gen_lakshmi`'s `SVARA = None`,
 * `gen_puja`'s per-verse `meter=` tags, `gen_vishnu`'s opt-in gum.
 */
export const PROFILES: Readonly<Record<ProfileKey, Profile>> = Object.freeze({
  /** Kṛṣṇa Yajurveda / Taittirīya — Puruṣa, Viṣṇu, Mantra Puṣpam, Rudram. */
  taittiriya: Object.freeze({
    ...BASE,
    recension: 'krsna-yajurveda',
    gum: true,
    svara: { register: 'attested' },
  }),
  /** Ṛgveda — the mark's own type is preserved and no g-forms are generated. */
  rigveda: Object.freeze({
    ...BASE,
    recension: 'rigveda',
    gum: false,
    svara: { register: 'attested' },
  }),
  'sukla-yajurveda': Object.freeze({
    ...BASE,
    recension: 'sukla-yajurveda',
    gum: true,
    svara: { register: 'attested' },
  }),
  /** Purāṇic / smārta / āgamic — the anusvāra is kept and left unpainted. */
  smarta: Object.freeze({
    ...BASE,
    recension: 'smriti',
    gum: false,
    svara: { register: 'conventional' },
    aids: { ...BASE.aids, semivowel: false },
  }),
  /** Offerings, saṅkalpa, nāmāvalīs — no svara, and only the bīja's pause. */
  prose: Object.freeze({
    ...BASE,
    recension: 'smriti',
    gum: false,
    svara: { register: 'prose' },
    pauses: { bija: true, hiatus: true },
    aids: { ...BASE.aids, semivowel: false },
  }),
} as Record<ProfileKey, Profile>);

export const DEFAULT_PROFILE: Profile = PROFILES.taittiriya;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge `patch` onto `base`, field by field. Arrays replace wholesale. */
function merge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = out[k];
    out[k] = isPlainObject(v) && isPlainObject(prev) ? merge(prev, v) : v;
  }
  return out as T;
}

/**
 * Resolve a chain of references — doc → part → section → verse. Later entries
 * win FIELD BY FIELD, so a verse may change only its svara register while
 * inheriting the recension, the aids and the holding rules.
 *
 * Pure, and identical inputs return an identical (`===`) frozen instance, so
 * memoising a derivation on the resolved profile is cheap.
 */
const cache = new Map<string, Profile>();

export function resolveProfile(
  chain: ReadonlyArray<ChantProfileRef | undefined | null>,
): Profile {
  const key = JSON.stringify(chain ?? []);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: Profile = DEFAULT_PROFILE;
  for (const ref of chain) {
    if (ref === undefined || ref === null) continue;
    if (ref.preset !== undefined) out = PROFILES[ref.preset];
    if (ref.patch !== undefined) out = merge(out, ref.patch);
  }
  const frozen = Object.freeze(out);
  cache.set(key, frozen);
  return frozen;
}
