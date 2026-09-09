/**
 * PLACING A MARKING BY HAND — on the text, the way bold works.
 *
 * A marking used to be stored as an OVERRIDE — an address into the verse's
 * source, plus the value the rules should be overruled with — and it reached
 * the page only when the verse was next derived. That made three things true
 * at once, all of them wrong:
 *
 *   pressing a marking button ran the whole engine over the verse;
 *   a verse with no source layer could not hold one at all, which is what made
 *   the holding button answer with a paragraph about evidence;
 *   and "is this holding correct?" was a question about a derivation.
 *
 * A marking is now a range over the verse's text, and placing one writes it
 * there. Nothing is derived, nothing is overruled, and every verse takes one,
 * because every verse is the same shape.
 *
 * TOGGLING IS BOLD'S RULE, which `toggleMark` in `@siksamitra/format` already
 * implements: a mixed selection turns fully on, pressing again turns it off,
 * and a subset turns off on its own. That is the behaviour the owner asked for
 * by name, and it is not reimplemented here.
 */
import {
  applyMark as applySpan, encodeMarks, mark, removeMark, toTextAndMarks, toggleMark,
  type ChantSection, type ChantVerse, type Mark, type MarkKind,
} from '@siksamitra/format';
import { hydrateVerse } from '@siksamitra/engine';
import type { UnitAddress } from './marks.js';

/** What a marking button asks for: a kind, and the value or `null` for off. */
export interface MarkPatchText {
  k: MarkKind;
  /** `null` removes the marking from the range instead of placing one. */
  v: string | null;
}

/**
 * A marking button's patch, as a kind and a value.
 *
 * The buttons still speak in the override vocabulary — `{ hold: 'long' }`,
 * `{ svara: null }` — because that is what the surface and the command line
 * both send. Three of those fields no longer name a marking:
 *
 *   `hg`     was the holding GROUP id, which said which letters shared a box.
 *            A marking is a range now, so the range says it.
 *   `candra` is a character in the text, U+0310, not a marking — a run has one
 *            text node and nowhere to hang a combining mark.
 *   `dirgha` is a svara value, `dirgha-svarita`, not a kind of its own.
 */
const KIND_OF: Partial<Record<string, MarkKind>> = {
  hold: 'hold', svara: 'svara', sup: 'sup', sbhakti: 'sbhakti', change: 'was',
};

/** The kind and value a patch names, or `null` if it names nothing we store. */
export function patchToMark(
  field: string,
  value: unknown,
): MarkPatchText | null {
  const k = KIND_OF[field];
  if (k === undefined) return null;
  if (value === null || value === undefined || value === false) return { k, v: null };
  if (value === true) return { k, v: '' };
  return { k, v: String(value) };
}

export interface MarkTextResult {
  section: ChantSection;
  touched: Set<string>;
  refusals: string[];
}

/** The letters a target names, as one span per contiguous run. */
function spansFor(
  verse: ChantVerse,
  units: readonly number[],
): { from: number; to: number }[] {
  const all = toTextAndMarks(verse).units ?? [];
  const wanted = [...new Set(units)].sort((a, b) => a - b).filter((i) => all[i] !== undefined);
  const out: { from: number; to: number }[] = [];
  for (const i of wanted) {
    const span = all[i]!;
    const last = out[out.length - 1];
    /* Contiguous letters become ONE range, so a holding over a word is one box
       rather than one per letter — which is the whole reason a marking is a
       range. Letters with something between them stay separate. */
    if (last !== undefined && last.to === span.from) last.to = span.to;
    else out.push({ ...span });
  }
  return out;
}

/**
 * Place, or lift, a marking over the letters named.
 *
 * `v: null` lifts it. That is not the same as `Clear`, which withdraws every
 * marking of every kind here; this one names a kind and answers for that kind
 * alone.
 */
export function markText(
  section: ChantSection,
  targets: readonly UnitAddress[],
  patch: MarkPatchText,
): MarkTextResult {
  const byVerse = new Map<string, number[]>();
  for (const t of targets) {
    byVerse.set(t.verseId, [...(byVerse.get(t.verseId) ?? []), t.unit]);
  }
  const touched = new Set<string>();
  const refusals: string[] = [];

  const verses = section.verses.map((verse) => {
    const units = byVerse.get(verse.id);
    if (units === undefined) return verse;
    const spans = spansFor(verse, units);
    if (spans.length === 0) {
      refusals.push(`verse "${verse.id}" has no letter at the position given`);
      return verse;
    }
    const { text, marks } = toTextAndMarks(verse);
    let next: Mark[] = [...marks];
    for (const span of spans) {
      next = patch.v === null
        ? removeMark(next, patch.k, span.from, span.to)
        : applySpan(next, mark({
          k: patch.k, from: span.from, to: span.to, v: patch.v, by: 'hand',
        }));
    }
    touched.add(verse.id);
    return hydrateVerse({ ...verse, text, marks: encodeMarks(next) });
  });

  return { section: { ...section, verses }, touched, refusals };
}

/**
 * A marking button pressed: on if the range is not already wholly on, off if
 * it is. Word's rule, and `toggleMark` is where it lives.
 */
export function toggleText(
  section: ChantSection,
  targets: readonly UnitAddress[],
  patch: { k: MarkKind; v: string },
): MarkTextResult {
  const byVerse = new Map<string, number[]>();
  for (const t of targets) {
    byVerse.set(t.verseId, [...(byVerse.get(t.verseId) ?? []), t.unit]);
  }
  const touched = new Set<string>();
  const refusals: string[] = [];

  const verses = section.verses.map((verse) => {
    const units = byVerse.get(verse.id);
    if (units === undefined) return verse;
    const spans = spansFor(verse, units);
    if (spans.length === 0) {
      refusals.push(`verse "${verse.id}" has no letter at the position given`);
      return verse;
    }
    const { text, marks } = toTextAndMarks(verse);
    let next: Mark[] = [...marks];
    for (const span of spans) {
      next = toggleMark(next, mark({
        k: patch.k, from: span.from, to: span.to, v: patch.v, by: 'hand',
      }));
    }
    touched.add(verse.id);
    return hydrateVerse({ ...verse, text, marks: encodeMarks(next) });
  });

  return { section: { ...section, verses }, touched, refusals };
}

/** Withdraw every marking of these kinds from the letters named. */
export function clearText(
  section: ChantSection,
  targets: readonly UnitAddress[],
  kinds: readonly MarkKind[],
): MarkTextResult {
  const byVerse = new Map<string, number[]>();
  for (const t of targets) {
    byVerse.set(t.verseId, [...(byVerse.get(t.verseId) ?? []), t.unit]);
  }
  const touched = new Set<string>();

  const verses = section.verses.map((verse) => {
    const units = byVerse.get(verse.id);
    if (units === undefined) return verse;
    const spans = spansFor(verse, units);
    if (spans.length === 0) return verse;
    const { text, marks } = toTextAndMarks(verse);
    let next: Mark[] = [...marks];
    for (const span of spans) {
      for (const k of kinds) next = removeMark(next, k, span.from, span.to);
    }
    touched.add(verse.id);
    return hydrateVerse({ ...verse, text, marks: encodeMarks(next) });
  });

  return { section: { ...section, verses }, touched, refusals: [] };
}
