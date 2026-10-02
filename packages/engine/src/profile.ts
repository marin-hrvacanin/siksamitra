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
    /**
     * The Ṛgveda's lengthening of the svarita (`rules/rigveda.ts`): a
     * dīrgha-svarita on a long vowel or a nasal, the overline on a short
     * vowel. On in the Ṛgveda preset; a verse that is accented but not
     * recited that way — the anukramaṇī of ṚV 10.191 — turns it off.
     */
    readonly lengthening?: boolean;
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
    /**
     * …and whether one takes it right after a daṇḍa on its own line, before ś
     * or h: the closing `॥ oṁ śāntiḥ śāntiḥ śāntiḥ ॥`, `॥ oṁ hara hara …`.
     * Off: his sādhanā writes both so, and bhū sūktam v1.1 — while `॥ oṁ |
     * namo bhagavate rudrāya ॥` keeps it, as every file of his does, and so
     * does `| oṁ | suvaḥ` in the Pūjā Vidhi. Only ś and h, because only they
     * are in the evidence. On: the shipped Rudram's convention.
     */
    readonly afterDanda: boolean;
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
    /**
     * THE CORRECT POSITION, WITHOUT EXCEPTIONS — the owner's ruling
     * (2026-09-29) for every new document: a word-initial cluster hosts its box
     * on its FIRST consonant, whatever that is (`tasmai ▫śrī`, `rase ▫svā`,
     * `prathama ▫rco`, `eto ▫nvi`), as his sādhanā v9.1.4 marks it 140 times.
     * Off, a leading `r`, sibilant or nasal is skipped to the consonant after
     * it — the older convention the shipped chants record as their own.
     */
    readonly firstHost?: boolean;
    /**
     * A new LINE inside a verse continues the recitation: its opening cluster
     * is boxed from the vowel that ended the line before (`…me / ▪pri…`, 38
     * times in v9.1.4). The verse's first line opens bare, because nothing
     * precedes it — and so does a line after a DAṆḌA, which is a pause the
     * cluster is not carried over (`…śiśriye । / pratyasya`), unless
     * `afterDanda`. Off, every line opens bare (the older convention).
     */
    readonly lineContinues?: boolean;
    /**
     * A line's opening cluster boxed even after a daṇḍa ends the line before.
     * Off: every file of his — sādhanā v9.1.4 21 of 21, v9.1.13 24 of 24,
     * rudram v1.622 8 of 8, Devī v6.62 110 of 110 — leaves it bare. On: the
     * shipped chants' convention, which v1's generator marked them with.
     */
    readonly afterDanda?: boolean;
    /**
     * A GEMINATE — two of one consonant, or a consonant and its aspirate —
     * under one box or two letters' worth of it. The owner's ruling
     * (2026-09-07, confirmed 2026-09-30): `one` is the default — the older
     * convention, one box on one letter (`u[t]tama`); `whole` is the newer
     * one his Devī Māhātmyam v6.62 and Rudram v1.622 use, one box over both
     * (`u[tt]ama`, `ga[cch]ati`), switchable per document.
     */
    readonly geminate?: 'one' | 'whole';
  };

  /**
   * Two substitutions the owner ruled on 2026-09-30, each switchable.
   */
  readonly sandhi: {
    /**
     * `ṁ` before a NASAL takes that nasal — `puraṁ mahā` → `puram mahā`,
     * `śagmāṁ no` → `śagmān no` — as it takes the nasal of any stop's row:
     * "always the exact same form of the anunāsika". On; his files do it five
     * times in six, and the rules never did.
     */
    readonly nasalBeforeNasal: boolean;
    /**
     * `ḥ` before `k` / `kh` is marked as a change — his blue, the letter
     * recited otherwise (`devyaḥ krodha`, `duḥkha`). On; off leaves it plain.
     */
    readonly visargaBeforeVelar: boolean;
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
  /* `vy` OFF, by the owner's ruling of 2026-09-30: "u between v and y happens
     more rarely and is optional". `jñ` always. */
  aids: { jna: true, vy: false, sv: false, semivowel: true },
  svarabhakti: true,
  pauses: { bija: true, hiatus: true, afterDanda: false },
  holdings: {
    noInitialBox: true, crosswordHost: 'aspirate' as const, firstHost: true, lineContinues: true,
    geminate: 'one' as const,
  },
  sandhi: { nasalBeforeNasal: true, visargaBeforeVelar: true },
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
    svara: { register: 'attested', lengthening: true },
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
    /*
     * ANUṢṬUBH UNLESS SAID OTHERWISE — the śloka is what purāṇic verse is, and
     * its plan is verified against his marked Lalitā Sahasranāma, 35/35
     * half-verses. A line that does not scan as a 16-syllable half-verse is
     * left unmarked, all or nothing (`applySvaraPlan`), so prose and other
     * metres are never marked by it; a verse that declares its metre uses that.
     */
    svara: { register: 'conventional', meter: 'anustubh' },
    aids: { ...BASE.aids, semivowel: false },
  }),
  /** Offerings, saṅkalpa, nāmāvalīs — no svara, and only the bīja's pause. */
  prose: Object.freeze({
    ...BASE,
    recension: 'smriti',
    gum: false,
    svara: { register: 'prose' },
    pauses: { bija: true, hiatus: true, afterDanda: false },
    aids: { ...BASE.aids, semivowel: false },
  }),
} as Record<ProfileKey, Profile>);

/** The register a text is marked in when nothing says otherwise — by name,
 *  for what stores a name (a Word part, a document's settings). */
export const DEFAULT_PROFILE_KEY: ProfileKey = 'taittiriya';
export const DEFAULT_PROFILE: Profile = PROFILES[DEFAULT_PROFILE_KEY];

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

/** Does this register lengthen the svarita — and so must reading its marks
 *  back undo that? One question, asked by every inverter. */
export const lengthens = (p: Pick<Profile, 'svara'>): boolean => p.svara.lengthening === true;

/**
 * Does this register PLACE svaras of its own — the śloka's, by its metre —
 * rather than read the ones the text has? Then a svara its rules placed is
 * its output, and re-marking in another register must take it off rather
 * than read it as an accent of the text: Smārta's śloka svaras, re-marked as
 * Ṛgveda, were kept and lengthened into dīrgha-svaritas.
 */
export const placesSvaras = (p: Pick<Profile, 'svara'>): boolean =>
  p.svara.register === 'conventional' && p.svara.meter != null;
