/**
 * Marking by hand — a selection of letters, and what the author decided.
 *
 * A mark in this program is never stored on a token. It is stored as an
 * OVERRIDE in source coordinates, and the token is recomputed. That is rule
 * three ("derived fields are outputs") and rule zero ("a hand-placed mark
 * survives re-derivation") holding hands: the author's decision outlives every
 * rule change precisely because it is not written where the rules write.
 *
 * The consequence worth knowing before reading further: applying a holding is
 * not a mutation of the rendered text. It adds an override and re-derives the
 * verse. That is more work per keystroke than editing a span would be, and it
 * is why the whole engine is pure and a verse derives in microseconds.
 *
 * ONE OVERRIDE PER LETTER. Two overrides on the same letter would apply in
 * array order, which makes the document's meaning depend on insertion history
 * — so marks at the same address MERGE. `why` escalates and never quietly
 * demotes: an `owner-hand` decision does not become `editorial` because a
 * later pass touched the same letter.
 */
import type { SrcMap } from '@siksamitra/engine';
import type { ChantOverride } from '@siksamitra/format';
import type { OverrideField } from '@siksamitra/engine';

/** The marks a hand edit may place, and `null` to suppress the engine's. */
export type MarkPatch = Partial<Record<OverrideField, unknown>>;

export type MarkReason = ChantOverride['why'];

/** How strongly a reason binds. Higher wins a merge; see the header. */
const WEIGHT: Record<MarkReason, number> = {
  editorial: 0,
  'engine-defect': 1,
  'source-witness': 2,
  'owner-hand': 3,
};

/** A letter, addressed the way the rendered text addresses it. */
export interface UnitAddress {
  verseId: string;
  /** Index into the verse's emitted units, in token order — `SrcMap.units`. */
  unit: number;
}

const sameAddress = (a: ChantOverride['at'], b: ChantOverride['at']): boolean =>
  a.verse === b.verse && a.line === b.line && a.letter === b.letter;

/**
 * Turn a rendered-unit address into a source address.
 *
 * `SrcMap.units` is produced by `emit`, not by a second walk over the
 * elements — so this map cannot drift from what a unit *is*. A unit index that
 * is out of range returns `null` rather than clamping: a mark placed on a
 * letter that does not exist is a bug in the caller, and clamping would hide it
 * by marking a neighbour.
 */
export function sourceAddress(
  verseId: string,
  srcMap: SrcMap,
  unit: number,
): { at: ChantOverride['at']; ch: string } | null {
  const span = srcMap.units[unit];
  if (span === undefined) return null;
  const line = srcMap.lines[span.line] ?? '';
  return {
    at: { verse: verseId, line: span.line, letter: span.start },
    ch: line.slice(span.start, span.end),
  };
}

/**
 * Apply a patch to a set of letters, merging with what is already there.
 *
 * Returns a NEW array. The session keeps the previous one for undo, and a
 * mutating version of this would make that a lie.
 */
export function markLetters(
  overrides: readonly ChantOverride[],
  srcMap: SrcMap,
  targets: readonly UnitAddress[],
  patch: MarkPatch,
  why: MarkReason,
  note?: string,
): { overrides: ChantOverride[]; placed: number; missed: number } {
  let out = [...overrides];
  let placed = 0;
  let missed = 0;

  for (const target of targets) {
    const found = sourceAddress(target.verseId, srcMap, target.unit);
    if (found === null) {
      missed += 1;
      continue;
    }
    out = mergeOverride(out, {
      at: found.at,
      set: { ...patch },
      why,
      ch: found.ch,
      ...(note === undefined ? {} : { note }),
    });
    placed += 1;
  }

  return { overrides: out, placed, missed };
}

/**
 * Add one override, merging with whatever already addresses that letter.
 *
 * Split out of `markLetters` because adopting a source layer needs the same
 * rule — one override per letter, `why` escalates and never demotes — and a
 * second copy of it is a second place for the two to drift apart.
 */
export function mergeOverride(
  overrides: readonly ChantOverride[],
  next: ChantOverride,
): ChantOverride[] {
  const out = [...overrides];
  const index = out.findIndex((o) => sameAddress(o.at, next.at));
  if (index === -1) {
    out.push(next);
    return out;
  }
  const prev = out[index]!;
  const merged: ChantOverride = {
    ...prev,
    set: { ...prev.set, ...next.set },
    // Escalate only. See the header: a later editorial pass must not
    // relabel the owner's own decision.
    why: WEIGHT[next.why] >= WEIGHT[prev.why] ? next.why : prev.why,
    ...(next.ch === undefined ? {} : { ch: next.ch }),
  };
  if (next.note !== undefined) merged.note = next.note;
  out[index] = merged;
  return out;
}

/**
 * Remove the author's decision about some fields on some letters.
 *
 * NOT the same as setting them to `null`. `null` says "the engine is wrong,
 * there is no mark here"; removing says "I have no opinion, let the engine
 * decide". Conflating the two is how a suppression becomes permanent and
 * un-undoable by re-running the rules.
 */
export function clearMarks(
  overrides: readonly ChantOverride[],
  srcMap: SrcMap,
  targets: readonly UnitAddress[],
  fields: readonly OverrideField[],
): ChantOverride[] {
  const addresses = targets
    .map((t) => sourceAddress(t.verseId, srcMap, t.unit)?.at)
    .filter((a): a is ChantOverride['at'] => a !== undefined);

  const out: ChantOverride[] = [];
  for (const ov of overrides) {
    if (!addresses.some((a) => sameAddress(a, ov.at))) {
      out.push(ov);
      continue;
    }
    const set = { ...ov.set };
    for (const f of fields) delete set[f];
    // An override with nothing left to say is removed, not kept as an empty
    // shell: `holdingProblems` would be right to call that an empty group.
    if (Object.keys(set).length > 0) out.push({ ...ov, set });
  }
  return out;
}

/**
 * Hand back the holdings to the engine, for whole verses.
 *
 * The owner's phrase for this is "running auto holdings on existing
 * markings", and it has two honest meanings, so it takes a flag rather than
 * guessing:
 *
 *  - `keep` (the default) — re-derive, and let the hand-placed boxes still
 *    win. Nothing is lost; the rules fill in around them.
 *  - `replace` — drop the hand-placed holdings for these verses first, so the
 *    rules speak alone.
 *
 * Only `hold` and `hg` are touched either way. A svara, a candrabindu or a
 * svarabhakti the author placed has nothing to do with holdings, and an
 * "auto-holdings" button that cleared them would be a trap.
 */
export function autoHoldings(
  overrides: readonly ChantOverride[],
  verseIds: readonly string[],
  mode: 'keep' | 'replace' = 'keep',
): ChantOverride[] {
  if (mode === 'keep') return [...overrides];
  const ids = new Set(verseIds);
  const out: ChantOverride[] = [];
  for (const ov of overrides) {
    if (!ids.has(ov.at.verse)) {
      out.push(ov);
      continue;
    }
    const set = { ...ov.set };
    delete set.hold;
    delete set.hg;
    if (Object.keys(set).length > 0) out.push({ ...ov, set });
  }
  return out;
}

/** The overrides belonging to one verse. */
export const overridesFor = (
  overrides: readonly ChantOverride[],
  verseId: string,
): ChantOverride[] => overrides.filter((o) => o.at.verse === verseId);
