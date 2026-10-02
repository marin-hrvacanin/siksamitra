/**
 * THE CONVENTIONS A PERSON CAN SWITCH — each with what it does, shown.
 *
 * A `Profile` has dozens of fields and most are the register's business. These
 * are the handful the owner has RULED on as a matter of taste rather than of
 * śākhā — the same register, marked one way in one of his documents and the
 * other way in another — and so they are offered to a person as switches,
 * each with an example of what it changes. The rulings (2026-09-30):
 *
 *   - `ṁ` before a nasal takes that nasal — on;
 *   - `ḥ` before `k` / `kh` marked as recited otherwise — on;
 *   - the raised `u` of `vy` — optional, off;
 *   - one box over a whole geminate — the newer convention, off; the older
 *     one, a box on one letter, stays the default (2026-09-07).
 *
 * ONE TABLE, read by every surface that offers them — the Word add-in's
 * panel today — so a switch cannot mean one thing in one program and
 * another in the next. Whether a switch is ON is read from the resolved
 * profile, never typed here, so the table cannot drift from the defaults.
 */
import type { Profile } from './profile.js';

export type ConventionId =
  | 'nasal-before-nasal' | 'visarga-before-velar' | 'puranic-svara' | 'vy-aid' | 'geminate-box' | 'pause-after-danda';

/** A profile patch — the shape `resolveProfile` merges. */
type Patch = Record<string, Record<string, unknown>>;

export interface Convention {
  readonly id: ConventionId;
  /** What it is, in a person's words. */
  readonly label: string;
  /** What is typed, and what the rules make of it with the switch on. */
  readonly example: { readonly typed: string; readonly marked: string };
  /** One sentence on when to turn it off, or on. */
  readonly note: string;
  readonly on: Patch;
  readonly off: Patch;
  /** Is it on under this profile? */
  readonly isOn: (p: Profile) => boolean;
  /**
   * Has it anything to do under this profile? A switch that would change
   * nothing — the purāṇic svaras over a Vedic line, whose svaras are the
   * text's own — is offered greyed, with `onlyFor` saying where it does
   * apply. Absent: it applies under every profile.
   */
  readonly applies?: (p: Profile) => boolean;
  /** Where it applies, in a person's words, when `applies` can say no. */
  readonly onlyFor?: string;
}

export const CONVENTIONS: readonly Convention[] = [
  {
    id: 'nasal-before-nasal',
    label: 'ṁ before a nasal becomes that nasal',
    example: { typed: 'puraṁ mahā · śagmāṁ no', marked: 'puram mahā · śagmān no' },
    note: 'As before any consonant, the anusvāra takes the anunāsika of what follows. Off keeps ṁ before n and m.',
    on: { sandhi: { nasalBeforeNasal: true } },
    off: { sandhi: { nasalBeforeNasal: false } },
    isOn: (p) => p.sandhi.nasalBeforeNasal,
  },
  {
    id: 'visarga-before-velar',
    label: 'ḥ before k or kh is marked as recited otherwise',
    example: { typed: 'devyaḥ krodha · duḥkha', marked: 'devyaḥ krodha · duḥkha, the ḥ in blue' },
    note: 'The letter stays ḥ and takes the colour of a letter the rules replaced. Off leaves it plain.',
    on: { sandhi: { visargaBeforeVelar: true } },
    off: { sandhi: { visargaBeforeVelar: false } },
    isOn: (p) => p.sandhi.visargaBeforeVelar,
  },
  {
    id: 'puranic-svara',
    label: 'Svaras on a purāṇic śloka, by its metre',
    example: { typed: 'yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā', marked: 'the same half-verse with the śloka’s seven svaras' },
    note: 'Smārta and purāṇic verse: a line that scans as an anuṣṭubh half-verse takes the śloka pattern, as in his Lalitā Sahasranāma (35 of 35). Off leaves such lines without svaras.',
    on: { svara: { meter: 'anustubh' } },
    /* `null`, not `undefined`: a patch's undefined is no change at all. */
    off: { svara: { meter: null } },
    isOn: (p) => p.svara.meter != null,
    applies: (p) => p.svara.register === 'conventional',
    onlyFor: 'Smārta and purāṇic lines: a Vedic line’s svaras are its own.',
  },
  {
    id: 'vy-aid',
    label: 'A raised u on v before y',
    example: { typed: 'bhavyam · vāyavyān', marked: 'bhavᵘyam · vāyavᵘyān' },
    note: 'Rarer, and optional. The g of jñ is always written.',
    on: { aids: { vy: true } },
    off: { aids: { vy: false } },
    isOn: (p) => p.aids.vy,
  },
  {
    id: 'geminate-box',
    label: 'One box over a whole geminate',
    example: { typed: 'uttamam · gacchati', marked: 'u[tt]amam · ga[cch]ati — off: u[t]tamam · ga[c]chati' },
    note: 'The newer convention. Off, the default, boxes one letter of the pair, as the older documents do.',
    on: { holdings: { geminate: 'whole' } },
    off: { holdings: { geminate: 'one' } },
    isOn: (p) => p.holdings.geminate === 'whole',
  },
  {
    id: 'pause-after-danda',
    label: 'oṁ right after a daṇḍa takes its pause before ś or h',
    example: { typed: '॥ oṁ śāntiḥ śāntiḥ śāntiḥ ॥', marked: '॥ oṁ | śāntiś śāntiś śāntiḥ ॥ — off: ॥ oṁ śāntiś śāntiś śāntiḥ ॥' },
    note: 'Off, the default, writes the closing śānti as his files do. A line that opens with oṁ, and ॥ oṁ | namo, keep the pause either way.',
    on: { pauses: { afterDanda: true } },
    off: { pauses: { afterDanda: false } },
    isOn: (p) => p.pauses.afterDanda,
  },
];

/** Does this convention change anything under `p`? */
export const conventionApplies = (c: Convention, p: Profile): boolean => c.applies?.(p) ?? true;

/** The patch that sets each chosen convention; one not chosen is the profile's own. */
export function conventionsPatch(chosen: Readonly<Partial<Record<ConventionId, boolean>>>): Patch {
  const out: Patch = {};
  for (const c of CONVENTIONS) {
    const v = chosen[c.id];
    if (v === undefined) continue;
    for (const [group, fields] of Object.entries(v ? c.on : c.off)) out[group] = { ...out[group], ...fields };
  }
  return out;
}
