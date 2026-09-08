/**
 * Re-deriving one verse — the operation every edit ends in.
 *
 * RULE ZERO LIVES HERE. A verse with no `src` layer was hand-marked in Word or
 * read off a PDF: its marks are *evidence*, they exist nowhere else, and
 * re-deriving one would replace a transcription with a guess. So this function
 * REFUSES, by returning a refusal rather than throwing — the caller usually
 * has other verses to derive and a document where one verse is attested is the
 * normal case, not an error.
 *
 * It also closes two gaps the format had declared and nothing honoured:
 * `ChantVerse.svaraRegister` and `ChantVerse.meter` were stored and read by no
 * one, so a verse marked `vedic-refuse` would have had a positional svara plan
 * applied to it the moment anything re-derived it. They are folded into the
 * profile chain here, which is the one place a register can be turned into
 * engine behaviour.
 */
import { derive, resolveProfile } from '@siksamitra/engine';
import type { Derivation } from '@siksamitra/engine';
import type {
  ChantOverride, ChantProfileRef, ChantSection, ChantVerse,
} from '@siksamitra/format';
import {
  assertHoldings, normaliseHoldings, holdingProblems, type HoldingProblem,
} from './holdings.js';

export interface VerseReport {
  verseId: string;
  /** Marks the author placed that no longer address a letter. */
  unplaced: { override: ChantOverride; why: string }[];
  /** Engine warnings, verbatim. */
  warnings: Derivation['warnings'];
  /** Group ids this pass had to rewrite to keep the boxes legal. */
  regrouped: number;
  /** Invariant violations that SURVIVED normalisation. Should be empty. */
  problems: HoldingProblem[];
  stats: Derivation['stats'];
}

export type DeriveVerseResult =
  | { ok: true; verse: ChantVerse; report: VerseReport }
  | { ok: false; refused: 'attested'; why: string };

/**
 * The profile chain for one verse: document, then section, then the verse.
 *
 * `svaraRegister` and `meter` become the LAST link, so a verse that declares
 * itself attested cannot have a conventional preset inherited over it from the
 * section. Order is the whole mechanism — see `resolveProfile`.
 */
export function profileChain(
  verse: ChantVerse,
  section: Pick<ChantSection, 'profile'> | undefined,
  docProfile: ChantProfileRef | undefined,
): (ChantProfileRef | undefined)[] {
  const chain: (ChantProfileRef | undefined)[] = [
    docProfile,
    section?.profile,
    verse.profile,
  ];
  if (verse.svaraRegister !== undefined) {
    chain.push({
      patch: {
        svara: {
          register: verse.svaraRegister,
          ...(verse.meter === undefined ? {} : { meter: verse.meter }),
        },
      },
    });
  }
  return chain;
}

/**
 * Derive one verse from its source, keeping everything that is not derived.
 *
 * `words`, `audioId`, `translation`, `source` and the instructions are the
 * author's and are carried across untouched. Only `tokens` is an output — and
 * `src.lines`, which the caller has already changed and which is passed back
 * unchanged so that what was derived and what it was derived FROM stay
 * together in one object.
 */
export function deriveVerse(
  verse: ChantVerse,
  section: Pick<ChantSection, 'profile'> | undefined,
  docProfile: ChantProfileRef | undefined,
  overrides: readonly ChantOverride[],
): DeriveVerseResult {
  if (verse.src === undefined) {
    return {
      ok: false,
      refused: 'attested',
      why: `verse "${verse.id}" has no source layer: its marks are a `
        + 'transcription and re-deriving them would replace evidence with a guess',
    };
  }

  const profile = resolveProfile(profileChain(verse, section, docProfile));
  const derivation = derive(
    {
      lines: [...verse.src.lines],
      ...(verse.src.accented === undefined ? {} : { accented: [...verse.src.accented] }),
    },
    profile,
    {
      verseId: verse.id,
      verseN: verse.n ?? null,
      overrides,
      trace: false,
    },
  );

  /*
   * Normalise the boxes before anything sees them. A hand-placed holding
   * adjacent to a derived one of the same length is two group ids and draws as
   * two touching strokes; the author drew one box. This is the only place the
   * repair can happen once and cover every path into the document.
   */
  const { tokens, changed } = normaliseHoldings(derivation.tokens);

  /*
   * ASSERTED, not merely reported.
   *
   * `holdingProblems` was called and its result put in a report nobody read,
   * while `assertHoldings` — documented as "used by the session after every
   * command" — had no caller anywhere in the program. A malformed box that
   * reaches the document is a defect the author has to find by eye in a PDF,
   * so a derivation that produces one fails here instead.
   */
  assertHoldings(tokens, `verse "${verse.id}"`);

  const next: ChantVerse = {
    ...verse,
    tokens,
    src: { ...verse.src, lines: [...derivation.srcMap.lines] },
  };

  return {
    ok: true,
    verse: next,
    report: {
      verseId: verse.id,
      unplaced: derivation.overrides.unplaced,
      warnings: derivation.warnings,
      regrouped: changed,
      // Checked, not assumed. `normaliseHoldings` cannot repair a `hold` on a
      // letter that is not one, and a report that only ever said "fine" would
      // be worth nothing.
      problems: holdingProblems(tokens),
      stats: derivation.stats,
    },
  };
}

/** The source map for a verse, without producing a new verse. For addressing a
 *  mark: the editor needs unit → source offsets before it can place one. */
export function verseSrcMap(
  verse: ChantVerse,
  section: Pick<ChantSection, 'profile'> | undefined,
  docProfile: ChantProfileRef | undefined,
  overrides: readonly ChantOverride[],
): Derivation['srcMap'] | null {
  if (verse.src === undefined) return null;
  const profile = resolveProfile(profileChain(verse, section, docProfile));
  /*
   * THE SAME INPUT `deriveVerse` USES — accents and verse number included.
   *
   * This passed only `lines`, so the map a mark is addressed THROUGH was built
   * from a different derivation than the tokens the mark lands ON. An accent
   * layer can change how a syllable divides, and where it does, a unit index
   * names one letter here and another there: the mark is placed on the letter
   * the person clicked and recorded against its neighbour.
   */
  return derive(
    {
      lines: [...verse.src.lines],
      ...(verse.src.accented === undefined ? {} : { accented: [...verse.src.accented] }),
    },
    profile,
    {
      verseId: verse.id,
      verseN: verse.n ?? null,
      overrides,
      trace: false,
    },
  ).srcMap;
}
